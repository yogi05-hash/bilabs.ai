import { sb, type Lead } from "@/lib/leads";
import { type Business, updateBusiness } from "@/lib/businesses";
import { sendSetupReminder } from "@/lib/customerMail";

/* Chasing a paying customer who has not finished setting up.
 *
 * Someone who pays and stops at step one has bought nothing yet: no profile
 * is published and no check runs until they press Publish. Four reminders,
 * each with a fresh sign-in link and the exact step they stopped at, then we
 * leave them alone — the admin overview still flags them. Runs from the
 * daily check cron; never touches test rows or test contacts. */

export const NUDGES = [
  { step: 1, day: 1 },
  { step: 2, day: 3 },
  { step: 3, day: 7 },
  { step: 4, day: 14 },
] as const;

const days = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;

export async function sendSetupNudges(): Promise<{ considered: number; sent: number }> {
  const rows =
    (await sb<Business[]>(
      `bilabs_businesses?status=eq.onboarding&is_test=is.false&setup_nudge_step=lt.${NUDGES.length}&order=created_at.asc&limit=100`,
    )) ?? [];

  let sent = 0;
  for (const b of rows) {
    const next = NUDGES.find((n) => n.step > (b.setup_nudge_step ?? 0));
    if (!next) continue;
    if (days(b.created_at) < next.day) continue;
    // never two in one day, whatever the schedule says
    if (b.setup_nudged_at && days(b.setup_nudged_at) < 0.9) continue;

    const leads = await sb<Lead[]>(`bilabs_leads?id=eq.${b.contact_id}&limit=1`);
    const lead = leads?.[0];
    // a contact that cannot be mailed still advances, so it is not retried daily
    const ok = lead?.email && !lead.is_test ? await sendSetupReminder(lead, b, next.step) : false;
    await updateBusiness(b.id, { setup_nudge_step: next.step, setup_nudged_at: new Date().toISOString() });
    if (ok) sent++;
  }
  return { considered: rows.length, sent };
}
