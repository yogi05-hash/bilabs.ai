"use client";

import { type ReactNode } from "react";

/* Shared pieces for the dashboard: states, stats, tables, formatting.
 *
 * The three states are first-class on purpose. A metric that is loading, a
 * metric that is genuinely zero, and a metric we cannot reach look completely
 * different and must never be mistaken for one another — a dashboard showing
 * a confident "0" when the integration is down is worse than no dashboard. */

export const TZ = "Europe/London";

export function fmtDate(v: string | null | undefined, withTime = false): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    timeZone: TZ,
    day: "2-digit", month: "short", year: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function fmtMoney(pence: number | null | undefined, currency = "gbp"): string {
  if (pence === null || pence === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 2 })
      .format(pence / 100);
  } catch {
    return `${(pence / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export const fmtNum = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : new Intl.NumberFormat("en-GB").format(n);

export function ago(v: string | null | undefined): string {
  if (!v) return "—";
  const ms = Date.now() - new Date(v).getTime();
  if (Number.isNaN(ms)) return "—";
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export type Metric = { value: number; prev: number; delta: number | null };

export function Delta({ m, invert = false }: { m: Metric | undefined; invert?: boolean }) {
  if (!m || m.delta === null) {
    return <span className="ad-delta ad-flat" title="No activity in the comparison period, so there is nothing to compare against">—</span>;
  }
  const up = m.delta > 0;
  const good = invert ? !up : up;
  const cls = m.delta === 0 ? "ad-flat" : good ? "ad-up" : "ad-down";
  return (
    <span className={`ad-delta ${cls}`} title={`Previous period: ${fmtNum(m.prev)}`}>
      {m.delta > 0 ? "+" : ""}{m.delta}%
    </span>
  );
}

export function Stat({
  label, value, metric, note, invert, hint,
}: {
  label: string; value: ReactNode; metric?: Metric; note?: ReactNode; invert?: boolean; hint?: string;
}) {
  return (
    <div className="ad-card">
      <p className="ad-k">
        {label}
        {hint ? <abbr title={hint} style={{ cursor: "help", textDecoration: "none", color: "var(--ad-amber-2)" }}>ⓘ</abbr> : null}
      </p>
      <p className="ad-v">
        {value}
        {metric ? <Delta m={metric} invert={invert} /> : null}
      </p>
      {note ? <p className="ad-note">{note}</p> : null}
    </div>
  );
}

export function Loading({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="ad-card" aria-busy="true" aria-label={label}>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="ad-skel" style={{ width: `${92 - i * 11}%` }} />
        ))}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="ad-tablewrap">
      <div className="ad-state">
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="ad-err" role="alert">
      {message}
      {onRetry ? (
        <>
          {" "}
          <button className="ad-btn" style={{ marginLeft: 8 }} onClick={onRetry}>Try again</button>
        </>
      ) : null}
    </div>
  );
}

/** "Not connected" is a distinct answer from "nothing happened yet". */
export function NotConnected({ what, why }: { what: string; why?: string }) {
  return (
    <div className="ad-card">
      <p className="ad-k">{what}</p>
      <p className="ad-v ad-v-sm ad-muted">Not connected</p>
      {why ? <p className="ad-note">{why}</p> : null}
    </div>
  );
}

export function Badge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="ad-muted">—</span>;
  return <span className={`ad-badge ${value.toLowerCase()}`}>{value.replace(/_/g, " ")}</span>;
}

export function Pager({
  page, size, total, onPage,
}: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  const last = Math.max(0, Math.ceil(total / size) - 1);
  return (
    <div className="ad-pager">
      <span className="ad-num">{fmtNum(from)}–{fmtNum(to)} of {fmtNum(total)}</span>
      <span style={{ display: "flex", gap: 6 }}>
        <button className="ad-btn" onClick={() => onPage(page - 1)} disabled={page <= 0}>Previous</button>
        <button className="ad-btn" onClick={() => onPage(page + 1)} disabled={page >= last}>Next</button>
      </span>
    </div>
  );
}

/** Sortable column header — a real button, so it is keyboard reachable. */
export function Th({
  children, col, sort, dir, onSort, numeric,
}: {
  children: ReactNode; col?: string; sort?: string; dir?: "asc" | "desc";
  onSort?: (c: string) => void; numeric?: boolean;
}) {
  if (!col || !onSort) return <th style={numeric ? { textAlign: "right" } : undefined}>{children}</th>;
  const active = sort === col;
  return (
    <th style={numeric ? { textAlign: "right" } : undefined} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => onSort(col)} title={`Sort by ${String(children)}`}>
        {children}
        <span aria-hidden="true" style={{ opacity: active ? 1 : 0.25 }}>{active && dir === "asc" ? "↑" : "↓"}</span>
      </button>
    </th>
  );
}

/** A tiny bar chart. No chart library: this is a dozen divs, and adding a
 *  dependency to draw them would be the wrong trade. */
export function Spark({ data, labels }: { data: number[]; labels?: string[] }) {
  const max = Math.max(1, ...data);
  return (
    <div className="ad-spark" role="img" aria-label={`Trend: ${data.join(", ")}`}>
      {data.map((v, i) => (
        <i
          key={i}
          className={v === 0 ? "zero" : undefined}
          style={{ height: `${Math.max(3, (v / max) * 100)}%` }}
          title={labels?.[i] ? `${labels[i]}: ${v}` : String(v)}
        />
      ))}
    </div>
  );
}
