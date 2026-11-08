/* Reading an assistant's answer.
 *
 * Two pure functions shared by every check: did the business come back, and
 * who was named instead. Neither adjusts anything — a near-miss is a miss. */

/** Does the answer mention this business, by name or by domain? Normalises
 *  both sides (protocol, www, common TLDs, "Ltd / the / and") and accepts
 *  either the whole name as a substring or every significant word of it. */
export function mentions(hay: string, needle: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/https?:\/\//g, "").replace(/www\./g, "")
      .replace(/\.(co\.uk|com|net|org|uk)\b/g, "").replace(/\b(ltd|limited|the|and|&)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ").trim();
  const h = norm(hay); const n = norm(needle);
  if (!n) return false;
  if (h.includes(n)) return true;
  const words = n.split(" ").filter((w) => w.length > 3);
  return words.length > 0 && words.every((w) => h.includes(w));
}

export const ACCOLADE = /\b(award|winner|rated|reviews?|crowned|best .* in|voted)\b/i;

/** Business names from a bold-list answer ("1. **Name** — reason"). Award-style
 *  phrases that happen to be bold are dropped rather than listed as rivals. */
export function namesFrom(answer: string): string[] {
  const listed = Array.from(answer.matchAll(/^\s*(?:\d+[.)]|[-*])\s*\*\*(.+?)\*\*/gm) as Iterable<RegExpMatchArray>)
    .map((m: RegExpMatchArray) => m[1].trim());
  return Array.from(new Set(listed))
    .map((n) => n.replace(/\s*[-–—:]\s*$/, "").trim())
    .filter((n) => n.length > 2 && n.length < 70 && /^[A-Z0-9]/.test(n) && !ACCOLADE.test(n));
}
