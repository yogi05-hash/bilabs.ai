import Link from "next/link";

export const metadata = { title: "Unsubscribed — BiLabs", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const done = ok === "1";
  return (
    <div style={{ paddingTop: 110 }}>
      <section className="sec">
        <div className="wrap" style={{ maxWidth: 620 }}>
          <h1 className="h2">{done ? "You're unsubscribed." : "That link didn't work."}</h1>
          <p className="body" style={{ marginTop: 14 }}>
            {done
              ? "We won't email you again. Any report you already asked for has been sent, and your free check results are still yours."
              : "The link may have expired or been altered. Email hello@bilabs.ai and we'll remove you by hand."}
          </p>
          <p style={{ marginTop: 26 }}>
            <Link href="/" className="btn-line">Back to BiLabs</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
