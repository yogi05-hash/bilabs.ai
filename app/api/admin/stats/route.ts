import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { bilabsSubscriptions, mrrFrom } from "@/lib/billing";
import { sb, type Lead } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The original summary strip, kept working and corrected.
 *
 * Two bugs lived here and both produced the contradictions on the old
 * dashboard:
 *
 *  1. "Checks run" counted leads whose `source` equalled the literal
 *     "check". No row has ever held that value — the real ones are
 *     "ai-check", "ai-check-unlock" and "visibility-report" — so the figure
 *     was structurally always zero while check-sourced leads sat in the
 *     table beneath it. Checks are now counted from bilabs_evaluations,
 *     which is the thing that actually records a run.
 *
 *  2. MRR and "active subscribers" summed EVERY active subscription in the
 *     Stripe account. That account is shared with several other products,
 *     so the figures shown on the BiLabs admin were other products'
 *     customers — which is why "Paid: 0" sat next to a non-zero MRR. Both
 *     are now scoped to the two BiLabs products.
 */

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const leads = (await sb<Lead[]>("bilabs_leads?select=created_at,status&merged_into=is.null&limit=5000")) ?? [];
  const now = Date.now();
  const since = (d: number) => leads.filter((l) => now - new Date(l.created_at).getTime() < d * 86_400_000).length;

  const evals = (await sb<{ status: string }[]>("bilabs_evaluations?is_test=is.false&select=status&limit=5000")) ?? [];
  const subs = await bilabsSubscriptions();
  const mrr = subs ? mrrFrom(subs) : null;

  return NextResponse.json({
    today: since(1),
    week: since(7),
    checks: evals.length,
    checksCompleted: evals.filter((e) => e.status === "completed").length,
    paid: leads.filter((l) => l.status === "paid").length,
    nurturing: leads.filter((l) => l.status === "nurturing").length,
    total: leads.length,
    // null, not 0, when Stripe is unreachable — unknown is not zero
    mrr: mrr ? (mrr.gbpOnly !== null ? mrr.gbpOnly / 100 : null) : null,
    mrrMixedCurrency: mrr ? mrr.gbpOnly === null && mrr.currencies.length > 1 : false,
    activeSubs: mrr?.activeCount ?? null,
    scope: "BiLabs products only — this Stripe account is shared with other products.",
  });
}
