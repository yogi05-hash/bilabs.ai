import { revalidatePath } from "next/cache";
import { sb, type Lead } from "@/lib/leads";
import { recordEvent } from "@/lib/analytics";
import { getBusiness, updateBusiness, type Business } from "@/lib/businesses";
import { uniqueSlug } from "@/lib/slug";
import { profileUrl } from "@/lib/profile";
import { pingIndexNow } from "@/lib/indexnow";
import { enqueueCheck, nextCheckDate } from "@/lib/checks";
import { sendLive } from "@/lib/customerMail";

/* Publishing: the step that turns a filled-in business into a live profile.
 *
 * Order matters and is deliberate:
 *   validate → slug → mark published → revalidate the page → tell the index
 *   → queue the first check → tell the customer.
 * Everything after "mark published" is best-effort and recorded, so a
 * failed IndexNow ping or email leaves a published profile with a note in
 * last_error rather than an unpublished one with no explanation. */

export type PublishErrors = Record<string, string>;

export function validateForPublish(b: Business, opts: { force?: boolean } = {}): { ok: true } | { ok: false; errors: PublishErrors } {
  const errors: PublishErrors = {};
  if (!b.name) errors.name = "Your business needs a name.";
  if (!b.business_type) errors.business_type = "Tell us what the business does.";
  if (!b.area) errors.area = "Tell us where the business is.";
  if (!opts.force) {
    if (!b.description || b.description.length < 40) errors.description = "A short description (at least 40 characters) helps assistants understand what you do.";
    if (!b.services?.length) errors.services = "Add at least one service.";
  }
  if (!b.target_models?.length) errors.target_models = "Choose at least one assistant to monitor.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

export type PublishResult =
  | { ok: true; url: string; firstPublish: boolean; checkId: string | null; business: Business }
  | { ok: false; status: number; errors: PublishErrors };

export async function publishBusiness(id: string, opts: { by: string; force?: boolean }): Promise<PublishResult> {
  const b = await getBusiness(id);
  if (!b) return { ok: false, status: 404, errors: { business: "Not found." } };
  if (b.status === "cancelled") return { ok: false, status: 409, errors: { status: "This subscription has ended, so the profile cannot be published." } };
  if (b.status === "paused") return { ok: false, status: 409, errors: { status: "This profile is paused. Check your billing, or contact us." } };

  const v = validateForPublish(b, { force: opts.force });
  if (!v.ok) return { ok: false, status: 422, errors: v.errors };

  const now = new Date().toISOString();
  const firstPublish = !b.published_at;
  const slug = b.slug ?? (await uniqueSlug(b.name!, b.area));

  const updated = await updateBusiness(id, {
    slug,
    status: firstPublish ? "processing" : b.status,
    published_at: b.published_at ?? now,
    republished_at: now,
    details_completed_at: b.details_completed_at ?? now,
    onboarding_step: Math.max(b.onboarding_step ?? 0, 3),
    last_error: null,
    ...(firstPublish ? { next_check_at: nextCheckDate() } : {}),
  });
  if (!updated) return { ok: false, status: 500, errors: { business: "Could not save the profile." } };

  const url = profileUrl(updated);
  const notes: string[] = [];

  // The profile page is cached for ten minutes; a publish must show at once.
  try {
    revalidatePath(`/b/${slug}`);
    revalidatePath(`/b/${slug}/llms.txt`);
    revalidatePath("/sitemap.xml");
  } catch (e) {
    notes.push(`revalidate: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Test rows (Stripe test mode, flow tests) never announce themselves to
  // the index — the URL would be a production 404.
  const pinged = updated.is_test
    ? false
    : await pingIndexNow([url, `${url}/llms.txt`, `${profileUrl({ slug: "" }).replace(/\/b\/$/, "")}/sitemap.xml`]);
  if (pinged) await updateBusiness(id, { indexnow_pinged_at: new Date().toISOString() });
  else if (!updated.is_test) notes.push("IndexNow ping not sent");

  await recordEvent({
    name: "profile_published",
    origin: "server",
    contactId: updated.contact_id,
    dedupeKey: `profile_published:${id}:${now}`,
    props: { first: firstPublish, slug, by: opts.by },
    isTest: updated.is_test,
  });

  let checkId: string | null = null;
  if (firstPublish) {
    const check = await enqueueCheck(id, "first", opts.by);
    checkId = check?.id ?? null;
    if (!checkId) notes.push("first check not queued (one already open)");

    try {
      const leads = await sb<Lead[]>(`bilabs_leads?id=eq.${updated.contact_id}&limit=1`);
      if (leads?.[0]) await sendLive(leads[0], updated);
    } catch (e) {
      notes.push(`live email: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (notes.length) await updateBusiness(id, { last_error: notes.join(" · ").slice(0, 300) });

  return { ok: true, url, firstPublish, checkId, business: updated };
}
