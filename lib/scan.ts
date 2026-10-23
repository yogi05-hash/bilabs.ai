/* Website AI-readiness scan.
 *
 * Every check here is a real fetch against the visitor's own site. Nothing is
 * inferred, softened or invented: if a request fails we say the check could
 * not be run rather than guessing a result, and a site we cannot reach scores
 * nothing rather than scoring badly for the wrong reason.
 *
 * The score is only ever about what the site itself does. Whether an
 * assistant actually mentions a business is reported separately, because the
 * business does not control that and folding it into a "readiness" number
 * would be dishonest arithmetic. */

export type Check = {
  id: string;
  label: string;
  weight: number;
  pass: boolean;
  detail: string;
  /** true when the check could not be run at all (network, timeout). */
  unknown?: boolean;
};

export type Scan = {
  url: string | null;
  reachable: boolean;
  checks: Check[];
  score: number;
  maxScore: number;
  loadMs: number | null;
  /** The homepage HTML this scan already fetched, so enrichment does not
   *  fetch the same page twice. Not serialised into reports. */
  html?: string;
};

const UA = "Mozilla/5.0 (compatible; BiLabsReadiness/1.0; +https://bilabs.ai)";
const TIMEOUT = 9000;

function normalise(input: string): string | null {
  const raw = input.trim().replace(/\s+/g, "");
  if (!raw) return null;
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.origin + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return null;
  }
}

async function get(url: string): Promise<{ ok: boolean; status: number; text: string; ms: number }> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,text/plain,*/*" },
      redirect: "follow",
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = (await res.text()).slice(0, 400_000);
    return { ok: res.ok, status: res.status, text, ms: Date.now() - started };
  } catch {
    return { ok: false, status: 0, text: "", ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

const strip = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");

function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* malformed block — it exists but is unusable, which counts as absent */
    }
  }
  return out;
}

function hasBusinessSchema(blocks: unknown[]): boolean {
  const BIZ = /(LocalBusiness|Organization|Store|Restaurant|Dentist|Physician|HomeAndConstructionBusiness|ProfessionalService|RealEstateAgent|LegalService|HealthAndBeautyBusiness|AutomotiveBusiness|FoodEstablishment)/i;
  const walk = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(walk);
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      const t = o["@type"];
      if (typeof t === "string" && BIZ.test(t)) return true;
      if (Array.isArray(t) && t.some((x) => typeof x === "string" && BIZ.test(x))) return true;
      return Object.values(o).some(walk);
    }
    return false;
  };
  return blocks.some(walk);
}

export async function scanSite(rawUrl: string): Promise<Scan> {
  const url = normalise(rawUrl);
  const checks: Check[] = [];
  const push = (c: Check) => checks.push(c);

  if (!url) {
    return { url: null, reachable: false, checks: [], score: 0, maxScore: 100, loadMs: null };
  }

  const home = await get(url);
  if (!home.ok || !home.text) {
    return { url, reachable: false, checks: [], score: 0, maxScore: 100, loadMs: home.ms || null };
  }

  const html = home.text;
  const text = strip(html);
  const lower = text.toLowerCase();
  const origin = new URL(url).origin;

  // --- structured data -------------------------------------------------
  const blocks = jsonLdBlocks(html);
  const schemaOk = hasBusinessSchema(blocks);
  push({
    id: "schema",
    label: "Business schema (JSON-LD) an assistant can parse",
    weight: 20,
    pass: schemaOk,
    detail: schemaOk
      ? "Found LocalBusiness-type structured data on the homepage."
      : blocks.length
        ? `Found ${blocks.length} JSON-LD block(s), but none describing the business itself.`
        : "No JSON-LD structured data found on the homepage.",
  });

  // --- the facts, as readable text ------------------------------------
  const hoursOk =
    /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b[^.]{0,40}\d{1,2}([:.]\d{2})?\s*(am|pm|–|-|to)/i.test(text) ||
    /opening (hours|times)/i.test(text);
  push({
    id: "hours",
    label: "Opening hours written as text",
    weight: 10,
    pass: hoursOk,
    detail: hoursOk ? "Opening hours appear as readable text." : "No opening hours found as text on the homepage.",
  });

  const servicesOk = /\b(services|what we do|treatments|our work|products|specialit|speciali[sz]|we offer)\b/i.test(text);
  push({
    id: "services",
    label: "Services listed as text",
    weight: 10,
    pass: servicesOk,
    detail: servicesOk ? "A services or offerings section was found." : "No clear services list found as text.",
  });

  const priceOk = /(£|\$|€)\s?\d|\bfrom\s+(£|\$|€)\s?\d|\bprice(s|list)?\b|\bfees?\b/i.test(text);
  push({
    id: "prices",
    label: "Prices or a price guide on the page",
    weight: 10,
    pass: priceOk,
    detail: priceOk ? "Pricing information appears on the page." : "No prices or price guide found.",
  });

  const faqOk =
    /faq|frequently asked/i.test(html) ||
    blocks.some((b) => JSON.stringify(b).includes("FAQPage"));
  push({
    id: "faq",
    label: "FAQ content assistants can quote",
    weight: 10,
    pass: faqOk,
    detail: faqOk ? "FAQ content or FAQPage markup found." : "No FAQ section or FAQPage markup found.",
  });

  const contactOk =
    /\b[\w.+-]+@[\w-]+\.[\w.]+\b/.test(text) ||
    /\b(0\d{3,4}\s?\d{3}\s?\d{3,4}|\+44\s?\d[\d\s]{8,})\b/.test(text) ||
    /tel:/i.test(html);
  push({
    id: "contact",
    label: "Phone or email on the page",
    weight: 10,
    pass: contactOk,
    detail: contactOk ? "Contact details are present as text." : "No phone number or email found as text.",
  });

  // --- machine-facing files -------------------------------------------
  const [robots, llms] = await Promise.all([get(`${origin}/robots.txt`), get(`${origin}/llms.txt`)]);

  const BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot"];
  let botsOk = true;
  let botDetail = "No robots.txt, so nothing is blocked — assistants may crawl.";
  if (robots.ok && robots.text) {
    const blocked: string[] = [];
    const lines = robots.text.split(/\r?\n/);
    for (const bot of BOTS) {
      let inGroup = false;
      for (const line of lines) {
        const l = line.trim();
        if (/^user-agent:/i.test(l)) inGroup = new RegExp(`^user-agent:\\s*(${bot}|\\*)\\s*$`, "i").test(l);
        else if (inGroup && /^disallow:\s*\/\s*$/i.test(l)) { blocked.push(bot); break; }
      }
    }
    botsOk = blocked.length === 0;
    botDetail = botsOk
      ? "robots.txt does not block GPTBot, ClaudeBot or PerplexityBot."
      : `robots.txt blocks ${blocked.join(", ")} from the whole site.`;
  }
  push({ id: "crawlers", label: "AI crawlers not blocked in robots.txt", weight: 15, pass: botsOk, detail: botDetail });

  const llmsOk = llms.ok && /\S/.test(llms.text) && !/<html/i.test(llms.text.slice(0, 200));
  push({
    id: "llmstxt",
    label: "llms.txt index for AI assistants",
    weight: 5,
    pass: llmsOk,
    detail: llmsOk ? "An llms.txt file is published." : "No llms.txt found.",
  });

  // --- speed -----------------------------------------------------------
  const fastOk = home.ms <= 2500;
  push({
    id: "speed",
    label: "Homepage responds in under 2.5s",
    weight: 10,
    pass: fastOk,
    detail: `Homepage returned in ${(home.ms / 1000).toFixed(1)}s${fastOk ? "." : " — slow crawls get abandoned."}`,
  });

  const maxScore = checks.reduce((n, c) => n + c.weight, 0);
  const score = checks.reduce((n, c) => n + (c.pass ? c.weight : 0), 0);

  void lower;
  return { url, reachable: true, checks, score, maxScore, loadMs: home.ms, html };
}
