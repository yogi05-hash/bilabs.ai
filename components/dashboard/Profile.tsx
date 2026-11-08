"use client";

import { useState } from "react";
import DetailsForm, { detailsFrom, type Details } from "@/components/dashboard/DetailsForm";
import { PROVIDER_BLURB, type Call, type Me, type ProviderId } from "@/components/dashboard/types";

/* Editing a live profile. Saving stores; publishing pushes the change to the
 * public page, re-pings the index and keeps the monthly schedule as it is. */

export default function Profile({ me, call, onChange }: { me: Me; call: Call; onChange: () => Promise<void> }) {
  const b = me.business!;
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState(b.name ?? "");
  const [website, setWebsite] = useState(b.website ?? "");
  const [type, setType] = useState(b.business_type ?? "");
  const [area, setArea] = useState(b.area ?? "");
  const [postcode, setPostcode] = useState(b.postcode ?? "");
  const [models, setModels] = useState<ProviderId[]>(b.target_models ?? []);

  const save = async (d: Details) => {
    setSaving(true); setMsg(null); setErrors({});
    const res = await call("/api/me/business", {
      method: "PATCH",
      body: JSON.stringify({ ...d, name, website, business_type: type, area, postcode, target_models: models }),
    });
    if (!res) { setErrors({ form: "Could not save." }); setSaving(false); return; }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErrors({ form: j.error ?? "Could not save." }); setSaving(false); return; }

    const pub = await call("/api/me/publish", { method: "POST" });
    const pj = pub ? await pub.json().catch(() => ({})) : {};
    setSaving(false);
    if (!pub || !pub.ok) { setErrors(pj.errors ?? { form: pj.error ?? "Saved, but could not publish." }); return; }
    setMsg("Published. The public page updates within a few seconds.");
    await onChange();
  };

  return (
    <div style={{ maxWidth: 760 }}>
      {msg ? <div className="ad-card ad-card-pad" style={{ marginBottom: 12, borderColor: "rgba(22,124,69,.4)" }}>{msg}</div> : null}
      <div className="ad-card ad-card-pad" style={{ marginBottom: 12 }}>
        <p className="ad-k">Basics</p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label className="ad-field"><span className="ad-label">Business name</span><input className="ad-input" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="ad-field"><span className="ad-label">Website</span><input className="ad-input" maxLength={160} value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          <label className="ad-field"><span className="ad-label">What you do</span><input className="ad-input" maxLength={80} value={type} onChange={(e) => setType(e.target.value)} /></label>
          <label className="ad-field"><span className="ad-label">Where</span><input className="ad-input" maxLength={80} value={area} onChange={(e) => setArea(e.target.value)} /></label>
          <label className="ad-field"><span className="ad-label">Postcode</span><input className="ad-input" maxLength={12} value={postcode} onChange={(e) => setPostcode(e.target.value)} /></label>
        </div>
        <p className="ad-k" style={{ marginTop: 16 }}>Assistants we check</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {me.providers.map((p) => {
            const on = models.includes(p.id);
            return (
              <button key={p.id} type="button" className="ad-choice" aria-pressed={on} disabled={!p.enabled} title={PROVIDER_BLURB[p.id]} style={{ padding: "8px 12px" }}
                onClick={() => setModels((m) => (on ? m.filter((x) => x !== p.id) : [...m, p.id]))}>
                <span aria-hidden>{on ? "☑" : "☐"}</span> <span style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="ad-card ad-card-pad">
        <DetailsForm initial={detailsFrom(b)} errors={errors} saving={saving} submitLabel="Save and publish changes" onSubmit={save} />
      </div>
    </div>
  );
}
