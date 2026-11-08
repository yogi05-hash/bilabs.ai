import { readEvaluation, readUtm, track } from "@/components/Track";

/* Starting a Stripe checkout from the browser.
 *
 * One place, so every "Start" button carries the same context out to Stripe:
 * the campaign that found this person, and the free check that sold them —
 * which is what lets the paid business be pre-filled from that check and the
 * payment attribute to it. */

export async function startCheckout(plan: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ev = readEvaluation();
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, utm: readUtm(), evaluationId: ev.id, email: ev.email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) return { ok: false, error: data.error ?? "Could not start checkout." };
    track("checkout_started", { plan });
    window.location.href = data.url;
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not start checkout. Please email hello@bilabs.ai." };
  }
}
