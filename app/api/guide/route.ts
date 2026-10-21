import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { CONTEXTS, DEFAULT_CONTEXT, GUIDE_TOOL, buildSystem, safeUrl, saveLead, type GuideReply } from "@/lib/guide";

/* Public, unauthenticated, and it spends money on every call — so the guards
 * here are spend guards: short replies, a hard turn ceiling, a per-IP window,
 * and a usable answer on every failure. */

const MAX_TURNS = 8;
const MAX_TOKENS = 300;
const MAX_CHARS = 400;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;

const hits = new Map<string, { count: number; resetAt: number }>();
function allow(ip: string) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.resetAt) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return true; }
  if (e.count >= MAX_PER_WINDOW) return false;
  e.count++; return true;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n > v.resetAt) hits.delete(k); }, 300_000).unref?.();

function fallback(message?: string) {
  return NextResponse.json({
    message: message ?? "I can't reach my notes this second — the free visibility check still works, and it takes about fifteen seconds.",
    quick_replies: ["Run the free check", "See the packages"],
    next_step: { label: "Run the free check", url: "#check" },
  } satisfies GuideReply);
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allow(ip)) return fallback("We've covered a fair bit — have a look at the three packages, or book a call.");

    const body = await request.json().catch(() => null);
    const contextKey: string = typeof body?.context === "string" && body.context in CONTEXTS ? body.context : DEFAULT_CONTEXT;

    const incoming: unknown = body?.messages;
    if (!Array.isArray(incoming) || !incoming.length) return fallback();

    const cleaned = incoming.filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    );
    if (!cleaned.length || cleaned[cleaned.length - 1].role !== "user") return fallback();

    // Count on the FULL history, then trim — counting after the trim caps the
    // count at the window size and the ceiling can never fire.
    const turns = cleaned.filter((m) => m.role === "user").length;
    const messages = cleaned.slice(-(MAX_TURNS * 2)).map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

    if (turns > MAX_TURNS) {
      return NextResponse.json({
        message: "We've covered a good amount — the quickest next step is the free check, or a 15-minute call.",
        quick_replies: ["Run the free check", "See the packages"],
        next_step: { label: "See the packages", url: "#packages" },
      } satisfies GuideReply);
    }

    const key = env("ANTHROPIC_API_KEY");
    if (!key) return fallback();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: env("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
        max_tokens: MAX_TOKENS,
        system: [{ type: "text", text: buildSystem(contextKey), cache_control: { type: "ephemeral" } }],
        tools: [GUIDE_TOOL],
        tool_choice: { type: "tool", name: "reply" },
        messages,
      }),
    });

    if (!res.ok) {
      console.error("[guide] anthropic", res.status, (await res.text()).slice(0, 300));
      return fallback();
    }

    const data = await res.json();
    const tool = (data.content ?? []).find((c: { type: string; name?: string }) => c.type === "tool_use" && c.name === "reply");
    if (!tool?.input) return fallback();
    const input = tool.input as Record<string, unknown>;

    const quick = Array.isArray(input.quick_replies)
      ? (input.quick_replies as unknown[]).filter((q): q is string => typeof q === "string" && !!q.trim()).slice(0, 4).map((q) => q.slice(0, 40))
      : [];

    const raw = input.next_step as { label?: unknown; url?: unknown } | null | undefined;
    const url = safeUrl(raw?.url);
    const next_step = url && typeof raw?.label === "string" ? { label: raw.label.slice(0, 48), url } : null;

    const lead = (input.lead ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
    const business_type = str(lead.business_type);
    const area = str(lead.area);
    const pack = str(lead.recommended_package);

    if (business_type || area) {
      await saveLead({
        source: "guide",
        business_type,
        area,
        package: pack,
        message: str(lead.monthly_enquiries) ? `~${str(lead.monthly_enquiries)} enquiries/month` : null,
        email: null,
      });
    }

    return NextResponse.json({
      message: typeof input.message === "string" && input.message.trim() ? input.message.slice(0, 700) : "Tell me a little about the business and I'll point you the right way.",
      quick_replies: quick.length >= 2 ? quick : ["Run the free check", "See the packages"],
      next_step,
    } satisfies GuideReply);
  } catch (e) {
    console.error("[guide] threw:", e);
    return fallback();
  }
}
