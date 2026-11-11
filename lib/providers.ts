import { env } from "@/lib/env";
import { USD_TO_GBP } from "@/lib/evaluations";

/* One door to every assistant we can ask with live web search.
 *
 * Each provider is a raw fetch (no SDKs anywhere in this project) with a pure
 * parser beside it, so a changed response shape fails a unit test rather than
 * a customer's monthly report. A provider is "enabled" only when its key is
 * set; the dashboard shows the rest as coming soon and a check never counts a
 * provider it could not ask.
 *
 * The honest rule carried over from the free check: a call that fails is
 * `ok: false` and recorded as unavailable — never as "not mentioned". */

export type ProviderId = "anthropic" | "openai" | "gemini" | "xai";

export const PROVIDER_IDS: ProviderId[] = ["anthropic", "openai", "gemini", "xai"];

export const isProviderId = (x: unknown): x is ProviderId =>
  typeof x === "string" && (PROVIDER_IDS as string[]).includes(x);

export type ProviderMeta = {
  label: string;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  /** declared per-search (or per-source) price, USD — an estimate, labelled so */
  usdPerSearch: number;
};

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  anthropic: { label: "Claude", keyEnv: "ANTHROPIC_API_KEY", modelEnv: "ANTHROPIC_MODEL", defaultModel: "claude-haiku-4-5-20251001", usdPerSearch: 0.01 },
  openai: { label: "ChatGPT", keyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-4.1-mini", usdPerSearch: 0.025 },
  gemini: { label: "Gemini", keyEnv: "GEMINI_API_KEY", modelEnv: "GEMINI_MODEL", defaultModel: "gemini-3.8-flash", usdPerSearch: 0.035 },
  xai: { label: "Grok", keyEnv: "XAI_API_KEY", modelEnv: "XAI_MODEL", defaultModel: "grok-4-fast", usdPerSearch: 0.025 },
};

export type Ask = { ok: boolean; text: string; searches: number; model: string; error?: string };

const TIMEOUT_MS = 25_000;
const MAX_TOKENS = 700;

/** Test double. Never honoured in production, whatever the env says. */
export function mockEnabled(): boolean {
  return env("PROVIDER_MOCK") === "1" && process.env.VERCEL_ENV !== "production";
}

export const MOCK_ANSWER =
  "Here are some options:\n\n1. **Mock Dental Practice** — friendly and well reviewed\n2. **Other Clinic** — cheaper, further out\n3. **Third Option Ltd** — open late";

export function providerModel(p: ProviderId): string {
  return mockEnabled() ? "mock" : env(PROVIDERS[p].modelEnv, PROVIDERS[p].defaultModel);
}

export function providerEnabled(p: ProviderId): boolean {
  return mockEnabled() || Boolean(env(PROVIDERS[p].keyEnv));
}

export function enabledProviders(): ProviderId[] {
  return PROVIDER_IDS.filter(providerEnabled);
}

export function estimateProviderCostPence(p: ProviderId, searches: number): number {
  return Math.round(searches * PROVIDERS[p].usdPerSearch * USD_TO_GBP * 100 * 10_000) / 10_000;
}

/* ----------------------------------------------------------- parsers */

type J = Record<string, unknown>;
const obj = (x: unknown): J => (x && typeof x === "object" ? (x as J) : {});
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const str = (x: unknown): string => (typeof x === "string" ? x : "");
const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);

export function parseAnthropic(json: unknown): { text: string; searches: number } {
  const d = obj(json);
  const text = arr(d.content)
    .map(obj)
    .filter((c) => c.type === "text")
    .map((c) => str(c.text))
    .join("\n")
    .trim();
  const searches = num(obj(obj(d.usage).server_tool_use).web_search_requests);
  return { text, searches };
}

export function parseOpenAI(json: unknown): { text: string; searches: number } {
  const d = obj(json);
  const output = arr(d.output).map(obj);
  const text = output
    .filter((o) => o.type === "message")
    .flatMap((o) => arr(o.content).map(obj))
    .filter((c) => c.type === "output_text")
    .map((c) => str(c.text))
    .join("\n")
    .trim();
  const searches = output.filter((o) => o.type === "web_search_call").length;
  return { text, searches };
}

export function parseGemini(json: unknown): { text: string; searches: number } {
  const d = obj(json);
  const first = obj(arr(d.candidates)[0]);
  const text = arr(obj(first.content).parts)
    .map(obj)
    .map((p) => str(p.text))
    .join("")
    .trim();
  const grounding = obj(first.groundingMetadata);
  const queries = arr(grounding.webSearchQueries).length;
  // Grounding is billed per grounded request, so one is the floor once it ran.
  const searches = Object.keys(grounding).length ? Math.max(1, queries) : 0;
  return { text, searches };
}

export function parseXai(json: unknown): { text: string; searches: number } {
  const d = obj(json);
  const first = obj(arr(d.choices)[0]);
  const content = obj(first.message).content;
  const text = (typeof content === "string"
    ? content
    : arr(content).map(obj).map((c) => str(c.text)).join("\n")
  ).trim();
  const searches = num(obj(d.usage).num_sources_used);
  return { text, searches };
}

/* ------------------------------------------------------------- calls */

function request(p: ProviderId, model: string, question: string, key: string): { url: string; init: RequestInit } {
  const json = (body: unknown, headers: Record<string, string>) => ({
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  switch (p) {
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/messages",
        init: json(
          {
            model,
            max_tokens: MAX_TOKENS,
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
            messages: [{ role: "user", content: question }],
          },
          { "x-api-key": key, "anthropic-version": "2023-06-01" },
        ),
      };
    case "openai":
      return {
        url: "https://api.openai.com/v1/responses",
        init: json(
          { model, tools: [{ type: "web_search_preview" }], input: question, max_output_tokens: MAX_TOKENS },
          { Authorization: `Bearer ${key}` },
        ),
      };
    case "gemini":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        init: json(
          {
            contents: [{ role: "user", parts: [{ text: question }] }],
            tools: [{ google_search: {} }],
            generationConfig: { maxOutputTokens: MAX_TOKENS },
          },
          { "x-goog-api-key": key },
        ),
      };
    case "xai":
      return {
        url: "https://api.x.ai/v1/chat/completions",
        init: json(
          {
            model,
            messages: [{ role: "user", content: question }],
            search_parameters: { mode: "on", max_search_results: 5, return_citations: true },
            max_tokens: MAX_TOKENS,
          },
          { Authorization: `Bearer ${key}` },
        ),
      };
  }
}

const PARSE: Record<ProviderId, (json: unknown) => { text: string; searches: number }> = {
  anthropic: parseAnthropic,
  openai: parseOpenAI,
  gemini: parseGemini,
  xai: parseXai,
};

/** Ask one assistant one question with live web search. Never throws. */
export async function ask(p: ProviderId, question: string, opts: { timeoutMs?: number } = {}): Promise<Ask> {
  const model = providerModel(p);
  if (mockEnabled()) {
    await new Promise((r) => setTimeout(r, 50));
    return { ok: true, text: env("PROVIDER_MOCK_ANSWER", MOCK_ANSWER), searches: 1, model };
  }
  const key = env(PROVIDERS[p].keyEnv);
  if (!key) return { ok: false, text: "", searches: 0, model, error: "not configured" };

  const { url, init } = request(p, model, question, key);
  try {
    const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS) });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      console.error(`[providers] ${p} HTTP ${res.status}:`, body);
      return { ok: false, text: "", searches: 0, model, error: `HTTP ${res.status}` };
    }
    const parsed = PARSE[p](await res.json());
    if (!parsed.text) return { ok: false, text: "", searches: parsed.searches, model, error: "empty answer" };
    return { ok: true, text: parsed.text, searches: parsed.searches, model };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[providers] ${p} threw:`, msg);
    return { ok: false, text: "", searches: 0, model, error: msg.slice(0, 120) };
  }
}
