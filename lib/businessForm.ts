import { DAYS, type Business, type Day, type Faq, type Hours, type Photo, type PriceItem, type Service } from "@/lib/businesses";
import { isProviderId, type ProviderId } from "@/lib/providers";

/* What a customer may write to their own business row, and how much of it.
 *
 * Pure, so the caps are unit-tested rather than discovered in production.
 * Strings are trimmed, stripped of tags and cut to length; an array over its
 * cap is rejected outright, because silently dropping half of someone's
 * services is worse than telling them. Unknown keys are ignored. */

export const CAPS = {
  name: 120, website: 160, business_type: 80, area: 80, postcode: 12, address: 200,
  description: 1200, phone: 40, email: 160,
  services: 30, serviceName: 80, serviceDescription: 300, price: 40,
  prices: 30, priceItem: 80,
  faqs: 15, faqQ: 200, faqA: 800,
  areas: 20, areaName: 60,
  photos: 6, url: 300, alt: 120,
  socials: 6,
} as const;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Script and style blocks go with their contents; any other tag is removed
// and its text kept, so "<b>Smile</b> Dental" is still "Smile Dental".
const untag = (s: string) =>
  s.replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, "").replace(/<[^>]*>/g, "");

const text = (v: unknown, max: number): string =>
  typeof v === "string" ? untag(v).replace(/\s+/g, " ").trim().slice(0, max) : "";

const para = (v: unknown, max: number): string =>
  typeof v === "string" ? untag(v).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim().slice(0, max) : "";

const httpsUrl = (v: unknown, max: number): string | null => {
  const s = text(v, max);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** A website may arrive as a bare domain; stored with a scheme so it can be
 *  linked and scanned without guessing later. */
export function normaliseWebsite(v: unknown): string | null {
  const s = text(v, CAPS.website);
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export type Patch = Partial<Pick<Business,
  "name" | "website" | "business_type" | "area" | "postcode" | "address" | "description" |
  "services" | "hours" | "prices" | "faqs" | "areas" | "photos" | "socials" | "phone" | "email" | "target_models"
>>;

export type SanitiseResult = { ok: true; patch: Patch } | { ok: false; error: string };

export function sanitiseBusinessPatch(body: unknown): SanitiseResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const patch: Patch = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);

  if (has("name")) patch.name = text(b.name, CAPS.name) || null;
  if (has("website")) {
    const w = normaliseWebsite(b.website);
    if (b.website && !w) return { ok: false, error: "That website address does not look right." };
    patch.website = w;
  }
  if (has("business_type")) patch.business_type = text(b.business_type, CAPS.business_type) || null;
  if (has("area")) patch.area = text(b.area, CAPS.area) || null;
  if (has("postcode")) patch.postcode = text(b.postcode, CAPS.postcode).toUpperCase() || null;
  if (has("address")) patch.address = text(b.address, CAPS.address) || null;
  if (has("description")) patch.description = para(b.description, CAPS.description) || null;
  if (has("phone")) patch.phone = text(b.phone, CAPS.phone) || null;
  if (has("email")) {
    const e = text(b.email, CAPS.email).toLowerCase();
    if (e && !EMAIL_RE.test(e)) return { ok: false, error: "That contact email does not look right." };
    patch.email = e || null;
  }

  if (has("services")) {
    if (!Array.isArray(b.services)) return { ok: false, error: "Services must be a list." };
    if (b.services.length > CAPS.services) return { ok: false, error: `Up to ${CAPS.services} services.` };
    patch.services = b.services
      .map((s): Service | null => {
        const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
        const name = text(o.name, CAPS.serviceName);
        if (!name) return null;
        const description = text(o.description, CAPS.serviceDescription);
        const price = text(o.price, CAPS.price);
        return { name, ...(description ? { description } : {}), ...(price ? { price } : {}) };
      })
      .filter((s): s is Service => s !== null);
  }

  if (has("hours")) {
    if (!Array.isArray(b.hours)) return { ok: false, error: "Hours must be a list." };
    const seen = new Set<Day>();
    const out: Hours[] = [];
    for (const h of b.hours) {
      const o = (h && typeof h === "object" ? h : {}) as Record<string, unknown>;
      const day = text(o.day, 3).toLowerCase() as Day;
      if (!DAYS.includes(day) || seen.has(day)) continue;
      seen.add(day);
      const closed = o.closed === true;
      const open = text(o.open, 5);
      const close = text(o.close, 5);
      if (!closed && (!TIME_RE.test(open) || !TIME_RE.test(close))) {
        return { ok: false, error: `Opening hours for ${day} need times like 09:00 and 17:30.` };
      }
      out.push(closed ? { day, open: "", close: "", closed: true } : { day, open, close, closed: false });
    }
    patch.hours = DAYS.map((d) => out.find((h) => h.day === d)).filter((h): h is Hours => Boolean(h));
  }

  if (has("prices")) {
    if (!Array.isArray(b.prices)) return { ok: false, error: "Prices must be a list." };
    if (b.prices.length > CAPS.prices) return { ok: false, error: `Up to ${CAPS.prices} prices.` };
    patch.prices = b.prices
      .map((p): PriceItem | null => {
        const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
        const item = text(o.item, CAPS.priceItem);
        const price = text(o.price, CAPS.price);
        return item && price ? { item, price } : null;
      })
      .filter((p): p is PriceItem => p !== null);
  }

  if (has("faqs")) {
    if (!Array.isArray(b.faqs)) return { ok: false, error: "FAQs must be a list." };
    if (b.faqs.length > CAPS.faqs) return { ok: false, error: `Up to ${CAPS.faqs} questions.` };
    patch.faqs = b.faqs
      .map((f): Faq | null => {
        const o = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
        const q = text(o.q, CAPS.faqQ);
        const a = para(o.a, CAPS.faqA);
        return q && a ? { q, a } : null;
      })
      .filter((f): f is Faq => f !== null);
  }

  if (has("areas")) {
    if (!Array.isArray(b.areas)) return { ok: false, error: "Areas must be a list." };
    if (b.areas.length > CAPS.areas) return { ok: false, error: `Up to ${CAPS.areas} areas.` };
    patch.areas = Array.from(new Set(b.areas.map((a) => text(a, CAPS.areaName)).filter(Boolean)));
  }

  if (has("photos")) {
    if (!Array.isArray(b.photos)) return { ok: false, error: "Photos must be a list." };
    if (b.photos.length > CAPS.photos) return { ok: false, error: `Up to ${CAPS.photos} photos.` };
    const photos: Photo[] = [];
    for (const p of b.photos) {
      const o = (p && typeof p === "object" ? p : { url: p }) as Record<string, unknown>;
      const url = httpsUrl(o.url, CAPS.url);
      if (!o.url) continue;
      if (!url) return { ok: false, error: "Photo links must start with https://." };
      const alt = text(o.alt, CAPS.alt);
      photos.push({ url, ...(alt ? { alt } : {}) });
    }
    patch.photos = photos;
  }

  if (has("socials")) {
    if (!Array.isArray(b.socials)) return { ok: false, error: "Social links must be a list." };
    if (b.socials.length > CAPS.socials) return { ok: false, error: `Up to ${CAPS.socials} social links.` };
    const socials: string[] = [];
    for (const s of b.socials) {
      if (!s) continue;
      const url = httpsUrl(s, CAPS.url);
      if (!url) return { ok: false, error: "Social links must start with https://." };
      socials.push(url);
    }
    patch.socials = Array.from(new Set(socials));
  }

  if (has("target_models")) {
    if (!Array.isArray(b.target_models)) return { ok: false, error: "Choose at least one assistant." };
    const models = Array.from(new Set(b.target_models.filter(isProviderId))) as ProviderId[];
    if (models.length === 0) return { ok: false, error: "Choose at least one assistant." };
    patch.target_models = models;
  }

  return { ok: true, patch };
}
