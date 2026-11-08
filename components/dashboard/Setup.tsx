"use client";

import { useState } from "react";
import DetailsForm, { detailsFrom, type Details } from "@/components/dashboard/DetailsForm";
import { PROVIDER_BLURB, type Call, type Me, type ProviderId } from "@/components/dashboard/types";

/* Setup, in three steps and a publish.
 *
 * Each step is its own PATCH, so a customer who closes the tab halfway
 * resumes where they stopped. The publish is the one moment anything becomes
 * public — and the moment the first check starts. */

const HONESTY = "Publishing makes your business readable to AI web search. We measure whether assistants name you; we cannot make them.";

export default function Setup({ me, call, onChange }: { me: Me; call: Call; onChange: () => Promise<void> }) {
  const b = me.business!;
  const [step, setStep] = useState<number>(Math.min(b.onboarding_step, 3));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [published, setPublished] = useState<string | null>(null);

  const [name, setName] = useState(b.name ?? "");
  const [website, setWebsite] = useState(b.website ?? "");
  const [type, setType] = useState(b.business_type ?? "");
  const [area, setArea] = useState(b.area ?? "");
  const [postcode, setPostcode] = useState(b.postcode ?? "");
  const [confirm, setConfirm] = useState(false);
  const [models, setModels] = useState<ProviderId[]>(b.target_models?.length ? b.target_models : me.providers.filter((p) => p.enabled).map((p) => p.id));

  const patch = async (body: Record<string, unknown>): Promise<boolean> => {
    setSaving(true); setErr(null); setErrors({});
    const res = await call("/api/me/business", { method: "PATCH", body: JSON.stringify(body) });
    setSaving(false);
    if (!res) { setErr("Could not save just now."); return false; }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error ?? "Could not save just now."); return false; }
    await onChange();
    return true;
  };

  const saveConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await patch({ step: 1, confirm, name, website, business_type: type, area, postcode })) setStep(1);
  };
  const saveModels = async () => {
    if (await patch({ step: 2, target_models: models })) setStep(2);
  };
  const saveDetails = async (d: Details) => {
    if (await patch({ step: 3, ...d })) setStep(3);
  };
  const publish = async () => {
    setSaving(true); setErr(null); setErrors({});
    const res = await call("/api/me/publish", { method: "POST" });
    setSaving(false);
    if (!res) { setErr("Could not publish just now."); return; }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error ?? "Could not publish just now."); setErrors(d.errors ?? {}); return; }
    setPublished(d.url);
    await onChange();
  };

  const steps = ["Confirm", "Assistants", "Details", "Publish"];

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="ad-steps">
        {steps.map((s, i) => (
          <span key={s} className={`ad-step ${i === step ? "on" : i < step ? "done" : ""}`}>{i + 1}. {s}</span>
        ))}
      </div>

      {err ? <div className="ad-err" role="alert">{err}</div> : null}

      {step === 0 && (
        <form onSubmit={saveConfirm} className="ad-card ad-card-pad">
          <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Is this your business?</h2>
          <p className="ad-note" style={{ marginBottom: 14 }}>We&apos;ve filled in what your free check found. Correct anything that&apos;s wrong.</p>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label className="ad-field"><span className="ad-label">Business name</span><input className="ad-input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="ad-field"><span className="ad-label">Website</span><input className="ad-input" maxLength={160} placeholder="yourbusiness.co.uk" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
            <label className="ad-field"><span className="ad-label">What you do</span><input className="ad-input" required maxLength={80} placeholder="e.g. dentist" value={type} onChange={(e) => setType(e.target.value)} /></label>
            <label className="ad-field"><span className="ad-label">Where</span><input className="ad-input" required maxLength={80} placeholder="e.g. Croydon" value={area} onChange={(e) => setArea(e.target.value)} /></label>
            <label className="ad-field"><span className="ad-label">Postcode (optional)</span><input className="ad-input" maxLength={12} value={postcode} onChange={(e) => setPostcode(e.target.value)} /></label>
          </div>
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 16, cursor: "pointer", fontSize: 13.5 }}>
            <input type="checkbox" required checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ marginTop: 3 }} />
            <span>This is my business, and I&apos;m authorised to publish its details.</span>
          </label>
          <button type="submit" className="ad-btn amber" disabled={saving} style={{ marginTop: 16 }}>{saving ? "Saving…" : "Continue →"}</button>
        </form>
      )}

      {step === 1 && (
        <div className="ad-card ad-card-pad">
          <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Which assistants should we check?</h2>
          <p className="ad-note" style={{ marginBottom: 14 }}>All are included. Each one is asked five questions with live web search, every month.</p>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {me.providers.map((p) => {
              const on = models.includes(p.id);
              return (
                <button
                  key={p.id} type="button" className="ad-choice" aria-pressed={on} disabled={!p.enabled}
                  onClick={() => setModels((m) => (on ? m.filter((x) => x !== p.id) : [...m, p.id]))}
                >
                  <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>{on ? "☑" : "☐"}</span>
                  <span style={{ textAlign: "left" }}>
                    <strong style={{ display: "block", fontSize: 14 }}>{p.label}{!p.enabled ? <span className="ad-badge" style={{ marginLeft: 8 }}>coming soon</span> : null}</strong>
                    <span style={{ fontSize: 12.5, color: "var(--ad-ink-2)", lineHeight: 1.45, display: "block", marginTop: 3 }}>{PROVIDER_BLURB[p.id]}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" className="ad-btn" onClick={() => setStep(0)}>← Back</button>
            <button type="button" className="ad-btn amber" disabled={saving || models.length === 0} onClick={saveModels}>{saving ? "Saving…" : "Continue →"}</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="ad-card ad-card-pad">
          <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Tell assistants what you do</h2>
          <p className="ad-note">This is what gets published. Plain facts work best — no slogans needed.</p>
          <DetailsForm initial={detailsFrom(b)} saving={saving} submitLabel="Save and continue →" onSubmit={saveDetails} />
          <button type="button" className="ad-btn" style={{ marginTop: 10 }} onClick={() => setStep(1)}>← Back</button>
        </div>
      )}

      {step === 3 && !published && (
        <div className="ad-card ad-card-pad">
          <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Ready to publish</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ad-ink-2)", margin: "0 0 12px" }}>
            Your profile goes live at <strong>bilabs.ai/b/…</strong>, we tell the search index it exists, and your first check runs straight away
            across {models.map((m) => me.providers.find((p) => p.id === m)?.label).filter(Boolean).join(", ")}.
          </p>
          {Object.keys(errors).length ? (
            <ul style={{ color: "var(--ad-bad)", fontSize: 13, paddingLeft: 18, margin: "0 0 12px" }}>
              {Object.values(errors).map((e) => <li key={e}>{e}</li>)}
            </ul>
          ) : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="ad-btn" onClick={() => setStep(2)}>← Edit details</button>
            <button type="button" className="ad-btn amber" disabled={saving} onClick={publish}>{saving ? "Publishing…" : "Publish my profile"}</button>
          </div>
          <p className="ad-note" style={{ marginTop: 14 }}>{HONESTY}</p>
        </div>
      )}

      {published && (
        <div className="ad-card ad-card-pad">
          <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>You&apos;re live</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ad-ink-2)" }}>
            Your profile is at <a href={published} target="_blank" rel="noopener" style={{ color: "var(--ad-amber-2)", fontWeight: 600 }}>{published.replace(/^https?:\/\//, "")}</a>.
            The first check is running now — results appear on the Overview tab within a minute or two, and in your inbox.
          </p>
        </div>
      )}
    </div>
  );
}
