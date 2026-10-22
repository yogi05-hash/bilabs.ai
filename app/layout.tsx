import type { Metadata } from "next";
import Script from "next/script";
import { organisationJsonLd } from "@/lib/site";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const GA_ID = "G-F4CSM7VKR8";

const SITE = "https://bilabs.ai";
const TITLE = "BiLabs — get your business recommended by AI";
const DESC =
  "Customers now ask ChatGPT, Claude and Google AI who to call. We publish your business so they can read it — and answer every enquiry that follows, 24/7. Free AI visibility report.";

export const metadata: Metadata = {
  // metadataBase makes the relative OG path absolute. Without it the tag
  // ships as "/og.jpg", which WhatsApp and every other scraper ignores.
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "BiLabs",
    title: TITLE,
    description: DESC,
    locale: "en_GB",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "BiLabs — get your business recommended by AI", type: "image/jpeg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["/og.jpg"],
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `dark` was hard-coded here, which pinned shadcn's dark palette on
    // regardless of the theme tokens below it.
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <head>
        <link
          rel="stylesheet"
          href="https://db.onlinewebfonts.com/c/5ac3fe7c6abd2f62067f266d89671492?family=HelveticaNowDisplay-Medium"
        />
        <link
          rel="stylesheet"
          href="https://db.onlinewebfonts.com/c/1aa3377e489837a26d019bba501e779d?family=HelveticaNowDisplayW01-Rg"
        />
      </head>
      <body>
        {/* Sitewide Organization + ProfessionalService graph. Beforeinteractive
            so it is in the HTML a crawler receives, not injected later. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organisationJsonLd()) }}
        />
        <Navbar />
        <main>{children}</main>
        <Footer />

        {/* GA4. afterInteractive so it never blocks first paint — the hero
            video is already the heaviest thing on the page. */}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
      </body>
    </html>
  );
}
