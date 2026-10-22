/* Reporting periods, in Europe/London.
 *
 * Every boundary on the dashboard is a London midnight, not a UTC one. For
 * roughly half the year those differ by an hour, which is enough to move a
 * late-evening signup into the wrong day and make "today" disagree with what
 * the user remembers happening.
 *
 * There is no date library in this project and this does not justify adding
 * one: Intl already knows the timezone rules, including the DST changeovers,
 * so the offset is read from it rather than hardcoded as +0/+1.
 */

export const TZ = "Europe/London";

type Parts = { y: number; m: number; d: number; h: number; mi: number; s: number };

const FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false,
});

function partsIn(d: Date): Parts {
  const o: Record<string, string> = {};
  for (const p of FMT.formatToParts(d)) if (p.type !== "literal") o[p.type] = p.value;
  // Intl can render midnight as hour 24 in some locales; normalise to 0.
  const h = Number(o.hour) % 24;
  return { y: +o.year, m: +o.month, d: +o.day, h, mi: +o.minute, s: +o.second };
}

/** How far London is ahead of UTC at this instant, in ms (0 or 3_600_000). */
function offsetAt(d: Date): number {
  const p = partsIn(d);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000;
}

/** The UTC instant at which the given London calendar day begins. */
export function londonMidnight(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Subtracting the offset at the guess lands on the right instant except
  // across a DST boundary, where the offset either side differs — so check
  // the answer and correct once using the offset that actually applies there.
  let t = new Date(guess - offsetAt(new Date(guess)));
  const check = partsIn(t);
  if (check.h !== 0 || check.d !== d) t = new Date(guess - offsetAt(t));
  return t;
}

export function londonToday(now = new Date()): { y: number; m: number; d: number } {
  const p = partsIn(now);
  return { y: p.y, m: p.m, d: p.d };
}

/** Start of the London day containing `d`. */
export function startOfLondonDay(d: Date): Date {
  const p = partsIn(d);
  return londonMidnight(p.y, p.m, p.d);
}

export function addDays(d: Date, n: number): Date {
  const p = partsIn(d);
  return londonMidnight(p.y, p.m, p.d + n);
}

export type RangeId = "today" | "7d" | "30d" | "custom";

export type Period = {
  id: RangeId;
  /** inclusive */
  from: Date;
  /** exclusive — always a London midnight, so "today" runs to tomorrow 00:00 */
  to: Date;
  label: string;
  days: number;
  /** the equally-long window immediately before `from` */
  prev: { from: Date; to: Date };
};

const DAY = 86_400_000;

function build(id: RangeId, from: Date, to: Date, label: string): Period {
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY));
  // Step back by whole London days rather than subtracting milliseconds, so
  // the comparison window is the same number of calendar days even when a
  // clock change makes one of them 23 or 25 hours long.
  const prevFrom = addDays(from, -days);
  return { id, from, to, label, days, prev: { from: prevFrom, to: from } };
}

/** Parse the dashboard's range params. Unknown or malformed input falls back
 *  to 7 days rather than erroring — a bad querystring should not blank the
 *  page. */
export function resolvePeriod(
  id: string | null,
  fromStr?: string | null,
  toStr?: string | null,
  now = new Date(),
): Period {
  const t = londonToday(now);
  const todayStart = londonMidnight(t.y, t.m, t.d);
  const tomorrow = addDays(todayStart, 1);

  if (id === "today") return build("today", todayStart, tomorrow, "Today");
  if (id === "30d") return build("30d", addDays(todayStart, -29), tomorrow, "Last 30 days");

  if (id === "custom" && fromStr && toStr) {
    const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromStr);
    const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toStr);
    if (a && b) {
      const from = londonMidnight(+a[1], +a[2], +a[3]);
      // `to` is inclusive in the UI, so the query bound is the next midnight
      const to = addDays(londonMidnight(+b[1], +b[2], +b[3]), 1);
      if (to > from) return build("custom", from, to, `${fromStr} to ${toStr}`);
    }
  }

  return build("7d", addDays(todayStart, -6), tomorrow, "Last 7 days");
}

/** London YYYY-MM-DD for an instant — the key used to bucket daily series. */
export function londonDayKey(d: Date): string {
  const p = partsIn(d);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Every London day key in [from, to), in order. */
export function dayKeys(from: Date, to: Date): string[] {
  const out: string[] = [];
  let cur = startOfLondonDay(from);
  let guard = 0;
  while (cur < to && guard++ < 400) {
    out.push(londonDayKey(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

/** Percentage change, or null when the previous period had nothing to compare
 *  against — "up 100%" from zero is not information. */
export function delta(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}
