/* Contact enrichment: what a business publishes about itself, copied.
 *
 * The rule the whole file obeys: NEVER GUESS. Everything returned here was
 * found verbatim on the business's own pages — a tel: link, a mailto:, a
 * schema.org address, a visible phone number. If a site publishes nothing,
 * the result is empty arrays, not a best effort. These details exist so a
 * human can make one personal call or email; they are never fed into
 * marketing sequences, which require consent this data does not carry.
 */

export type Contact = {
  phones: string[];
  emails: string[];
  address: string | null;
  socials: string[];
  title: string | null;
};

export const EMPTY_CONTACT: Contact = { phones: [], emails: [], address: null, socials: [], title: null };

const strip = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

/** Normalise a phone string for dedupe. UK numbers appear in both national
 *  (020...) and international (+4420...) forms on the same page — those are
 *  the same phone and must not count twice. */
function phoneKey(raw: string): string {
  let d = raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (d.startsWith("+44")) d = "0" + d.slice(3);
  else if (d.startsWith("44") && d.length >= 12) d = "0" + d.slice(2);
  return d;
}

/** Keep numbers that look like real dialable numbers, not prices or years. */
function plausiblePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 14) return false;
  // a year range like 2020-2026 or an IP fragment is not a phone number
  if (/^(19|20)\d{2}$/.test(digits.slice(0, 4)) && digits.length <= 10) return false;
  return true;
}

/* Visible-text phone matcher, deliberately conservative: UK formats
 * (01/02/03/07/08 + spacing) and full international +.. forms. A bare run of
 * digits does not qualify — that is how prices and order numbers get scraped
 * by accident. */
const PHONE_RE = /(?:\+\d{1,3}[\s().-]?)?(?:\(?0\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/g;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/* Things the email regex matches that are not addresses: filenames exported
 * from design tools (logo@2x.png), package specifiers, obfuscation stubs. */
const FAKE_EMAIL =
  /\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?)$|@(2x|3x)\b|example\.(com|org|net)$|sentry|wixpress|cloudfront/i;

const SOCIAL_RE =
  /https?:\/\/(?:www\.)?(?:facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|youtube\.com|tiktok\.com)\/[^\s"'<>)]+/gi;

function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* malformed JSON-LD is common; skip it */
    }
  }
  return out;
}

/** Depth-first hunt for a schema.org PostalAddress anywhere in the JSON-LD. */
function findAddress(node: unknown, depth = 0): string | null {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findAddress(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  const type = String(o["@type"] ?? "");
  if (/PostalAddress/i.test(type) || (o.streetAddress && (o.addressLocality || o.postalCode))) {
    const parts = [o.streetAddress, o.addressLocality, o.addressRegion, o.postalCode]
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter(Boolean);
    if (parts.length >= 2) return parts.join(", ").slice(0, 200);
  }
  for (const v of Object.values(o)) {
    const hit = findAddress(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/** Extract published contact details from one page's HTML. Pure function. */
export function extractContact(html: string): Contact {
  if (!html) return { ...EMPTY_CONTACT };
  const text = strip(html);

  /* -------- phones: tel: links are explicit intent, text matches second */
  const phones = new Map<string, string>(); // key -> display form
  for (const m of html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) {
    const display = decodeURIComponent(m[1]).trim().slice(0, 25);
    if (plausiblePhone(display)) phones.set(phoneKey(display), display);
  }
  if (phones.size < 2) {
    for (const m of text.matchAll(PHONE_RE)) {
      const display = m[0].trim().slice(0, 25);
      const key = phoneKey(display);
      if (plausiblePhone(display) && !phones.has(key)) phones.set(key, display);
      if (phones.size >= 3) break;
    }
  }

  /* -------- emails: mailto: first, visible text second */
  const emails = new Set<string>();
  for (const m of html.matchAll(/href\s*=\s*["']mailto:([^"'?]+)/gi)) {
    const e = decodeURIComponent(m[1]).trim().toLowerCase();
    if (e.includes("@") && !FAKE_EMAIL.test(e)) emails.add(e.slice(0, 120));
  }
  for (const m of text.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase();
    if (!FAKE_EMAIL.test(e)) emails.add(e.slice(0, 120));
    if (emails.size >= 3) break;
  }

  /* -------- address: schema.org, else a literal <address> element */
  let address = findAddress(jsonLdBlocks(html));
  if (!address) {
    const m = /<address[^>]*>([\s\S]*?)<\/address>/i.exec(html);
    if (m) {
      const a = strip(m[1]).trim();
      if (a.length > 8) address = a.slice(0, 200);
    }
  }

  /* -------- socials, deduped by host+path root */
  const socials = new Set<string>();
  for (const m of html.matchAll(SOCIAL_RE)) {
    const url = m[0].replace(/[),.]+$/, "");
    // profile/share widgets, intent links and tracking pixels are not the
    // business's own page
    if (/\/(sharer|share|intent|plugins|embed|tr)\b/i.test(url) || /\/tr\?/i.test(url)) continue;
    socials.add(url.slice(0, 160));
    if (socials.size >= 5) break;
  }

  /* -------- title: og:site_name beats <title>, which carries slogans */
  let title: string | null = null;
  const og = /property\s*=\s*["']og:site_name["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(html)
    ?? /content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:site_name["']/i.exec(html);
  if (og) title = og[1].trim().slice(0, 120);
  if (!title) {
    const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (t) title = strip(t[1]).trim().slice(0, 120) || null;
  }

  return {
    phones: Array.from(phones.values()).slice(0, 3),
    emails: Array.from(emails).slice(0, 3),
    address,
    socials: Array.from(socials),
    title,
  };
}

function merge(a: Contact, b: Contact): Contact {
  const phones = new Map<string, string>();
  for (const p of [...a.phones, ...b.phones]) if (!phones.has(phoneKey(p))) phones.set(phoneKey(p), p);
  return {
    phones: Array.from(phones.values()).slice(0, 3),
    emails: Array.from(new Set([...a.emails, ...b.emails])).slice(0, 3),
    address: a.address ?? b.address,
    socials: Array.from(new Set([...a.socials, ...b.socials])).slice(0, 5),
    title: a.title ?? b.title,
  };
}

const UA = "Mozilla/5.0 (compatible; BiLabsCheck/1.0; +https://bilabs.ai)";

async function page(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return "";
    return (await res.text()).slice(0, 500_000);
  } catch {
    return "";
  }
}

/** Enrich from the homepage HTML the scan already fetched, plus one contact
 *  page if the site has an obvious one. Best-effort: failures return what was
 *  found so far, never throw. */
export async function enrichSite(siteUrl: string, homepageHtml: string): Promise<Contact> {
  let contact = extractContact(homepageHtml);

  try {
    const base = new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`);
    // prefer a contact link the homepage itself declares, else the usual paths
    const declared = /href\s*=\s*["']([^"']*contact[^"']*)["']/i.exec(homepageHtml)?.[1];
    const candidates = [declared, "/contact", "/contact-us"]
      .filter((p): p is string => Boolean(p))
      .map((p) => { try { return new URL(p, base).toString(); } catch { return null; } })
      .filter((u): u is string => Boolean(u) && new URL(u!).hostname === base.hostname);

    for (const u of Array.from(new Set(candidates)).slice(0, 2)) {
      const html = await page(u);
      if (!html) continue;
      contact = merge(contact, extractContact(html));
      // one good contact page is enough
      if (contact.phones.length && contact.emails.length) break;
    }
  } catch {
    /* bad URL or unreachable contact page — keep the homepage findings */
  }
  return contact;
}
