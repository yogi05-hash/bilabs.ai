"use client";

import { useState } from "react";
import { Badge, fmtDate } from "@/components/admin/ui";
import type { Call, Me } from "@/components/dashboard/types";

const PLAN: Record<string, string> = { "get-found": "Get Found by AI · £49/month", "front-desk": "AI Front Desk · £99/month" };

export default function Billing({ me, call }: { me: Me; call: Call }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sub = me.subscription;

  const portal = async () => {
    setBusy(true); setErr(null);
    const res = await call("/api/me/billing-portal", { method: "POST" });
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok || !d.url) { setErr(d.error ?? "Could not open billing just now."); setBusy(false); return; }
    window.location.href = d.url;
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="ad-card ad-card-pad">
        <p className="ad-k">Your plan</p>
        <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{PLAN[sub?.plan ?? me.business?.plan ?? ""] ?? "BiLabs subscription"}</p>
        <dl className="ad-kv" style={{ marginTop: 12 }}>
          <dt>Status</dt><dd><Badge value={sub?.status ?? (me.business ? "active" : null)} /></dd>
          <dt>{sub?.cancel_at_period_end ? "Ends" : "Renews"}</dt><dd>{fmtDate(sub?.current_period_end)}</dd>
          <dt>Signed in as</dt><dd>{me.email}</dd>
        </dl>
        <button type="button" className="ad-btn primary" style={{ marginTop: 16 }} disabled={busy} onClick={portal}>{busy ? "Opening…" : "Manage billing"}</button>
        {err ? <p style={{ color: "var(--ad-bad)", fontSize: 13, margin: "8px 0 0" }}>{err}</p> : null}
        <p className="ad-note" style={{ marginTop: 12 }}>Update your card, download invoices or cancel — all handled by Stripe. Cancelling takes your profile down at the end of the period; nothing is charged after that.</p>
      </div>
    </div>
  );
}
