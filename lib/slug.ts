import { sb } from "@/lib/leads";

/* Profile URLs: bilabs.ai/b/<slug>. Built from the business name and area so
 * the address itself says who and where — that is what a crawler and a human
 * both read first. */

const MAX = 80;

export function slugify(...parts: (string | null | undefined)[]): string {
  const joined = parts.filter((p): p is string => typeof p === "string" && p.trim().length > 0).join(" ");
  return joined
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, MAX)
    .replace(/-+$/, "");
}

/** The first free slug for this name and area: "smile-dental-croydon", then
 *  "-2", "-3"… A business that already owns a slug keeps it (pass `current`). */
export async function uniqueSlug(name: string, area: string | null, current?: string | null): Promise<string> {
  const base = slugify(name, area) || "business";
  if (current && (current === base || current.startsWith(`${base}-`))) return current;
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, MAX - 3)}-${n}`;
    const rows = await sb<{ id: string }[]>(`bilabs_businesses?slug=eq.${encodeURIComponent(candidate)}&select=id&limit=1`);
    if (rows === null) throw new Error("Could not check slug availability.");
    if (rows.length === 0) return candidate;
  }
  return `${base.slice(0, MAX - 9)}-${Date.now().toString(36)}`;
}
