"use client";

import { useEffect, useRef, useState } from "react";

type Line = { text: string; kind: "cmd" | "ok" | "info" };

const FEED: Line[] = [
  { text: "$ bilabs deploy yourbotchat --prod", kind: "cmd" },
  { text: "✓ live in 47s — chatbot answering on client site", kind: "ok" },
  { text: "▸ reelmaker · 1,204 videos rendered this month", kind: "info" },
  { text: "$ bilabs automate invoice-chase --schedule daily", kind: "cmd" },
  { text: "✓ shipped — 31 hours saved this week", kind: "ok" },
  { text: "▸ support-bot · 214 conversations handled overnight", kind: "info" },
  { text: "$ bilabs deploy video-pipeline --client retail", kind: "cmd" },
  { text: "✓ render engine live — first clip in 28s", kind: "ok" },
  { text: "▸ crm-sync · 3,800 records enriched, zero manual entry", kind: "info" },
  { text: "$ bilabs deploy lead-router --prod", kind: "cmd" },
  { text: "✓ live — replies in under 60 seconds, 24/7", kind: "ok" },
  { text: "▸ 50+ automations running in production", kind: "info" },
];

const VISIBLE = 7;

export default function ShipLog() {
  const [count, setCount] = useState(3);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => setCount((c) => c + 1), 1900);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const lines: Line[] = [];
  const start = Math.max(0, count - VISIBLE);
  for (let i = start; i < count; i++) lines.push(FEED[i % FEED.length]);

  return (
    <div
      className="hero-visual"
      style={{
        borderRadius: 16,
        border: "1px solid var(--border-strong)",
        background: "rgba(8, 8, 12, 0.85)",
        backdropFilter: "blur(12px)",
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,183,49,0.06)",
      }}
    >
      {/* title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3a3a42" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3a3a42" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3a3a42" }} />
        <span
          style={{
            marginLeft: 10,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
            letterSpacing: "0.06em",
            color: "var(--text-3)",
          }}
        >
          bilabs — ship log
        </span>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            letterSpacing: "0.12em",
            color: "#7ED99B",
          }}
        >
          <span className="pulse-dot" />
          LIVE
        </span>
      </div>

      {/* feed */}
      <div
        style={{
          padding: "18px 18px 16px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13.5,
          lineHeight: 2.1,
          minHeight: VISIBLE * 28 + 34,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {lines.map((l, i) => (
          <div
            key={start + i}
            className="log-line"
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color:
                l.kind === "cmd"
                  ? "var(--text-2)"
                  : l.kind === "ok"
                  ? "#7ED99B"
                  : "rgba(245, 183, 49, 0.85)",
              opacity: i === lines.length - 1 ? 1 : 0.45 + (i / lines.length) * 0.45,
            }}
          >
            {l.text}
          </div>
        ))}
        <div style={{ color: "var(--text-2)" }}>
          $ <span className="cursor-blink">▊</span>
        </div>
      </div>
    </div>
  );
}
