"use client";

import { useState } from "react";
import type { PublicBusiness } from "@/components/dashboard/types";

/* The business details, as a form.
 *
 * Used twice: step three of setup, and later edits on the Profile tab. Every
 * list is a small repeatable editor; nothing is required here except what
 * publishing itself checks (lib/pipeline.validateForPublish), and those
 * errors come back from the server by field. */

type Service = { name: string; description?: string; price?: string };
type HoursRow = { day: Day; open: string; close: string; closed: boolean };
type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAYS: { id: Day; label: string }[] = [
  { id: "mon", label: "Monday" }, { id: "tue", label: "Tuesday" }, { id: "wed", label: "Wednesday" }, { id: "thu", label: "Thursday" },
  { id: "fri", label: "Friday" }, { id: "sat", label: "Saturday" }, { id: "sun", label: "Sunday" },
];

export type Details = {
  description: string;
  services: Service[];
  hours: HoursRow[];
  prices: { item: string; price: string }[];
  areas: string[];
  faqs: { q: string; a: string }[];
  photos: { url: string; alt?: string }[];
  socials: string[];
  phone: string;
  email: string;
  address: string;
};

export function detailsFrom(b: PublicBusiness): Details {
  const hours = DAYS.map(({ id }) => {
    const h = (b.hours ?? []).find((x) => x.day === id);
    return h ? { day: id, open: h.open, close: h.close, closed: h.closed } : { day: id, open: "09:00", close: "17:00", closed: id === "sun" };
  });
  return {
    description: b.description ?? "",
    services: b.services ?? [],
    hours,
    prices: b.prices ?? [],
    areas: b.areas ?? [],
    faqs: b.faqs?.length ? b.faqs : [{ q: "", a: "" }],
    photos: b.photos ?? [],
    socials: b.socials ?? [],
    phone: b.phone ?? "",
    email: b.email ?? "",
    address: b.address ?? "",
  };
}

const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5 };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--ad-ink-2)" };
const hint: React.CSSProperties = { fontSize: 11.5, color: "var(--ad-ink-3)", margin: 0 };
const h = (t: string) => <h3 style={{ fontSize: 14, fontWeight: 700, margin: "22px 0 8px" }}>{t}</h3>;

export default function DetailsForm({
  initial, errors, saving, submitLabel, onSubmit,
}: {
  initial: Details;
  errors?: Record<string, string>;
  saving: boolean;
  submitLabel: string;
  onSubmit: (d: Details) => void;
}) {
  const [d, setD] = useState<Details>(initial);
  const set = <K extends keyof Details>(k: K, v: Details[K]) => setD((x) => ({ ...x, [k]: v }));
  const err = (k: string) => (errors?.[k] ? <p style={{ ...hint, color: "var(--ad-bad)" }}>{errors[k]}</p> : null);

  const list = <T,>(items: T[], k: keyof Details, render: (item: T, i: number, upd: (v: T) => void) => React.ReactNode, blank: T, max: number) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <div style={{ flex: 1, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {render(it, i, (v) => set(k, items.map((x, j) => (j === i ? v : x)) as never))}
          </div>
          <button type="button" className="ad-btn" aria-label="Remove" onClick={() => set(k, items.filter((_, j) => j !== i) as never)}>×</button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="ad-btn" style={{ alignSelf: "flex-start" }} onClick={() => set(k, [...items, blank] as never)}>+ Add</button>
      )}
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(d); }}>
      <div style={field}>
        <label style={lbl} htmlFor="d-desc">What you do, in your own words</label>
        <textarea id="d-desc" className="ad-input" style={{ minHeight: 110, resize: "vertical" }} maxLength={1200} value={d.description} onChange={(e) => set("description", e.target.value)} placeholder="Two or three plain sentences: who you help, what with, and where. This is the paragraph an assistant will quote." />
        <p style={hint}>{d.description.length}/1200 · at least 40 characters</p>
        {err("description")}
      </div>

      {h("Services or products (optional)")}
      <p style={hint}>What you offer, one per line — treatments, trades, plans, titles. Prices are optional and can be &quot;from £30&quot;.</p>
      <div style={{ marginTop: 8 }}>
        {list<Service>(d.services, "services", (s, _i, upd) => (
          <>
            <input className="ad-input" style={{ flex: "2 1 160px" }} placeholder="Service" maxLength={80} value={s.name} onChange={(e) => upd({ ...s, name: e.target.value })} />
            <input className="ad-input" style={{ flex: "3 1 200px" }} placeholder="One line about it (optional)" maxLength={300} value={s.description ?? ""} onChange={(e) => upd({ ...s, description: e.target.value })} />
            <input className="ad-input" style={{ flex: "1 1 90px" }} placeholder="Price" maxLength={40} value={s.price ?? ""} onChange={(e) => upd({ ...s, price: e.target.value })} />
          </>
        ), { name: "", description: "", price: "" }, 30)}
      </div>
      {err("services")}

      {h("Opening hours")}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {d.hours.map((row, i) => (
          <div key={row.day} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ width: 90, fontSize: 13 }}>{DAYS[i].label}</span>
            <label style={{ fontSize: 12.5, display: "flex", gap: 5, alignItems: "center" }}>
              <input type="checkbox" checked={row.closed} onChange={(e) => set("hours", d.hours.map((x) => (x.day === row.day ? { ...x, closed: e.target.checked } : x)))} /> Closed
            </label>
            {!row.closed && (
              <>
                <input className="ad-input" type="time" value={row.open} onChange={(e) => set("hours", d.hours.map((x) => (x.day === row.day ? { ...x, open: e.target.value } : x)))} />
                <span className="ad-muted">to</span>
                <input className="ad-input" type="time" value={row.close} onChange={(e) => set("hours", d.hours.map((x) => (x.day === row.day ? { ...x, close: e.target.value } : x)))} />
              </>
            )}
          </div>
        ))}
      </div>

      {h("Price list (optional)")}
      {list(d.prices, "prices", (p, _i, upd) => (
        <>
          <input className="ad-input" style={{ flex: "3 1 200px" }} placeholder="Item" maxLength={80} value={p.item} onChange={(e) => upd({ ...p, item: e.target.value })} />
          <input className="ad-input" style={{ flex: "1 1 90px" }} placeholder="£" maxLength={40} value={p.price} onChange={(e) => upd({ ...p, price: e.target.value })} />
        </>
      ), { item: "", price: "" }, 30)}

      {h("Questions customers ask you")}
      <p style={hint}>Three good ones beat ten vague ones. These become an FAQ assistants can quote directly.</p>
      <div style={{ marginTop: 8 }}>
        {list(d.faqs, "faqs", (f, _i, upd) => (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <input className="ad-input" placeholder="Question" maxLength={200} value={f.q} onChange={(e) => upd({ ...f, q: e.target.value })} />
            <textarea className="ad-input" style={{ minHeight: 56, resize: "vertical" }} placeholder="Answer" maxLength={800} value={f.a} onChange={(e) => upd({ ...f, a: e.target.value })} />
          </div>
        ), { q: "", a: "" }, 15)}
      </div>

      {h("Areas you serve (optional)")}
      <input className="ad-input" style={{ width: "100%" }} placeholder="Comma-separated: Croydon, Purley, Sutton" value={d.areas.join(", ")} onChange={(e) => set("areas", e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20))} />

      {h("Contact details on the profile")}
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div style={field}><label style={lbl}>Phone</label><input className="ad-input" maxLength={40} value={d.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div style={field}><label style={lbl}>Public email</label><input className="ad-input" type="email" maxLength={160} value={d.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div style={{ ...field, gridColumn: "1 / -1" }}><label style={lbl}>Address</label><input className="ad-input" maxLength={200} value={d.address} onChange={(e) => set("address", e.target.value)} /></div>
      </div>
      {err("email")}

      {h("Photos (optional)")}
      <p style={hint}>Links to photos already online — your website, Google profile or Instagram. Must start with https://. Up to six.</p>
      <div style={{ marginTop: 8 }}>
        {list(d.photos, "photos", (p, _i, upd) => (
          <>
            <input className="ad-input" style={{ flex: "3 1 220px" }} placeholder="https://…/photo.jpg" maxLength={300} value={p.url} onChange={(e) => upd({ ...p, url: e.target.value })} />
            <input className="ad-input" style={{ flex: "2 1 140px" }} placeholder="What it shows" maxLength={120} value={p.alt ?? ""} onChange={(e) => upd({ ...p, alt: e.target.value })} />
          </>
        ), { url: "", alt: "" }, 6)}
      </div>
      {err("photos")}

      {h("Social and listing links (optional)")}
      <div style={{ marginTop: 8 }}>
        {list(d.socials, "socials", (s, _i, upd) => (
          <input className="ad-input" style={{ flex: 1 }} placeholder="https://www.facebook.com/yourbusiness" maxLength={300} value={s} onChange={(e) => upd(e.target.value)} />
        ), "", 6)}
      </div>
      {err("socials")}

      <div style={{ marginTop: 24, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="ad-btn amber" disabled={saving}>{saving ? "Saving…" : submitLabel}</button>
        {errors?.form ? <span style={{ color: "var(--ad-bad)", fontSize: 13 }}>{errors.form}</span> : null}
      </div>
    </form>
  );
}
