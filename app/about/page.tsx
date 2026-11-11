import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About BiLabs — founded by Ram Yogi Velagapudi",
  description:
    "BiLabs is an AI visibility and AI receptionist studio in Greenwich, South East London, founded by Ram Yogi Velagapudi. The same people who built YourBotChat, ReelMakerBot and Showbizy.",
  alternates: { canonical: "/about" },
};

/* The founder section states only what can be pointed at: products that are
 * live on the open web under their own domains. No years of experience, prior
 * employers, education or client counts appear here, because none of that was
 * supplied and inventing a CV for a real, named person is not acceptable.
 * Hand me those details and they belong in the paragraph marked below. */

const BUILT = [
  { name: "YourBotChat", url: "https://yourbotchat.com", what: "An AI receptionist you set up from your website address, with a public AI profile and an owner-side connector for Claude and ChatGPT." },
  { name: "ReelMakerBot", url: "https://reelmakerbot.com", what: "A WhatsApp-first video generator: send a photo, get a cinematic vertical reel back, in Telugu, Hindi or English." },
  { name: "Showbizy", url: "https://showbizy.ai", what: "A platform for creative projects and the people who staff them, with matching, booking and payments." },
];

export default function AboutPage() {
  return (
    <div style={{ paddingTop: 92 }}>
      <section className="sec">
        <div className="wrap" style={{ maxWidth: 780 }}>
          <h1 className="h2">About BiLabs</h1>

          <p className="body" style={{ fontSize: 17, marginTop: 14 }}>
            BiLabs makes small businesses readable to AI assistants, and answers the enquiries that follow. We are
            based in Greenwich, South East London, and work with businesses across London and the rest of the UK.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>Founder</h2>
          <p className="body" style={{ marginTop: 10 }}>
            BiLabs was founded by <strong>Ram Yogi Velagapudi</strong>, who builds and runs the products below.
            BiLabs grew out of them: the same problem kept turning up in every one — a business has perfectly good
            information about itself, and no machine can read it.
          </p>
          <p className="body" style={{ marginTop: 10 }}>
            Rather than describe experience in the abstract, here is work that is live and checkable right now.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>Products we have built and run</h2>
          <ul className="body" style={{ marginTop: 10, paddingLeft: 20 }}>
            {BUILT.map((b) => (
              <li key={b.name} style={{ marginBottom: 10 }}>
                <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {b.name}
                </a>{" "}
                — {b.what}
              </li>
            ))}
          </ul>
          <p className="body" style={{ marginTop: 10 }}>
            See <Link href="/work" style={{ color: "var(--ink)" }}>our work</Link> for more detail.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>How we work</h2>
          <ul className="body" style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>We start with a free check, so you can see the problem before you pay for a fix.</li>
            <li>We publish facts you have given us. We do not write marketing copy and call it data.</li>
            <li>We say what we cannot do. No one can guarantee that an AI assistant will recommend you.</li>
            <li>Monthly, no setup fee, cancel anytime. If it is not earning its keep, stop.</li>
          </ul>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>Services and prices</h2>
          <ul className="body" style={{ marginTop: 10, paddingLeft: 20 }}>
            <li><strong>Free AI Check</strong> — £0.</li>
            <li><strong>Get Found by AI</strong> — £49 per month.</li>
            <li><strong>AI Front Desk</strong> — on hold while we focus on AI visibility.</li>
          </ul>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>Contact</h2>
          <p className="body" style={{ marginTop: 10 }}>
            BiLabs, Greenwich, London, United Kingdom.<br />
            Email <a href={`mailto:${SITE.email}`} style={{ color: "var(--ink)" }}>{SITE.email}</a>, or{" "}
            <Link href="/contact" style={{ color: "var(--ink)" }}>talk to us</Link>.
          </p>

          <p style={{ marginTop: 34, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/#check" className="btn-amber">Run the free AI check</Link>
            <Link href="/contact" className="btn-line">Talk to us</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
