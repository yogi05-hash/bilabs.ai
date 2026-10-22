"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, ErrorBox, Loading, Stat, fmtDate, fmtMoney, fmtNum } from "./ui";

/* Customers and billing.
 *
 * Everything is scoped to the two BiLabs products. The Stripe account is
 * shared with other products, and summing it whole is exactly the bug this
 * page replaced. */

type Sub = {
  id: string; status: string; email: string | null; customerId: string | null; plan: string | null;
  amountPence: number | null; currency: string; interval: string | null; quantity: number;
  startedAt: string | null; renewsAt: string | null; cancelAtPeriodEnd: boolean; canceledAt: string | null;
  livemode: boolean;
};
type Pay = {
  id: string; kind: string; email: string | null; amount_pence: number; currency: string;
  plan: string | null; recurring: boolean; livemode: boolean; occurred_at: string;
};
type Data = {
  connected: boolean; products: string[]; subscriptions: Sub[]; payments: Pay[];
  period: {
    label: string; receivedPence: number; refundedPence: number; failedCount: number;
    oneOffPence: number; recurringPence: number; mixedCurrency: boolean; currencies: string[];
  };
  mrr: { byCurrency: Record<string, number>; activeCount: number; trialingCount: number; gbpOnly: number | null; currencies: string[] } | null;
  definitions: Record<string, string>;
};

export default function Customers({
  call, range, isOwner,
}: { call: (p: string, i?: RequestInit) => Promise<Response | null>; range: string; isOwner: boolean }) {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTest, setShowTest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const res = await call(`/api/admin/customers?range=${range}`);
    if (!res) { setLoading(false); return; }
    if (!res.ok) { setErr("Could not load billing."); setLoading(false); return; }
    setD(await res.json()); setLoading(false);
  }, [call, range]);

  useEffect(() => { void load(); }, [load]);

  const reconcile = async () => {
    setBusy(true); setMsg(null);
    const res = await call("/api/admin/customers", { method: "POST", body: JSON.stringify({}) });
    setBusy(false);
    if (!res) return;
    const j = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Reconciled ${j.subscriptions} subscription(s) and ${j.invoicesSeen} invoice(s). ${j.note ?? ""}` : (j.error ?? "Reconcile failed."));
    if (res.ok) await load();
  };

  if (err) return <ErrorBox message={err} onRetry={load} />;
  if (loading && !d) return <Loading rows={6} />;
  if (!d) return null;

  if (!d.connected) {
    return (
      <Empty title="Stripe is not connected">
        The billing figures are unavailable rather than zero. Check STRIPE_SECRET_KEY, then reload.
      </Empty>
    );
  }

  const live = d.subscriptions.filter((s) => s.livemode || showTest);
  const active = live.filter((s) => s.status === "active" || s.status === "trialing");
  const payments = d.payments.filter((p) => p.livemode || showTest);

  return (
    <>
      {msg ? <div className="ad-card" style={{ marginBottom: 12, fontSize: 13 }}>{msg}</div> : null}

      <div className="ad-grid">
        {d.mrr ? (
          <Stat
            label="MRR (now)"
            value={d.mrr.gbpOnly !== null ? fmtMoney(d.mrr.gbpOnly, "gbp") : "mixed"}
            note={d.mrr.gbpOnly !== null
              ? `${fmtNum(d.mrr.activeCount)} active${d.mrr.trialingCount ? ` · ${d.mrr.trialingCount} trialing` : ""}`
              : Object.entries(d.mrr.byCurrency).map(([c, v]) => fmtMoney(v, c)).join(" + ")}
          />
        ) : null}
        <Stat label={`Received · ${d.period.label.toLowerCase()}`}
              value={d.period.mixedCurrency ? "mixed" : fmtMoney(d.period.receivedPence)}
              note={`${fmtMoney(d.period.recurringPence)} recurring · ${fmtMoney(d.period.oneOffPence)} one-off`} />
        <Stat label="Refunded" value={fmtMoney(d.period.refundedPence)} />
        <Stat label="Failed payments" value={fmtNum(d.period.failedCount)} />
      </div>

      <div className="ad-filters ad-sect">
        <label className="ad-btn" style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
          <input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} />
          Include test-mode
        </label>
        {isOwner ? (
          <button className="ad-btn" onClick={reconcile} disabled={busy}>
            {busy ? "Reconciling…" : "Reconcile from Stripe"}
          </button>
        ) : null}
        <span className="ad-note" style={{ margin: 0 }}>
          Scoped to {d.products.length} BiLabs product{d.products.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="ad-sect">
        <h3 className="ad-sect-h">Subscriptions ({active.length} active)</h3>
        {live.length === 0 ? (
          <Empty title="No BiLabs subscriptions yet">
            This Stripe account carries other products; only BiLabs ones are counted here. No one has subscribed to a
            BiLabs plan so far.
          </Empty>
        ) : (
          <div className="ad-tablewrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Customer</th><th>Plan</th><th>Status</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Started</th><th>Renews</th><th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {live.map((s) => (
                  <tr key={s.id}>
                    <td>{s.email ?? <span className="ad-muted">—</span>}</td>
                    <td>{s.plan ?? "—"}</td>
                    <td>
                      <Badge value={s.status} />
                      {s.cancelAtPeriodEnd ? <div className="ad-muted" style={{ fontSize: 11 }}>cancels at period end</div> : null}
                    </td>
                    <td className="ad-num" style={{ textAlign: "right" }}>
                      {s.amountPence === null ? "—" : `${fmtMoney(s.amountPence, s.currency)}/${s.interval ?? "?"}`}
                    </td>
                    <td className="ad-num ad-muted">{fmtDate(s.startedAt)}</td>
                    <td className="ad-num ad-muted">{fmtDate(s.renewsAt)}</td>
                    <td>{s.livemode ? <span className="ad-badge">live</span> : <span className="ad-badge abandoned">test</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ad-sect">
        <h3 className="ad-sect-h">Payment history</h3>
        {payments.length === 0 ? (
          <Empty title="No payments recorded">
            Payments are written by signature-verified webhooks. If you expect some, use “Reconcile from Stripe”.
          </Empty>
        ) : (
          <div className="ad-tablewrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>When</th><th>Customer</th><th>Type</th><th>Plan</th>
                  <th style={{ textAlign: "right" }}>Amount</th><th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="ad-num ad-muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(p.occurred_at, true)}</td>
                    <td>{p.email ?? <span className="ad-muted">—</span>}</td>
                    <td><Badge value={p.kind} /></td>
                    <td className="ad-muted">{p.plan ?? "—"}{p.recurring ? "" : " · one-off"}</td>
                    <td className="ad-num" style={{ textAlign: "right", color: p.amount_pence < 0 ? "var(--ad-bad)" : undefined }}>
                      {fmtMoney(p.amount_pence, p.currency)}
                    </td>
                    <td>{p.livemode ? <span className="ad-badge">live</span> : <span className="ad-badge abandoned">test</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ad-card ad-card-pad ad-sect">
        <h3 className="ad-sect-h">How these figures are defined</h3>
        <div className="ad-defs">
          {Object.entries(d.definitions).map(([k, v]) => (
            <p className="ad-def" key={k}><b>{k}</b> — {v}</p>
          ))}
        </div>
      </div>
    </>
  );
}
