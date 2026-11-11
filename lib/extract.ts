import { env } from "@/lib/env";
import { PROVIDERS } from "@/lib/providers";
import { sanitiseBusinessPatch, type Patch } from "@/lib/businessForm";
import type { Business } from "@/lib/businesses";

/* Reading a business's own website and filling the setup form from it.
 *
 * The owner types a web address; we fetch the homepage and the handful of
 * pages that usually carry the facts (about, services, prices, contact,
 * FAQ, hours), hand the text to Claude with a strict schema, and get back
 * only what the site actually says. Nothing is invented: a field the site
 * does not state comes back empty and the owner fills it in. Everything
 * returned goes through the same sanitiser as the form, so the model cannot
 * write anything the owner could not. */

const UA = "Mozilla/5.0 (compatible; BiLabsCheck/1.0; +https://bilabs.ai)";
const PAGE_CHARS = 7_000;
const TOTAL_CHARS = 30_000;
const EXTRA_PAGES = 5;
const WANTED = /about|service|what-we-do|treatment|menu|price|pricing|cost|fee|contact|find-us|location|hours|opening|faq|question|book/i;

export type SiteText = { url: string; text: string }[];

const decode = (t: string) =>
  t.replace(/&amp;/g, "&").replace(/&#0?39;|&apos;|&#x27;/gi, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Visible text, roughly in reading order, with block boundaries kept as line breaks. */
export function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/footer|\/dd|\/dt)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok || !/text\/html|xhtml/i.test(res.headers.get("content-type") ?? "text/html")) return "";
    return (await res.text()).slice(0, 600_000);
  } catch {
    return "";
  }
}

/** Internal links on the homepage that look like they carry facts. */
export function candidateLinks(homepageHtml: string, base: URL): string[] {
  const out = new Map<string, number>();
  const re = /href\s*=\s*["']([^"'#?]+)[^"']*["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(homepageHtml))) {
    let u: URL;
    try { u = new URL(m[1], base); } catch { continue; }
    if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    if (/\.(pdf|jpe?g|png|gif|svg|webp|mp4|zip|docx?)$/i.test(u.pathname)) continue;
    const path = u.pathname.replace(/\/+$/, "");
    if (!path || path === base.pathname.replace(/\/+$/, "")) continue;
    if (!WANTED.test(path)) continue;
    // shorter paths are usually the real section pages, not blog posts
    const score = path.split("/").length * 10 + path.length;
    const key = `${u.origin}${path}`;
    if (!out.has(key) || out.get(key)! > score) out.set(key, score);
  }
  return Array.from(out.entries()).sort((a, b) => a[1] - b[1]).map(([k]) => k).slice(0, EXTRA_PAGES);
}

export async function readSite(website: string): Promise<SiteText> {
  const base = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
  const home = await fetchPage(base.toString());
  if (!home) return [];
  const pages: SiteText = [{ url: base.toString(), text: htmlToText(home).slice(0, PAGE_CHARS) }];
  const links = candidateLinks(home, base);
  const extra = await Promise.all(links.map(async (u) => ({ url: u, text: htmlToText(await fetchPage(u)).slice(0, PAGE_CHARS) })));
  for (const p of extra) if (p.text.length > 200) pages.push(p);
  let budget = TOTAL_CHARS;
  return pages
    .map((p) => { const text = p.text.slice(0, Math.max(0, budget)); budget -= text.length; return { ...p, text }; })
    .filter((p) => p.text.length > 0);
}

/* ------------------------------------------------------------- the model */

const TOOL = {
  name: "business_profile",
  description: "The facts about this business that its own website states. Leave out anything the pages do not say.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: "string", description: "The trading name, without slogans" },
      business_type: { type: "string", description: "What it is, in two or three plain words a customer would search for, e.g. 'dentist', 'plumber', 'film streaming service'" },
      area: { type: "string", description: "The town or city it serves or is based in, if stated" },
      postcode: { type: "string", description: "UK postcode if stated" },
      address: { type: "string", description: "Street address on one line, if stated" },
      description: { type: "string", description: "Two to four plain sentences, 150-600 characters, describing who they help, with what, and where — written from the site's own facts, no marketing adjectives" },
      phone: { type: "string" },
      email: { type: "string" },
      services: {
        type: "array",
        description: "Services, products or offerings the site names. Up to 20. A streaming service's 'services' are what it offers (e.g. 'Independent films on demand').",
        items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, price: { type: "string", description: "as written on the site, e.g. '£65' or 'from £30'" } }, required: ["name"] },
      },
      hours: {
        type: "array",
        description: "Opening hours ONLY if the site states them. 24-hour HH:MM.",
        items: {
          type: "object",
          properties: { day: { type: "string", enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] }, open: { type: "string" }, close: { type: "string" }, closed: { type: "boolean" } },
          required: ["day"],
        },
      },
      prices: { type: "array", description: "A price list if the site has one, up to 20 items", items: { type: "object", properties: { item: { type: "string" }, price: { type: "string" } }, required: ["item", "price"] } },
      faqs: { type: "array", description: "Questions and answers the site itself poses, or clear factual answers to the questions customers obviously ask (parking, booking, emergencies, areas covered). Up to 8. Answers must come from the site.", items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"] } },
      areas: { type: "array", description: "Named places served, if stated", items: { type: "string" } },
      socials: { type: "array", description: "Full https URLs of the business's own social or listing profiles", items: { type: "string" } },
    },
  },
};

const SYSTEM = `You extract facts about a business from the text of its own website, for a structured public profile the owner will review before publishing.

Rules, in order of importance:
1. Only what the pages state. If the site does not give opening hours, return no hours. If it gives no prices, return none. Never guess a postcode, a price or a phone number.
2. No marketing language. "Family-run dental practice in Croydon offering NHS and private check-ups, hygiene and emergency appointments" — not "award-winning, passionate about smiles".
3. Keep the owner's own wording for service names and prices.
4. British spelling. Prices as written (e.g. "£65", "from £30"). Times as HH:MM, 24-hour.
5. If the business is online-only (a streaming service, a shop, software), area is where it is based if stated, services are what it offers, and hours are usually none.
Call the business_profile tool exactly once.`;

export type Extracted = { ok: true; raw: Record<string, unknown>; pages: number; model: string } | { ok: false; error: string; pages: number };

function mockEnabled(): boolean {
  return env("PROVIDER_MOCK") === "1" && env("VERCEL_ENV") !== "production";
}

const MOCK: Record<string, unknown> = {
  name: "Mock Dental Practice",
  business_type: "dentist",
  area: "Croydon",
  description: "Family dental practice in central Croydon offering NHS and private check-ups, hygiene appointments, white fillings and same-day emergency care. Evening appointments on Tuesdays and Thursdays, step-free access throughout.",
  phone: "020 7946 0000",
  services: [
    { name: "Check-up and clean", description: "Examination, X-rays if needed, scale and polish", price: "£65" },
    { name: "Emergency appointment", description: "Same-day pain relief", price: "£85" },
    { name: "White fillings", price: "from £120" },
  ],
  hours: [
    { day: "mon", open: "08:30", close: "17:30" }, { day: "tue", open: "08:30", close: "20:00" }, { day: "wed", open: "08:30", close: "17:30" },
    { day: "thu", open: "08:30", close: "20:00" }, { day: "fri", open: "08:30", close: "16:00" }, { day: "sat", open: "09:00", close: "13:00" }, { day: "sun", closed: true },
  ],
  faqs: [
    { q: "Do you take new NHS patients?", a: "Yes, for children, and for adults when places open." },
    { q: "Can I get an emergency appointment today?", a: "Usually — call from 8:30 and we hold emergency slots every weekday." },
  ],
  areas: ["Croydon", "Purley", "South Norwood"],
};

/** Read the site and ask the model. Never throws. */
export async function extractFromWebsite(website: string): Promise<Extracted> {
  if (mockEnabled()) return { ok: true, raw: MOCK, pages: 1, model: "mock" };

  const key = env("ANTHROPIC_API_KEY");
  if (!key) return { ok: false, error: "Extraction is not configured.", pages: 0 };

  const pages = await readSite(website);
  if (!pages.length) return { ok: false, error: "We could not read that website. It may be blocking automated visitors — you can still fill the form in by hand.", pages: 0 };

  const model = env(PROVIDERS.anthropic.modelEnv) || PROVIDERS.anthropic.defaultModel;
  const user = pages.map((p) => `### ${p.url}\n${p.text}`).join("\n\n");
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 2_500,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: `Website: ${website}\n\n${user}` }],
      }),
      signal: AbortSignal.timeout(50_000),
    });
    if (!res.ok) {
      console.error("[extract] anthropic", res.status, (await res.text()).slice(0, 300));
      return { ok: false, error: "The reader is busy just now — try again in a minute, or fill the form in by hand.", pages: pages.length };
    }
    const data = (await res.json()) as { content?: { type: string; name?: string; input?: Record<string, unknown> }[] };
    const call = (data.content ?? []).find((c) => c.type === "tool_use" && c.name === TOOL.name);
    if (!call?.input) return { ok: false, error: "The reader returned nothing usable.", pages: pages.length };
    return { ok: true, raw: call.input, pages: pages.length, model };
  } catch (e) {
    console.error("[extract] threw:", e);
    return { ok: false, error: "The reader timed out — try again, or fill the form in by hand.", pages: pages.length };
  }
}

/* ---------------------------------------------------------------- merge */

const FILLABLE = ["name", "business_type", "area", "postcode", "address", "description", "phone", "email"] as const;
const LISTS = ["services", "hours", "prices", "faqs", "areas", "socials"] as const;

/** What the extraction may write: only blanks. The owner's own typing is
 *  never overwritten, and a description under 40 characters counts as blank
 *  because publishing would reject it anyway. */
export function mergeExtracted(b: Pick<Business, (typeof FILLABLE)[number] | (typeof LISTS)[number]>, raw: Record<string, unknown>): { patch: Patch; filled: string[] } {
  const s = sanitiseBusinessPatch(raw);
  const clean: Patch = s.ok ? s.patch : lenientPatch(raw);
  const patch: Patch = {};
  const filled: string[] = [];
  for (const k of FILLABLE) {
    const v = clean[k];
    if (!v) continue;
    const current = b[k];
    const blank = !current || (k === "description" && (current as string).length < 40);
    if (blank) { (patch as Record<string, unknown>)[k] = v; filled.push(k); }
  }
  for (const k of LISTS) {
    const v = clean[k];
    if (!v || !v.length) continue;
    if (!b[k] || b[k].length === 0) { (patch as Record<string, unknown>)[k] = v; filled.push(k); }
  }
  return { patch, filled };
}

/* The sanitiser rejects a whole body over one bad time or URL. The model
 * sometimes writes "9am" for an opening time; rather than lose the services
 * and FAQ with it, drop the offending list and keep the rest. */
function lenientPatch(raw: Record<string, unknown>): Patch {
  const out: Patch = {};
  for (const k of [...FILLABLE, ...LISTS]) {
    if (!(k in raw)) continue;
    const one = sanitiseBusinessPatch({ [k]: raw[k] });
    if (one.ok) Object.assign(out, one.patch);
  }
  return out;
}
