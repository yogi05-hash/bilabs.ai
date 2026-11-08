import type { Business } from "@/lib/businesses";
import type { Check, CheckResult } from "@/lib/checks";
import type { ProviderId } from "@/lib/providers";

/* Shapes the dashboard receives from /api/me/*. Type-only imports, so none
 * of the server code they describe is bundled into the browser. */

export type PublicBusiness = Omit<Business, "stripe_customer_id" | "stripe_subscription_id" | "evaluation_id" | "last_error" | "is_test">;

export type Provider = { id: ProviderId; label: string; enabled: boolean };

export type Me = {
  email: string;
  name: string | null;
  business: PublicBusiness | null;
  subscription: { status: string; plan: string | null; current_period_end: string | null; cancel_at_period_end: boolean } | null;
  latestCheck: Check | null;
  openCheck: Check | null;
  checks: Check[];
  providers: Provider[];
};

export type { Check, CheckResult, ProviderId };

export type Call = (path: string, init?: RequestInit) => Promise<Response | null>;

export const PROVIDER_BLURB: Record<ProviderId, string> = {
  openai: "ChatGPT with web search — the assistant most people ask.",
  anthropic: "Claude with web search — the assistant your free check used.",
  gemini: "Gemini with Google Search grounding — reads Google's index.",
  xai: "Grok with live search — reads the web and X.",
};
