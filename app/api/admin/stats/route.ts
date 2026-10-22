import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/adminAuth";
import { sb, type Lead } from "@/lib/leads";

/* MRR comes from Stripe's live subscriptions, not from counting our own rows
 * — our table knows who we think paid, Stripe knows who actually is. */
async function mrrFromStripe(): Promise<{ mrr: number; active: number } | null> {
  const key = env("STRIPE_SECRET_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://api.stripe.com/v1/subscriptions?status=active&limit=100", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const d = await res.json();
    let pence = 0;
    for (const s of d.data ?? []) {
      for (const item of s.items?.data ?? []) {
        const p = item.price;
        if (!p?.recurring) continue;
        const amount = (p.unit_amount ?? 0) * (item.quantity ?? 1);
        pence += p.recurring.interval === "year" ? Math.round(amount / 12) : amount;
      }
    }
    return { mrr: pence / 100, active: (d.data ?? []).length };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const leads = (await sb<Lead[]>("bilabs_leads?select=created_at,source,status&limit=5000")) ?? [];
  const now = Date.now();
  const since = (d: number) => leads.filter((l) => now - new Date(l.created_at).getTime() < d * 86_400_000).length;

  const stripe = await mrrFromStripe();

  return NextResponse.json({
    today: since(1),
    week: since(7),
    checks: leads.filter((l) => l.source === "check").length,
    paid: leads.filter((l) => l.status === "paid").length,
    nurturing: leads.filter((l) => l.status === "nurturing").length,
    total: leads.length,
    mrr: stripe?.mrr ?? null,
    activeSubs: stripe?.active ?? null,
  });
}
