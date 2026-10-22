"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

/* Admin dashboard.
 *
 * The browser only ever holds a Supabase session; every figure on this page
 * comes from a server route that re-verifies that token and checks the email
 * against the allowlist. Nothing here trusts the client, so a stray session
 * from another product on the shared Supabase project gets 401s, not data. */

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
);

type Lead = {
  id: string; name: string | null; email: string | null; website: string | null;
  company: string | null; business_type: string | null; area: string | null;
  source: string | null; mentions: number | null; mentions_total: number | null;
  readiness_score: number | null; marketing_consent: boolean; status: string;
  created_at: string; last_emailed_at: string | null; nurture_step: number;
  notes: string | null; report: unknown;
};
type Ev = { kind: string; detail: string | null; created_at: string };
type Stats = { today: number; week: number; checks: number; paid: number; nurturing: number; total: number; mrr: number | null; activeSubs: number | null };

const STATUSES = ["new", "nurturing", "paid", "unsubscribed", "lost"];
const SOURCES = ["check", "contact", "checkout", "guide", "ai-check-unlock"];

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState<"created_at" | "score">("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [open, setOpen] = useState<Lead | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [notes, setNotes] = useState("");
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const call = useCallback(async (path: string, init?: RequestInit) => {
    const token = session?.access_token;
    if (!token) return null;
    const res = await fetch(path, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (res.status === 401) { setDenied(true); return null; }
    setDenied(false);
    return res.json();
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (source) params.set("source", source);
    params.set("sort", sort); params.set("dir", dir);
    const [l, s] = await Promise.all([call(`/api/admin/leads?${params}`), call("/api/admin/stats")]);
    if (l?.leads) setLeads(l.leads);
    if (s && !s.error) setStats(s);
    setLoading(false);
  }, [session, q, status, source, sort, dir, call]);

  useEffect(() => { void load(); }, [load]);

  const openLead = async (lead: Lead) => {
    setOpen(lead); setNotes(lead.notes ?? ""); setEvents([]);
    const d = await call(`/api/admin/lead?id=${lead.id}`);
    if (d?.events) setEvents(d.events);
    if (d?.lead) setOpen(d.lead);
  };

  const update = async (id: string, patch: Record<string, unknown>) => {
    await call("/api/admin/lead", { method: "PATCH", body: JSON.stringify({ id, ...patch }) });
    await load();
    if (open?.id === id) {
      const d = await call(`/api/admin/lead?id=${id}`);
      if (d?.lead) setOpen(d.lead);
      if (d?.events) setEvents(d.events);
    }
  };

  const csv = useMemo(() => {
    const cols = ["created_at", "name", "email", "company", "website", "business_type", "area", "source", "mentions", "mentions_total", "readiness_score", "marketing_consent", "status", "nurture_step", "notes"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [cols.join(","), ...leads.map((l) => cols.map((c) => esc((l as unknown as Record<string, unknown>)[c])).join(","))].join("\n");
  }, [leads]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `bilabs-leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/admin` : undefined },
    });
    if (error) setAuthErr(error.message); else setSent(true);
  };

  if (!ready) return <Shell><p className="body">Loading…</p></Shell>;

  if (!session) {
    return (
      <Shell>
        <h1 className="h2">Admin</h1>
        {sent ? (
          <p className="body" style={{ marginTop: 14 }}>
            Check your email for a sign-in link. It only works for approved addresses.
          </p>
        ) : (
          <form onSubmit={signIn} style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap", maxWidth: 440 }}>
            <input className="form-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@bilabs.ai" aria-label="Email" style={{ flex: "1 1 220px", padding: "12px 14px" }} />
            <button className="btn-amber" type="submit">Email me a link</button>
          </form>
        )}
        {authErr && <p style={{ marginTop: 12, color: "#9a2a2a", fontSize: 14 }}>{authErr}</p>}
      </Shell>
    );
  }

  if (denied) {
    return (
      <Shell>
        <h1 className="h2">Not an admin</h1>
        <p className="body" style={{ marginTop: 12 }}>
          {session.user.email} is signed in but is not on the admin list.
        </p>
        <button className="btn-line" style={{ marginTop: 18 }} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <h1 className="h2" style={{ fontSize: "1.9rem" }}>Leads</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{session.user.email}</span>
          <button className="btn-line" style={{ padding: "8px 14px", fontSize: 13 }} onClick={download}>Export CSV</button>
          <button className="btn-line" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginTop: 20 }}>
          <Stat label="Leads today" value={stats.today} />
          <Stat label="This week" value={stats.week} />
          <Stat label="Checks run" value={stats.checks} />
          <Stat label="Nurturing" value={stats.nurturing} />
          <Stat label="Paid" value={stats.paid} />
          <Stat label="MRR" value={stats.mrr === null ? "—" : `£${stats.mrr.toFixed(0)}`} hint={stats.activeSubs !== null ? `${stats.activeSubs} active` : undefined} />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
        <input className="form-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, business, website…"
          aria-label="Search" style={{ flex: "1 1 240px", padding: "10px 14px", fontSize: 14 }} />
        <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status" style={{ padding: "10px 14px", fontSize: 14 }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-input" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter source" style={{ padding: "10px 14px", fontSize: 14 }}>
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-input" value={`${sort}:${dir}`} onChange={(e) => { const [s, d] = e.target.value.split(":"); setSort(s as "created_at" | "score"); setDir(d as "asc" | "desc"); }}
          aria-label="Sort" style={{ padding: "10px 14px", fontSize: 14 }}>
          <option value="created_at:desc">Newest first</option>
          <option value="created_at:asc">Oldest first</option>
          <option value="score:desc">Score high → low</option>
          <option value="score:asc">Score low → high</option>
        </select>
      </div>

      <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 12 }}>
        {loading ? "Loading…" : `${leads.length} lead${leads.length === 1 ? "" : "s"}`}
      </p>

      <div style={{ overflowX: "auto", marginTop: 8, border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 760 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "var(--warm-alt)" }}>
              {["When", "Who", "Business", "Score", "Mentions", "Source", "Consent", "Status"].map((h) => (
                <th key={h} style={{ padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} onClick={() => openLead(l)} style={{ borderTop: "1px solid var(--line)", cursor: "pointer" }}>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--ink-3)" }}>{new Date(l.created_at).toLocaleDateString("en-GB")}</td>
                <td style={{ padding: "10px 12px" }}>{l.name || l.email || "—"}<br /><span style={{ color: "var(--ink-3)", fontSize: 12 }}>{l.email}</span></td>
                <td style={{ padding: "10px 12px" }}>{l.company || l.website || "—"}<br /><span style={{ color: "var(--ink-3)", fontSize: 12 }}>{[l.business_type, l.area].filter(Boolean).join(" · ")}</span></td>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{l.readiness_score ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>{l.mentions !== null && l.mentions_total !== null ? `${l.mentions}/${l.mentions_total}` : "—"}</td>
                <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>{l.source ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>{l.marketing_consent ? "yes" : "no"}</td>
                <td style={{ padding: "10px 12px" }}><Badge status={l.status} /></td>
              </tr>
            ))}
            {!leads.length && !loading && (
              <tr><td colSpan={8} style={{ padding: 20, color: "var(--ink-3)" }}>No leads match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,.5)", zIndex: 80, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "min(560px,100%)", height: "100%", overflowY: "auto", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{open.company || open.name || open.email}</h2>
              <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
              {open.email} · {open.website || "no website"} · {[open.business_type, open.area].filter(Boolean).join(" · ")}
            </p>
            <p style={{ margin: "10px 0 0" }}><Badge status={open.status} /> <span style={{ fontSize: 12.5, color: "var(--ink-3)", marginLeft: 8 }}>consent: {open.marketing_consent ? "yes" : "no"} · step {open.nurture_step}</span></p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              <button className="btn-line" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => update(open.id, { status: "paid" })}>Mark paid</button>
              <button className="btn-line" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => update(open.id, { status: "lost" })}>Mark lost</button>
              <button className="btn-line" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => update(open.id, { status: "nurturing" })}>Resume nurture</button>
            </div>

            <ReportView report={open.report} score={open.readiness_score} mentions={open.mentions} total={open.mentions_total} />

            <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 24 }}>Notes</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="form-input"
              style={{ width: "100%", marginTop: 8, padding: 12, fontSize: 13.5 }} placeholder="Anything worth remembering…" />
            <button className="btn-amber" style={{ marginTop: 8, padding: "9px 16px", fontSize: 13.5 }} onClick={() => update(open.id, { notes })}>Save note</button>

            <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 24 }}>History</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", fontSize: 13 }}>
              {events.map((e, i) => (
                <li key={i} style={{ padding: "7px 0", borderBottom: "1px solid var(--line)", color: "var(--ink-2)" }}>
                  <strong style={{ color: "var(--ink)" }}>{e.kind}</strong>{e.detail ? ` — ${e.detail}` : ""}
                  <span style={{ float: "right", color: "var(--ink-3)" }}>{new Date(e.created_at).toLocaleString("en-GB")}</span>
                </li>
              ))}
              {!events.length && <li style={{ color: "var(--ink-3)", padding: "7px 0" }}>Nothing recorded yet.</li>}
            </ul>
          </div>
        </div>
      )}
    </Shell>
  );
}

function ReportView({ report, score, mentions, total }: { report: unknown; score: number | null; mentions: number | null; total: number | null }) {
  const r = (report ?? {}) as { competitors?: string[]; scan?: { checks?: { label: string; pass: boolean; weight: number }[] } | null };
  const checks = r.scan?.checks ?? [];
  if (!checks.length && !(r.competitors ?? []).length) {
    return <p style={{ marginTop: 20, fontSize: 13.5, color: "var(--ink-3)" }}>No check report stored for this lead.</p>;
  }
  return (
    <>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 24 }}>
        Their check {score !== null ? `— ${score}/100` : ""} {mentions !== null && total !== null ? `· mentioned ${mentions}/${total}` : ""}
      </h3>
      {!!checks.length && (
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", fontSize: 13.5 }}>
          {checks.map((c) => (
            <li key={c.label} style={{ padding: "5px 0", color: "var(--ink-2)" }}>
              <span style={{ marginRight: 8 }}>{c.pass ? "✅" : "❌"}</span>{c.label} <span style={{ color: "var(--ink-3)" }}>({c.weight})</span>
            </li>
          ))}
        </ul>
      )}
      {!!(r.competitors ?? []).length && (
        <p style={{ marginTop: 10, fontSize: 13, color: "var(--ink-2)" }}>
          <strong>Named instead:</strong> {(r.competitors ?? []).join(", ")}
        </p>
      )}
    </>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "#1f6b36", nurturing: "#9a5a12", new: "#444", unsubscribed: "#777", lost: "#9a2a2a",
  };
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#fff", background: map[status] ?? "#444", borderRadius: 999, padding: "3px 9px" }}>
      {status}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px" }}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700 }}>{value}</p>
      {hint && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--ink-3)" }}>{hint}</p>}
    </div>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ paddingTop: 92, minHeight: "100vh" }}>
      <section className="sec" style={{ paddingTop: 20 }}>
        <div className="wrap" style={{ maxWidth: wide ? 1200 : 620 }}>{children}</div>
      </section>
    </div>
  );
}
