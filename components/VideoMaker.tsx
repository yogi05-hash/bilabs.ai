"use client";

import { useRef, useState } from "react";
import { Clapperboard, Download, Loader2, RotateCcw, Sparkles } from "lucide-react";
import FadeIn from "@/components/FadeIn";

type Phase = "idle" | "rendering" | "done" | "error";

export default function VideoMaker() {
  const [brand, setBrand] = useState("");
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const generate = async () => {
    if (!brand.trim() || !message.trim() || phase === "rendering") return;
    setPhase("rendering");
    setError(null);
    setVideoUrl(null);

    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");

      const started = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - started > 120_000) {
          stopPolling();
          setError("Render timed out — please try again.");
          setPhase("error");
          return;
        }
        try {
          const poll = await fetch(`/api/video?id=${data.id}`);
          const status = await poll.json();
          if (status.status === "succeeded" && status.url) {
            stopPolling();
            setVideoUrl(status.url);
            setPhase("done");
          } else if (status.status === "failed") {
            stopPolling();
            setError("Render failed — please try again.");
            setPhase("error");
          }
        } catch {
          /* transient poll error — keep trying until timeout */
        }
      }, 2500);
    } catch (e) {
      stopPolling();
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  };

  const reset = () => {
    stopPolling();
    setPhase("idle");
    setVideoUrl(null);
    setError(null);
  };

  return (
    <section id="video-demo" style={{ background: "var(--bg-card)" }}>
      <div className="section">
        <FadeIn>
          <div className="section-tag">Live Demo</div>
          <h2 className="section-title">Type two lines. Get a video.</h2>
          <p className="section-subtitle">
            This is the kind of automation we build — a real AI video pipeline, running
            live on this page. Enter your brand and a message, and our render engine
            produces a branded promo clip in about 30 seconds.
          </p>
        </FadeIn>

        <FadeIn delay={0.12}>
          <div
            className="glass-card product-card"
            style={{
              marginTop: 48,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 40,
              alignItems: "center",
            }}
          >
            {/* form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ fontSize: 14, color: "var(--text-2)" }}>
                Your brand or business
                <input
                  className="form-input"
                  style={{ marginTop: 6 }}
                  placeholder="e.g. Acme Coffee"
                  maxLength={40}
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  disabled={phase === "rendering"}
                />
              </label>
              <label style={{ fontSize: 14, color: "var(--text-2)" }}>
                One-line message
                <input
                  className="form-input"
                  style={{ marginTop: 6 }}
                  placeholder="e.g. Fresh roasts, delivered same day"
                  maxLength={120}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={phase === "rendering"}
                />
              </label>

              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
                <button
                  className="btn-primary"
                  style={{ gap: 8, fontSize: 15, padding: "14px 28px", border: "none", cursor: "pointer" }}
                  onClick={generate}
                  disabled={phase === "rendering" || !brand.trim() || !message.trim()}
                >
                  {phase === "rendering" ? (
                    <>
                      <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                      Rendering…
                    </>
                  ) : (
                    <>
                      <Clapperboard size={18} />
                      Generate my video
                    </>
                  )}
                </button>
                {(phase === "done" || phase === "error") && (
                  <button
                    className="btn-secondary"
                    style={{ gap: 8, fontSize: 15, padding: "14px 20px", cursor: "pointer" }}
                    onClick={reset}
                  >
                    <RotateCcw size={16} />
                    Start over
                  </button>
                )}
              </div>

              {error && (
                <div style={{ color: "#ff8f6b", fontSize: 14 }}>{error}</div>
              )}

              <div style={{ fontSize: 13, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={14} style={{ color: "var(--accent)" }} />
                Want this wired into your product or marketing stack? That&apos;s what we do.
              </div>
            </div>

            {/* preview */}
            <div
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 16,
                overflow: "hidden",
                background: "var(--bg)",
                border: "1px solid var(--border-strong)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {phase === "done" && videoUrl ? (
                <>
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    muted
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <a
                    href={videoUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: "rgba(5,5,7,0.75)",
                      border: "1px solid var(--border-strong)",
                      color: "var(--accent)",
                      fontSize: 13,
                      textDecoration: "none",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <Download size={14} />
                    Download
                  </a>
                </>
              ) : phase === "rendering" ? (
                <div style={{ textAlign: "center", color: "var(--text-2)", padding: 24 }}>
                  <Loader2
                    size={36}
                    style={{ color: "var(--accent)", animation: "spin 1s linear infinite", marginBottom: 16 }}
                  />
                  <div style={{ fontSize: 15 }}>Rendering your video…</div>
                  <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
                    Usually 20–40 seconds
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>
                  <Clapperboard size={36} style={{ color: "var(--accent)", opacity: 0.5, marginBottom: 16 }} />
                  <div style={{ fontSize: 15 }}>Your video will appear here</div>
                </div>
              )}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
