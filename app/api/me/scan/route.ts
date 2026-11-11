import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customerAuth";
import { publicBusiness, updateBusiness } from "@/lib/businesses";
import { normaliseWebsite } from "@/lib/businessForm";
import { extractFromWebsite, mergeExtracted } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* "Read my website and fill the form in."
 *
 * Fetches the customer's own site, extracts the facts with the model, and
 * writes them into the blanks of their business row — never over anything
 * they typed. Returns which fields were filled so the wizard can say so.
 * A few runs an hour per business is plenty; each costs a model call. */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 6;
const runs = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  const c = await requireCustomer(req);
  if (!c) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const b = c.business;
  if (!b) return NextResponse.json({ error: "No business is set up for this account yet." }, { status: 409 });
  if (b.status === "cancelled") return NextResponse.json({ error: "This subscription has ended." }, { status: 403 });

  const now = Date.now();
  const recent = (runs.get(b.id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return NextResponse.json({ error: "You've read your website a few times already this hour. Edit the form directly, or try again later." }, { status: 429 });
  }
  runs.set(b.id, [...recent, now]);

  const body = (await req.json().catch(() => ({}))) as { website?: unknown };
  let website = b.website;
  if (typeof body.website === "string" && body.website.trim()) {
    const w = normaliseWebsite(body.website);
    if (!w) return NextResponse.json({ error: "That website address does not look right." }, { status: 400 });
    website = w;
  }
  if (!website) return NextResponse.json({ error: "Add your website address first." }, { status: 400 });

  const ex = await extractFromWebsite(website);
  if (!ex.ok) {
    if (website !== b.website) await updateBusiness(b.id, { website });
    return NextResponse.json({ error: ex.error, pages: ex.pages }, { status: 422 });
  }

  const { patch, filled } = mergeExtracted(b, ex.raw);
  if (website !== b.website) patch.website = website;
  const updated = Object.keys(patch).length ? await updateBusiness(b.id, patch) : b;
  if (!updated) return NextResponse.json({ error: "Could not save just now." }, { status: 500 });

  return NextResponse.json({ business: publicBusiness(updated), filled, pages: ex.pages });
}
