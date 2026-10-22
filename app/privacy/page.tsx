import Link from "next/link";

export const metadata = {
  title: "Privacy — BiLabs",
  description: "What BiLabs collects, why, and how to get it removed.",
};

/* A real privacy notice, not a placeholder. The site collects names, emails
 * and website addresses into a database and sends them on by email, which
 * under UK GDPR has to be written down somewhere a visitor can find it. */

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "What we collect",
    p: [
      "When you submit the contact form: your name, email address, company name and whatever you write in the message.",
      "When you run the free AI visibility check: the business name, website address, trade and area you type in, plus whether the assistant mentioned you.",
      "When you use the guide panel on this site: the business type, area and rough enquiry volume you tell it. The conversation itself is kept with that record so we can make sense of it later.",
    ],
  },
  {
    h: "Why we collect it",
    p: [
      "To reply to you, and to understand which businesses this is useful for. That is the whole purpose. We do not sell it, share it with advertisers, or use it to train any AI model.",
    ],
  },
  {
    h: "Who else sees it",
    p: [
      "Three processors, each doing one job: Supabase stores the record, Resend delivers the notification email to us, and Anthropic processes the text of your question to generate an answer. Stripe handles payment details if you buy the audit — we never see or store your card number.",
    ],
  },
  {
    h: "How long we keep it",
    p: [
      "Enquiries are kept while there is a live conversation and for up to 24 months afterwards. Visibility-check records are kept for 12 months. Ask and we will delete either sooner.",
    ],
  },
  {
    h: "Your rights",
    p: [
      "You can ask for a copy of what we hold, ask us to correct it, or ask us to delete it, and we will do so within 30 days. Email hello@bilabs.ai. If you are not satisfied with how we have handled it, you can complain to the Information Commissioner's Office at ico.org.uk.",
    ],
  },
  {
    h: "Analytics and cookies",
    p: [
      "We use Google Analytics 4 to count visits and see which pages are read. It sets cookies in your browser and sends Google your IP address, the pages you view and rough location. We use it only to understand how the site is used.",
      "We set no advertising cookies and run no ad retargeting — nothing here follows you around other websites to sell to you.",
      "If you would rather not be counted, Google publishes an opt-out add-on at tools.google.com/dlpage/gaoptout, and most browsers can block these cookies for you.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div style={{ paddingTop: 92 }}>
      <section className="sec">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <h1 className="h2">Privacy</h1>
          <p className="body" style={{ fontSize: 16, marginTop: 14 }}>
            Short version: we collect what you type into this site so we can answer you, we keep it in three
            well-known services, and you can have it deleted whenever you like.
          </p>

          {SECTIONS.map((s) => (
            <div key={s.h} style={{ marginTop: 34 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>{s.h}</h2>
              {s.p.map((t) => (
                <p key={t} className="body" style={{ marginTop: 10 }}>{t}</p>
              ))}
            </div>
          ))}

          <p className="body" style={{ marginTop: 40, fontSize: 13.5 }}>
            BiLabs · hello@bilabs.ai ·{" "}
            <Link href="/" style={{ color: "var(--ink)", textDecoration: "underline" }}>back to the site</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
