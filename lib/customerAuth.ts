import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getLeadByEmail, sb, type Lead } from "@/lib/leads";
import { makeToken, readToken } from "@/lib/signedToken";
import { getBusinessByContact, type Business } from "@/lib/businesses";

/* Customer access, by the same magic link the admin uses.
 *
 * No passwords and no third-party auth: the link is signed here and sent
 * through Resend, exactly as lib/adminAuth.ts does, with its own cookie and
 * its own token kinds so a customer session can never be read as an admin
 * one. Eligibility is re-checked on every request, so a lapsed subscription
 * loses the dashboard at its next call rather than at cookie expiry.
 *
 * Who counts as a customer: a contact with a business row (created the
 * moment a BiLabs checkout completes), or failing that a paying subscription
 * or a lead the verified webhook marked paid. */

export const COOKIE = "bl_cust";
const LINK_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const secret = () => env("CUSTOMER_SESSION_SECRET") || env("ADMIN_SESSION_SECRET");

export const makeCustomerLink = (email: string) => makeToken(secret(), "cust-link", email, LINK_TTL_MS);
export const readCustomerLink = (token: string) => readToken(secret(), "cust-link", token);
export const makeCustomerSession = (email: string) => makeToken(secret(), "cust-session", email, SESSION_TTL_MS);

export type Customer = { email: string; contactId: string; lead: Lead; business: Business | null };

/** The customer behind an email address, or null if that address has nothing
 *  to sign in to. Follows a merged lead to the row that survived the merge. */
export async function customerFor(emailRaw: string): Promise<Customer | null> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return null;
  let lead = await getLeadByEmail(email);
  if (lead?.merged_into) {
    const rows = await sb<Lead[]>(`bilabs_leads?id=eq.${lead.merged_into}&limit=1`);
    lead = rows?.[0] ?? null;
  }
  if (!lead || !lead.email) return null;

  const business = await getBusinessByContact(lead.id);
  if (business) return { email: lead.email.toLowerCase(), contactId: lead.id, lead, business };

  if (lead.status === "paid") return { email: lead.email.toLowerCase(), contactId: lead.id, lead, business: null };

  const subs = await sb<{ id: string }[]>(
    `bilabs_subscriptions?contact_id=eq.${lead.id}&status=in.(active,trialing,past_due)&select=id&limit=1`,
  );
  if (subs?.length) return { email: lead.email.toLowerCase(), contactId: lead.id, lead, business: null };
  return null;
}

/** The only way in. Reads the signed cookie and re-checks eligibility. */
export async function requireCustomer(req: NextRequest): Promise<Customer | null> {
  const raw = req.cookies.get(COOKIE)?.value ?? "";
  const email = readToken(secret(), "cust-session", raw);
  if (!email) return null;
  return customerFor(email);
}

/** A sign-in link straight into the dashboard, good for fifteen minutes. */
export function customerLoginUrl(email: string, next = "/dashboard"): string {
  const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
  const p = new URLSearchParams({ token: makeCustomerLink(email), next: safeNext(next) });
  return `${site}/api/me/callback?${p.toString()}`;
}

/** Only our own dashboard paths are valid redirect targets. */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/dashboard(\/|\?|#|$)/.test(next) && !next.startsWith("//") ? next.slice(0, 200) : "/dashboard";
}
