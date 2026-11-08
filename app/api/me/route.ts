import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customerAuth";
import { publicBusiness } from "@/lib/businesses";
import { listChecks, openCheckFor } from "@/lib/checks";
import { enabledProviders, PROVIDER_IDS, PROVIDERS } from "@/lib/providers";
import { sb } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Everything the dashboard needs on load, in one call. Stripe ids and
 * internal bookkeeping never leave the server. */
export async function GET(req: NextRequest) {
  const c = await requireCustomer(req);
  if (!c) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const business = c.business;
  const [checks, open, subs] = await Promise.all([
    business ? listChecks(business.id, 12) : Promise.resolve([]),
    business ? openCheckFor(business.id) : Promise.resolve(null),
    sb<{ status: string; plan: string | null; current_period_end: string | null; cancel_at_period_end: boolean }[]>(
      `bilabs_subscriptions?contact_id=eq.${c.contactId}&order=updated_at.desc&limit=1&select=status,plan,current_period_end,cancel_at_period_end`,
    ),
  ]);

  const latest = checks.find((k) => k.status === "completed") ?? null;
  return NextResponse.json({
    email: c.email,
    name: c.lead.name,
    business: business ? publicBusiness(business) : null,
    subscription: subs?.[0] ?? null,
    latestCheck: latest,
    openCheck: open,
    checks: checks.map((k) => ({ ...k, questions: undefined })),
    providers: PROVIDER_IDS.map((id) => ({ id, label: PROVIDERS[id].label, enabled: enabledProviders().includes(id) })),
  });
}
