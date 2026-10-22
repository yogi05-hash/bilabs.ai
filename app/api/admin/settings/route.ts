import { NextRequest, NextResponse } from "next/server";
import { adminEmails, requireAdmin, requireOwner, type Role } from "@/lib/adminAuth";
import { audit, getSettings, saveSettings } from "@/lib/admin";
import { hashIp } from "@/lib/analytics";
import { env } from "@/lib/env";
import { bilabsProductIds } from "@/lib/billing";
import { sb } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Settings, roles, integration health and retention.
 *
 * Integration health reports whether a credential is PRESENT and WORKS. It
 * never returns the value, a prefix, or a length — a dashboard that shows you
 * the first eight characters of a secret is a dashboard that leaks secrets to
 * anyone who gets a screenshot. */

async function health() {
  const checks: Array<{ id: string; label: string; configured: boolean; ok: boolean | null; detail: string }> = [];

  const supabase = Boolean(env("NEXT_PUBLIC_SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
  let supabaseOk: boolean | null = null;
  if (supabase) supabaseOk = (await sb("bilabs_settings?select=key&limit=1")) !== null;
  checks.push({
    id: "supabase", label: "Supabase", configured: supabase, ok: supabaseOk,
    detail: supabaseOk ? "Reachable; service-role read succeeded." : supabase ? "Configured but the test read failed." : "Not configured.",
  });

  const stripeKey = Boolean(env("STRIPE_SECRET_KEY"));
  let stripeOk: boolean | null = null;
  let products: string[] = [];
  if (stripeKey) {
    products = await bilabsProductIds();
    stripeOk = products.length > 0;
  }
  checks.push({
    id: "stripe", label: "Stripe", configured: stripeKey, ok: stripeOk,
    detail: stripeOk
      ? `Live. Scoped to ${products.length} BiLabs product(s); this account also carries other products, which are excluded.`
      : stripeKey ? "Key present but the BiLabs product ids could not be resolved." : "Not configured.",
  });

  checks.push({
    id: "stripe_webhook", label: "Stripe webhook", configured: Boolean(env("STRIPE_WEBHOOK_SECRET")),
    ok: Boolean(env("STRIPE_WEBHOOK_SECRET")),
    detail: env("STRIPE_WEBHOOK_SECRET")
      ? "Signing secret present. Events are verified, deduplicated by event id and filtered to BiLabs products."
      : "Missing — the webhook will reject everything with a 503.",
  });

  const resend = Boolean(env("RESEND_API_KEY"));
  let resendOk: boolean | null = null;
  if (resend) {
    try {
      const r = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}` },
        cache: "no-store",
      });
      resendOk = r.ok;
    } catch { resendOk = false; }
  }
  checks.push({
    id: "resend", label: "Resend", configured: resend, ok: resendOk,
    detail: resendOk ? "Authenticated." : resend ? "Key present but the API rejected it." : "Not configured.",
  });

  checks.push({
    id: "anthropic", label: "Anthropic (free check)", configured: Boolean(env("ANTHROPIC_API_KEY")), ok: null,
    detail: env("ANTHROPIC_API_KEY")
      ? "Key present. Not test-called here — every call costs money, so health is inferred from evaluation failures instead."
      : "Not configured — the free check will return 503.",
  });

  return checks;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const [settings, integrations, admins] = await Promise.all([
    getSettings(),
    health(),
    sb<{ email: string; role: string; last_login_at: string | null }[]>(
      "bilabs_admins?select=email,role,last_login_at&order=email.asc",
    ),
  ]);

  const audits =
    (await sb<{ actor: string; action: string; target_type: string | null; target_id: string | null; detail: unknown; created_at: string }[]>(
      "bilabs_audit_log?order=created_at.desc&limit=100&select=actor,action,target_type,target_id,detail,created_at",
    )) ?? [];

  return NextResponse.json({
    settings,
    integrations,
    admins: admins ?? [],
    allowlist: adminEmails(),
    auditLog: audits,
    role: admin.role,
    notes: {
      allowlist:
        "ADMIN_EMAILS is the gate: an address must be on it to sign in at all. Roles below only shape what a signed-in admin may do.",
      roles:
        "owner — everything, including roles, retention and deletion. admin — may edit contacts, follow-ups and retry checks. readonly — may see everything and change nothing.",
      secrets: "Credentials are server-side only. This page reports whether each one works, never what it is.",
      retention:
        "Retention applies to raw visitor and event rows. Contacts, evaluations and payments are business records and are not purged by it.",
    },
  });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireOwner(req);
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  if (typeof body?.respectDnt === "boolean") patch.respectDnt = body.respectDnt;
  if (typeof body?.attributionWindowDays === "number") {
    patch.attributionWindowDays = Math.min(180, Math.max(1, Math.round(body.attributionWindowDays)));
  }
  if (typeof body?.retentionDays === "number") {
    patch.retentionDays = Math.min(3650, Math.max(0, Math.round(body.retentionDays)));
  }
  if (body?.notify && typeof body.notify === "object") patch.notify = body.notify;

  // Internal exclusions are given as plain addresses and stored only as
  // salted hashes, so the settings row never holds anyone's IP.
  if (Array.isArray(body?.internalIps)) {
    patch.internalIpHashes = (body.internalIps as unknown[])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, 50)
      .map((ip) => hashIp(ip.trim()));
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const next = await saveSettings(admin, patch);
  return NextResponse.json({ ok: true, settings: next });
}

/** Change an admin's role. Owner-only, and an owner cannot demote themselves
 *  — losing the last owner would lock the settings page for everyone. */
export async function POST(req: NextRequest) {
  const guard = await requireOwner(req);
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role as Role;
  if (!email || !["owner", "admin", "readonly"].includes(role)) {
    return NextResponse.json({ error: "Give an email and a role of owner, admin or readonly." }, { status: 400 });
  }
  if (!adminEmails().includes(email)) {
    return NextResponse.json(
      { error: "That address is not on ADMIN_EMAILS, so it cannot sign in. Add it there first." },
      { status: 422 },
    );
  }
  if (email === admin.email && role !== "owner") {
    return NextResponse.json({ error: "You cannot remove your own owner access." }, { status: 422 });
  }
  if (role !== "owner") {
    const owners = await sb<{ email: string }[]>("bilabs_admins?role=eq.owner&select=email");
    const remaining = (owners ?? []).filter((o) => o.email !== email);
    if (!remaining.length) {
      return NextResponse.json({ error: "That would leave no owner." }, { status: 422 });
    }
  }

  await sb("bilabs_admins", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify({ email, role }),
  });
  await audit(admin, "admin.role", { type: "admin", id: email }, { role });
  return NextResponse.json({ ok: true });
}
