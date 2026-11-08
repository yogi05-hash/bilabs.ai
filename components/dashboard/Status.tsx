"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDate, ago, Stat } from "@/components/admin/ui";
import type { Call, Me, ProviderId } from "@/components/dashboard/types";

/* The overview: where things stand, and the one button that spends money. */

export default function Status({ me, call, onChange, onGo }: { me: Me; call: Call; onChange: () => Promise<void>; onGo: (tab: string) => void }) {
  const b = me.business!;
  const [running, setRunning] = useState<string | null>(me.openCheck?.id ?? null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // poll the running check until it finishes, then refresh everything
  useEffect(() => {
    if (!running) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const res = await call(`/api/me/checks?id=${running}`);
      const d = res && res.ok ? await res.json() : null;
      const status = d?.check?.status;
      if (status === "completed" || status === "failed" || status === "abandoned") {
        setRunning(null);
        await onChange();
        return;
      }
      timer.current = setTimeout(tick, 3000);
    };
    void tick();
    return () => { stop = true; if (timer.current) clearTimeout(timer.current); };
  }, [running, call, onChange]);

  const runNow = async () => {
    setErr(null);
    const res = await call("/api/me/check", { method: "POST" });
    if (!res) { setErr("Could not start a check."); return; }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error ?? "Could not start a check."); return; }
    setRunning(d.checkId);
  };

  const latest = me.latestCheck;
  const totals = latest?.totals ?? {};
  const published = Boolean(b.published_at);
  const label = (id: ProviderId) => me.providers.find((p) => p.id === id)?.label ?? id;

  const item = (ok: boolean | null, title: string, note: React.ReactNode) => (
    <div className="ad-check">
      <span className={`ad-dot ${ok === null ? "unknown" : ok ? "ok" : "bad"}`} style={{ marginTop: 6 }} />
      <div><div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div><div className="ad-note" style={{ marginTop: 2 }}>{note}</div></div>
    </div>
  );

  return (
    <>
      <div className="ad-grid">
        <Stat label="Named in" value={latest ? `${latest.found_total ?? 0} / ${latest.answers_total ?? 0}` : "—"} note={latest ? `answers across ${(latest.providers ?? []).length} assistant${(latest.providers ?? []).length === 1 ? "" : "s"}, ${ago(latest.completed_at)}` : "no check yet"} />
        {(Object.keys(totals) as ProviderId[]).map((p) => {
          const t = totals[p]!;
          return <Stat key={p} label={label(p)} value={t.skipped ? "—" : t.available === 0 ? "—" : `${t.found} / ${t.available}`} note={t.skipped ? "not configured yet" : t.available === 0 ? "could not be reached" : `of ${t.total} questions`} />;
        })}
      </div>

      <div className="ad-two" style={{ marginTop: 14 }}>
        <div className="ad-card ad-card-pad">
          <p className="ad-k">Where things stand</p>
          {item(published, published ? "Profile published" : "Profile not published yet",
            published
              ? <>Live at <a href={`/b/${b.slug}`} target="_blank" rel="noopener" style={{ color: "var(--ad-amber-2)" }}>bilabs.ai/b/{b.slug}</a> · updated {fmtDate(b.republished_at)}</>
              : <>Finish setup to publish.</>)}
          {item(published ? Boolean(b.indexnow_pinged_at) : null, "Search index notified", b.indexnow_pinged_at ? `IndexNow pinged ${fmtDate(b.indexnow_pinged_at)}` : "Sent on publish")}
          {item(running ? null : Boolean(b.last_check_at), running ? "Check running now…" : b.last_check_at ? "Last check" : "First check", running ? "Usually under a minute." : b.last_check_at ? `${fmtDate(b.last_check_at, true)}` : "Runs the moment you publish")}
          {item(b.next_check_at ? true : null, "Next scheduled check", b.next_check_at ? fmtDate(b.next_check_at) : "After publishing")}
        </div>

        <div className="ad-card ad-card-pad">
          <p className="ad-k">Run a check now</p>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ad-ink-2)", margin: 0 }}>
            Ask every chosen assistant the five questions again, right now. One a day, four a month on top of the scheduled run.
          </p>
          <button type="button" className="ad-btn amber" style={{ marginTop: 12 }} disabled={!published || Boolean(running)} onClick={runNow}>
            {running ? "Running…" : "Run a check"}
          </button>
          {err ? <p style={{ color: "var(--ad-bad)", fontSize: 13, margin: "8px 0 0" }}>{err}</p> : null}
          <p className="ad-note" style={{ marginTop: 12 }}>
            Answers shift as sources change — that is the point of asking monthly. See every answer on the <button type="button" className="ad-btn" style={{ padding: "2px 8px" }} onClick={() => onGo("results")}>Results</button> tab.
          </p>
        </div>
      </div>

      {latest?.competitors?.length ? (
        <div className="ad-card ad-card-pad" style={{ marginTop: 14 }}>
          <p className="ad-k">Named instead of, or alongside, you</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {latest.competitors.map((c) => <span key={c} className="ad-badge" style={{ textTransform: "none", letterSpacing: 0, fontSize: 12 }}>{c}</span>)}
          </div>
        </div>
      ) : null}
    </>
  );
}
