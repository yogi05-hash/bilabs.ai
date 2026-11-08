"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, Loading, fmtDate } from "@/components/admin/ui";
import type { Call, Check, CheckResult, Me, ProviderId } from "@/components/dashboard/types";

/* Every check, every answer. The table is the honest view: a tick is "the
 * assistant named you in this answer", a cross is "it did not", a dash is
 * "we could not ask". Expand a row to read the actual answer. */

export default function Results({ me, call }: { me: Me; call: Call }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ check: Check; results: CheckResult[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const label = (id: ProviderId) => me.providers.find((p) => p.id === id)?.label ?? id;

  useEffect(() => {
    void (async () => {
      const res = await call("/api/me/checks");
      const d = res && res.ok ? await res.json() : null;
      const list: Check[] = d?.checks ?? [];
      setChecks(list);
      const first = list.find((c) => c.status === "completed") ?? list[0];
      if (first) setSelected(first.id);
    })();
  }, [call]);

  const load = useCallback(async (id: string) => {
    setDetail(null);
    const res = await call(`/api/me/checks?id=${id}`);
    const d = res && res.ok ? await res.json() : null;
    if (d?.check) setDetail(d);
  }, [call]);

  useEffect(() => { if (selected) void load(selected); }, [selected, load]);

  if (checks === null) return <Loading />;
  if (!checks.length) return <Empty title="No checks yet">The first one runs the moment you publish.</Empty>;

  const c = detail?.check;
  const results = detail?.results ?? [];
  const providers = (c?.providers ?? []) as ProviderId[];
  const questions = c?.questions ?? [];
  const cell = (p: ProviderId, qid: string) => results.find((r) => r.provider === p && r.question_id === qid);

  return (
    <>
      <div className="ad-filters">
        <select className="ad-select" value={selected ?? ""} onChange={(e) => setSelected(e.target.value)} aria-label="Which check">
          {checks.map((k) => (
            <option key={k.id} value={k.id}>
              {fmtDate(k.completed_at ?? k.created_at, true)} · {k.trigger} · {k.status === "completed" ? `${k.found_total}/${k.answers_total}` : k.status}
            </option>
          ))}
        </select>
      </div>

      {!detail ? <Loading /> : c!.status !== "completed" ? (
        <div className="ad-card ad-card-pad">
          <Badge value={c!.status} />
          <p className="ad-note" style={{ marginTop: 8 }}>{c!.failure_reason ?? (c!.status === "running" || c!.status === "queued" ? "Still running — check back in a minute." : "")}</p>
        </div>
      ) : (
        <>
          <div className="ad-tablewrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Question</th>
                  {providers.map((p) => <th key={p} style={{ textAlign: "center" }}>{label(p)}</th>)}
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{q.label}</div>
                      <div className="ad-note" style={{ marginTop: 2 }}>{q.question}</div>
                    </td>
                    {providers.map((p) => {
                      const r = cell(p, q.id);
                      const key = `${p}:${q.id}`;
                      return (
                        <td key={p} style={{ textAlign: "center" }}>
                          {!r || !r.available ? <span className="ad-muted" title={r?.error ?? "could not run"}>—</span> : (
                            <button type="button" className="ad-btn" style={{ padding: "3px 9px" }} aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)} title="Read the answer">
                              {r.found ? "✅" : "❌"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {open ? (() => {
            const [p, qid] = open.split(":") as [ProviderId, string];
            const r = cell(p, qid);
            return r ? (
              <div className="ad-card ad-card-pad" style={{ marginTop: 12 }}>
                <p className="ad-k">{label(p)} · {r.model ?? ""} · {questions.find((q) => q.id === qid)?.label}</p>
                <pre className="ad-code">{r.answer_text ?? "(no text)"}</pre>
                {r.competitors?.length ? <p className="ad-note" style={{ marginTop: 8 }}>Businesses named: {r.competitors.join(" · ")}</p> : null}
              </div>
            ) : null;
          })() : null}

          <div className="ad-grid" style={{ marginTop: 14 }}>
            {providers.map((p) => {
              const t = c!.totals?.[p];
              return (
                <div key={p} className="ad-card">
                  <p className="ad-k">{label(p)}</p>
                  <p className="ad-v">{t && !t.skipped && t.available > 0 ? `${t.found} / ${t.available}` : "—"}</p>
                  <p className="ad-note">{t?.skipped ? t.reason : t?.model ?? ""}</p>
                </div>
              );
            })}
          </div>
          {c!.competitors?.length ? (
            <p className="ad-note" style={{ marginTop: 12 }}>Named across these answers: {c!.competitors.join(" · ")}</p>
          ) : null}
        </>
      )}
    </>
  );
}
