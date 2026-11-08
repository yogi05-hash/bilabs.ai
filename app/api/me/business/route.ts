import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customerAuth";
import { publicBusiness, updateBusiness, type Business } from "@/lib/businesses";
import { sanitiseBusinessPatch } from "@/lib/businessForm";
import { recordEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The customer's own business row.
 *
 * PATCH is the setup wizard and the later profile edits. The body carries the
 * fields plus an optional `step` (1 confirm, 2 models, 3 details) which
 * stamps progress; only lib/businessForm decides what is written, so Stripe
 * ids and status can never arrive from the browser. */

export async function GET(req: NextRequest) {
  const c = await requireCustomer(req);
  if (!c) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  return NextResponse.json({ business: c.business ? publicBusiness(c.business) : null });
}

export async function PATCH(req: NextRequest) {
  const c = await requireCustomer(req);
  if (!c) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const b = c.business;
  if (!b) return NextResponse.json({ error: "No business is set up for this account yet — email hello@bilabs.ai." }, { status: 409 });
  if (b.status === "cancelled") return NextResponse.json({ error: "This subscription has ended." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const s = sanitiseBusinessPatch(body);
  if (!s.ok) return NextResponse.json({ error: s.error }, { status: 400 });

  const patch: Partial<Business> = { ...s.patch };
  const step = typeof body.step === "number" ? body.step : null;
  const now = new Date().toISOString();

  if (step === 1) {
    if (body.confirm !== true) return NextResponse.json({ error: "Please confirm this is your business." }, { status: 400 });
    patch.confirmed_at = b.confirmed_at ?? now;
    patch.onboarding_step = Math.max(b.onboarding_step, 1);
  } else if (step === 2) {
    if (!patch.target_models && !b.target_models?.length) return NextResponse.json({ error: "Choose at least one assistant." }, { status: 400 });
    patch.onboarding_step = Math.max(b.onboarding_step, 2);
  } else if (step === 3) {
    patch.details_completed_at = b.details_completed_at ?? now;
    patch.onboarding_step = Math.max(b.onboarding_step, 3);
  }

  const updated = await updateBusiness(b.id, patch);
  if (!updated) return NextResponse.json({ error: "Could not save just now." }, { status: 500 });

  if (step === 3 && !b.details_completed_at) {
    await recordEvent({
      name: "business_onboarded",
      origin: "server",
      contactId: b.contact_id,
      dedupeKey: `business_onboarded:${b.id}`,
      props: { models: updated.target_models },
      isTest: b.is_test,
    });
  }
  return NextResponse.json({ business: publicBusiness(updated) });
}
