import { NextResponse } from "next/server";
import { sb } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The homepage's live strip: real activity, anonymised.
 *
 * Recent free checks appear as "a dentist in Croydon — named in 1 of 5",
 * never with a business name, email or website. Test and internal rows are
 * excluded, like everywhere else. Cached at the edge for five minutes so a
 * busy homepage costs the database one query per five minutes, not one per
 * visitor. */

type Row = { business_type: string | null; area: string | null; mentions: number | null; mentions_total: number | null; completed_at: string | null };

const clean = (s: string | null, max: number) => (s ?? "").replace(/[<>]/g, "").trim().slice(0, max);

export async function GET() {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [recent, week, live] = await Promise.all([
    sb<Row[]>(
      "bilabs_evaluations?status=eq.completed&is_test=is.false&is_internal=is.false&mentions=not.is.null&business_type=not.is.null&area=not.is.null" +
        "&order=completed_at.desc&limit=8&select=business_type,area,mentions,mentions_total,completed_at",
    ),
    sb<{ id: string }[]>(`bilabs_evaluations?status=eq.completed&is_test=is.false&is_internal=is.false&completed_at=gte.${since}&select=id&limit=2000`),
    sb<{ id: string }[]>("bilabs_businesses?status=in.(live,processing)&is_test=is.false&select=id&limit=1000"),
  ]);

  const body = {
    checksThisWeek: week?.length ?? 0,
    liveProfiles: live?.length ?? 0,
    recent: (recent ?? [])
      .filter((r) => r.business_type && r.area && r.completed_at)
      .slice(0, 6)
      .map((r) => ({
        type: clean(r.business_type, 40).toLowerCase(),
        area: clean(r.area, 40),
        mentions: r.mentions ?? 0,
        total: r.mentions_total ?? 5,
        at: r.completed_at,
      })),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
