import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireWriter } from "@/lib/adminAuth";
import { audit } from "@/lib/admin";
import { sb, type Lead } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Duplicate contacts.
 *
 * Deliberately conservative. Two people at the same company, or two addresses
 * on the same website, are NOT duplicates — agencies, franchises and husband-
 * and-wife businesses all look like that, and merging them silently destroys
 * one person's record.
 *
 * So a pair is only ever SUGGESTED, never merged automatically, and only on
 * evidence about the person:
 *   - the same address normalised (gmail dots, +tags, case)
 *   - the same name at the same company
 * The website is shown as supporting context and never as the reason.
 */

type Candidate = {
  reason: string;
  confidence: "high" | "medium";
  primary: Lead;
  duplicate: Lead;
};

/** Gmail ignores dots and anything after a +. Other providers mostly do not,
 *  so the aggressive normalisation is applied only where it is actually true. */
function normaliseEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const base = user.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${base.replace(/\./g, "")}@gmail.com`;
  }
  return `${base}@${domain}`;
}

const nameKey = (l: Lead) =>
  `${(l.name ?? "").trim().toLowerCase().replace(/\s+/g, " ")}|${(l.company ?? "").trim().toLowerCase()}`;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const rows =
    (await sb<Lead[]>("bilabs_leads?merged_into=is.null&email=not.is.null&order=created_at.asc&limit=5000")) ?? [];

  const byEmail = new Map<string, Lead[]>();
  const byName = new Map<string, Lead[]>();
  for (const l of rows) {
    if (l.email) {
      const k = normaliseEmail(l.email);
      byEmail.set(k, [...(byEmail.get(k) ?? []), l]);
    }
    const nk = nameKey(l);
    if (nk !== "|" && l.name && l.company) byName.set(nk, [...(byName.get(nk) ?? []), l]);
  }

  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (const [, group] of byEmail) {
    if (group.length < 2) continue;
    const [primary, ...rest] = group;
    for (const dup of rest) {
      const pairKey = [primary.id, dup.id].sort().join(":");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      candidates.push({
        reason: "Same email address once dots and +tags are normalised",
        confidence: "high",
        primary,
        duplicate: dup,
      });
    }
  }

  for (const [, group] of byName) {
    if (group.length < 2) continue;
    const [primary, ...rest] = group;
    for (const dup of rest) {
      const pairKey = [primary.id, dup.id].sort().join(":");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      candidates.push({
        reason: "Same person name at the same business, different address",
        confidence: "medium",
        primary,
        duplicate: dup,
      });
    }
  }

  return NextResponse.json({
    candidates,
    policy:
      "Suggestions only — nothing is merged automatically. A shared website is never treated as evidence: different people at one business, and agencies managing several, legitimately share a domain.",
  });
}

/* Merge. The duplicate keeps its row and is marked merged_into, so the merge
 * is reversible and nothing is destroyed. Everything attached to it is
 * repointed at the primary, and the primary only gains fields it was
 * missing — an older complete record is never overwritten by a newer sparse
 * one. Consent is OR'd, never silently granted: if either side consented the
 * person did consent, and if neither did, the merge cannot create it. */
export async function POST(req: NextRequest) {
  const guard = await requireWriter(req);
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const body = await req.json().catch(() => null);
  const primaryId = String(body?.primaryId ?? "");
  const duplicateId = String(body?.duplicateId ?? "");
  const ok = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
  if (!ok(primaryId) || !ok(duplicateId) || primaryId === duplicateId) {
    return NextResponse.json({ error: "Give two different contact ids." }, { status: 400 });
  }

  const rows = await sb<Lead[]>(`bilabs_leads?id=in.(${primaryId},${duplicateId})`);
  const primary = rows?.find((r) => r.id === primaryId);
  const duplicate = rows?.find((r) => r.id === duplicateId);
  if (!primary || !duplicate) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  if (duplicate.merged_into) return NextResponse.json({ error: "That contact is already merged." }, { status: 409 });

  const fill = <T>(a: T | null | undefined, b: T | null | undefined) =>
    a === null || a === undefined || a === "" ? b ?? null : a;

  const patch: Record<string, unknown> = {
    name: fill(primary.name, duplicate.name),
    company: fill(primary.company, duplicate.company),
    website: fill(primary.website, duplicate.website),
    business_type: fill(primary.business_type, duplicate.business_type),
    area: fill(primary.area, duplicate.area),
    message: fill(primary.message, duplicate.message),
    report: primary.report ?? duplicate.report ?? null,
    readiness_score: primary.readiness_score ?? duplicate.readiness_score ?? null,
    mentions: primary.mentions ?? duplicate.mentions ?? null,
    mentions_total: primary.mentions_total ?? duplicate.mentions_total ?? null,
    stripe_customer_id: fill(primary.stripe_customer_id, duplicate.stripe_customer_id),
    marketing_consent: primary.marketing_consent || duplicate.marketing_consent,
    consent_at: primary.consent_at ?? duplicate.consent_at ?? null,
    // keep the earliest first-touch: that is the one that actually found them
    created_at: new Date(primary.created_at) <= new Date(duplicate.created_at) ? primary.created_at : duplicate.created_at,
    updated_at: new Date().toISOString(),
  };
  // A terminal state on either side wins — a merge must never resurrect
  // someone who unsubscribed or quietly un-pay a customer.
  const TERMINAL = ["paid", "unsubscribed", "lost"];
  if (TERMINAL.includes(duplicate.status) && !TERMINAL.includes(primary.status)) patch.status = duplicate.status;

  await sb(`bilabs_leads?id=eq.${primaryId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch),
  });

  for (const table of ["bilabs_evaluations", "bilabs_events", "bilabs_followups", "bilabs_payments", "bilabs_subscriptions", "bilabs_visitors", "bilabs_email_log"]) {
    await sb(`${table}?contact_id=eq.${duplicateId}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ contact_id: primaryId }),
    });
  }
  await sb(`bilabs_lead_events?lead_id=eq.${duplicateId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lead_id: primaryId }),
  });

  await sb(`bilabs_leads?id=eq.${duplicateId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ merged_into: primaryId, updated_at: new Date().toISOString() }),
  });

  await audit(admin, "lead.merge", { type: "lead", id: primaryId }, { mergedId: duplicateId });
  return NextResponse.json({ ok: true, note: "The duplicate is hidden and repointed, not deleted — the merge can be undone." });
}
