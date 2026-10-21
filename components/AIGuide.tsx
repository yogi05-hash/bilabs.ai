"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/* One guide panel for the whole site. Any section opens it with a context key,
 * so a package card and the hero start different conversations instead of
 * sharing one generic chat. Desktop: slides in from the right. Mobile:
 * full-height bottom sheet. */

type GuideApi = { open: (context: string, seed?: string) => void };
const Ctx = createContext<GuideApi>({ open: () => {} });
export const useGuide = () => useContext(Ctx);

type Msg = { role: "user" | "assistant"; content: string };
type Reply = { message: string; quick_replies: string[]; next_step: { label: string; url: string } | null };

const OPENERS: Record<string, string> = {
  hero: "What does BiLabs actually do?",
  problem: "Why does AI visibility matter for my business?",
  "how-it-works": "How does this work, step by step?",
  audit: "Tell me about the £149 AI Visibility Audit.",
  "get-found": "Tell me about Get Found by AI.",
  "front-desk": "Tell me about the AI Front Desk.",
  report: "I just ran the check — what should I do about it?",
  faq: "I have a question.",
};

const TITLES: Record<string, string> = {
  hero: "What we do",
  problem: "Why it matters",
  "how-it-works": "How it works",
  audit: "AI Visibility Audit — £149",
  "get-found": "Get Found by AI",
  "front-desk": "AI Front Desk",
  report: "Your result",
  faq: "Ask anything",
};

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [openCtx, setOpenCtx] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [quick, setQuick] = useState<string[]>([]);
  const [step, setStep] = useState<Reply["next_step"]>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const spent = msgs.filter((m) => m.role === "user").length >= 8;

  const ask = useCallback(async (context: string, history: Msg[]) => {
    setPending(true);
    try {
      const res = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, messages: history }),
      });
      const data: Reply = await res.json();
      setMsgs((m) => [...m, { role: "assistant", content: data.message }]);
      setQuick(Array.isArray(data.quick_replies) ? data.quick_replies : []);
      setStep(data.next_step ?? null);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "I can't reach my notes this second — the free check on this page still works." }]);
      setQuick([]);
      setStep({ label: "Run the free check", url: "#check" });
    } finally {
      setPending(false);
    }
  }, []);

  const open = useCallback((context: string, seed?: string) => {
    const first = seed || OPENERS[context] || OPENERS.faq;
    const history: Msg[] = [{ role: "user", content: first }];
    setOpenCtx(context); setMsgs(history); setQuick([]); setStep(null); setDraft("");
    void ask(context, history);
  }, [ask]);

  const send = useCallback((text: string) => {
    const t = text.trim();
    if (!t || pending || spent || !openCtx) return;
    const history: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(history); setQuick([]); setStep(null); setDraft("");
    void ask(openCtx, history);
  }, [ask, msgs, openCtx, pending, spent]);

  const close = useCallback(() => setOpenCtx(null), []);

  useEffect(() => {
    if (!openCtx) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [openCtx, close]);

  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, pending, quick, step]);

  const isOpen = openCtx !== null;

  return (
    <Ctx.Provider value={{ open }}>
      {children}

      <div
        onClick={close}
        aria-hidden
        style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(2,2,4,0.6)", backdropFilter: "blur(2px)",
                 opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: "opacity .3s ease" }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={openCtx ? TITLES[openCtx] ?? "Guide" : "Guide"}
        data-open={isOpen}
        className="guide-panel"
        style={{ transform: isOpen ? "translate(0,0)" : "translateY(100%)", visibility: isOpen ? "visible" : "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border-strong)" }}>
          <span style={{ width: 34, height: 34, borderRadius: 999, background: "var(--accent-gradient)", display: "grid", placeItems: "center", color: "#0a0a0f", fontWeight: 700, flexShrink: 0 }}>◆</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "var(--text-1)" }}>{openCtx ? TITLES[openCtx] ?? "Ask anything" : "Ask anything"}</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)" }}>Guided by AI · answers from our real packages</p>
          </div>
          <button onClick={close} aria-label="Close guide" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-2)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div ref={scroller} style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <p style={{
                margin: 0, maxWidth: "86%", borderRadius: 16, padding: "10px 14px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
                background: m.role === "user" ? "var(--accent)" : "var(--bg-glass-light)",
                color: m.role === "user" ? "#0a0a0f" : "var(--text-1)",
                border: m.role === "user" ? "none" : "1px solid var(--border-strong)",
              }}>{m.content}</p>
            </div>
          ))}

          {pending && (
            <div style={{ display: "flex" }}>
              <p aria-label="Thinking" style={{ margin: 0, borderRadius: 16, padding: "12px 16px", background: "var(--bg-glass-light)", border: "1px solid var(--border-strong)", display: "flex", gap: 4 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)", opacity: 0.7, animation: `guideblink 1.1s step-end ${i * 0.18}s infinite` }} />
                ))}
              </p>
            </div>
          )}

          {!pending && quick.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
              {quick.map((q) => (
                <button key={q} onClick={() => send(q)} className="guide-quick">{q}</button>
              ))}
            </div>
          )}

          {!pending && step && (
            <div style={{ paddingTop: 6 }}>
              <a href={step.url} onClick={close} className="btn-primary" style={{ display: "inline-flex", padding: "11px 22px", fontSize: 14 }}>{step.label}</a>
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--border-strong)", padding: "12px 16px" }}>
          {spent ? (
            <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>
              That&apos;s plenty from me — <a href="#packages" onClick={close} style={{ color: "var(--accent)" }}>see the packages</a>.
            </p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); send(draft); }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type your own question…"
                maxLength={200}
                disabled={pending}
                aria-label="Ask the guide a question"
                className="form-input"
                style={{ flex: 1, minWidth: 0, padding: "10px 14px", fontSize: 14 }}
              />
              <button type="submit" disabled={pending || !draft.trim()} aria-label="Send" className="btn-primary" style={{ padding: "10px 16px", fontSize: 14, opacity: pending || !draft.trim() ? 0.45 : 1 }}>↑</button>
            </form>
          )}
        </div>
      </aside>
    </Ctx.Provider>
  );
}
