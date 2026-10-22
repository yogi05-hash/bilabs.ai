import { SITE } from "@/lib/site";

export const revalidate = 3600;

/* llms.txt — a plain-text brief for AI assistants reading this site. */
export async function GET() {
  const body = `# BiLabs

> ${SITE.description}

Based in ${SITE.address.locality}, ${SITE.address.region}, ${SITE.address.country}.
Serving: ${SITE.areaServed.join(", ")}.
Founder: ${SITE.founder.name}.
Contact: ${SITE.email}

## Services and prices

- Free AI Check — £0. Five real questions put to an AI assistant with live web
  search, plus a readiness scan of the business's own website. No card needed.
- Get Found by AI — £49/month. Structured business profile and schema built
  from real services, hours and prices, published where AI systems can read it,
  kept current, with a monthly AI visibility report.
- AI Front Desk — £99/month. Everything in Get Found by AI, plus a 24/7 AI
  receptionist on the website, a shareable link and a QR code, answering from
  the owner's own facts and emailing every enquiry immediately.

No setup fee. Monthly. Cancel anytime. Prices in GBP.

## Honest limits

BiLabs does not guarantee that any AI assistant will recommend a business.
Each platform decides what it indexes and quotes. BiLabs makes a business
readable: accurate, structured, current, and published where these systems
look. The AI receptionist answers only from facts the business supplied and
never confirms a booking itself.

## Pages

- [Home](${SITE.url}/): what BiLabs does, the free check, prices.
- [AI visibility for London businesses](${SITE.url}/ai-visibility-london): the publishing service, in detail.
- [AI receptionist for small businesses](${SITE.url}/ai-receptionist-small-business): the receptionist, in detail.
- [About](${SITE.url}/about): founder and products built.
- [Our work](${SITE.url}/work): YourBotChat, ReelMakerBot, Showbizy.
- [Contact](${SITE.url}/contact)
- [Privacy](${SITE.url}/privacy)
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
