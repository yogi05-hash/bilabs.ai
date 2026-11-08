import { env } from "@/lib/env";

/* The questions we put to an assistant.
 *
 * Shared by the free check (one assistant) and the paid monthly check (every
 * assistant the customer chose), so the two measure the same thing and a
 * customer's first paid result is comparable with the free one that sold it. */

export type Variation = { id: string; label: string; question: string };

/** "a dentist" but "an AI consultant" — the naive template produced "a ai".
 *  Acronyms take the article of their spoken first letter, so it is "an MOT
 *  centre" and "an SEO agency" even though M and S are consonants. */
export function article(noun: string): string {
  const first = noun.trim().split(/\s+/)[0] ?? "";
  if (!first) return "a";
  const letters = first.replace(/[^A-Za-z]/g, "");
  if (!letters) return "a";

  // Read as an acronym when the opening run is capitals: AI, MOT, SEO, HR.
  const isAcronym = /^[A-Z]{2,}$/.test(letters) || /^[A-Z]\.?[A-Z]/.test(first);
  if (isAcronym) return /^[AEFHILMNORSX]/.test(letters) ? "an" : "a";

  return /^[aeiou]/i.test(letters) ? "an" : "a";
}

/** Per-domain overrides, so we can test our own site with the questions our
 *  own customers would actually ask. Set CUSTOM_QUERIES as JSON:
 *  {"bilabs.ai":["question one","question two"]} */
export function customFor(website: string): string[] | null {
  const raw = env("CUSTOM_QUERIES");
  if (!raw || !website) return null;
  try {
    const map = JSON.parse(raw) as Record<string, string[]>;
    const host = website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
    const hit = map[host];
    return Array.isArray(hit) && hit.length ? hit.slice(0, 5) : null;
  } catch {
    return null;
  }
}

export function variations(type: string, area: string, postcode: string, website: string): Variation[] {
  const custom = customFor(website);
  if (custom) {
    return custom.map((q, i) => ({ id: `custom-${i + 1}`, label: `Custom query ${i + 1}`, question: q }));
  }
  const a = article(type);
  const where = postcode || area;
  return [
    { id: "direct", label: "Straight recommendation", question: `Recommend ${a} ${type} in ${area}. Name up to 6 specific businesses with a one-line reason for each.` },
    { id: "near-me", label: "“Near me” phrasing", question: `I'm in ${area} and looking for a good ${type} near me. Which specific ones would you suggest? List up to 6 by name.` },
    { id: "urgent", label: "Urgent need", question: `I need ${a} ${type} in ${area} urgently today. Which specific businesses should I contact? List up to 6 by name.` },
    { id: "value", label: "Best / affordable", question: `Who is the best value ${type} in ${area}? Name up to 6 specific businesses and say briefly why.` },
    { id: "postcode", label: postcode ? `Postcode (${postcode})` : "Local area phrasing", question: `Which ${type} businesses serve ${where}? List up to 6 by name.` },
  ];
}
