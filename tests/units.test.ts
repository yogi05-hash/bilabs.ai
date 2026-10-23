import { test } from "node:test";
import assert from "node:assert/strict";

import { resolvePeriod, londonMidnight, dayKeys, delta, londonDayKey } from "../lib/period.ts";
import { monthlyPence, mrrFrom } from "../lib/billing.ts";
import { channelOf, isBotUA, deviceFrom, hashIp } from "../lib/analytics.ts";

/* Calculations the dashboard's honesty depends on.
 *
 * These are the places where a quietly wrong answer would still look
 * plausible on screen: a day boundary an hour out, an annual plan counted at
 * twelve times its monthly worth, two currencies silently added. */

/* ------------------------------------------------- Europe/London days */

test("a London day boundary is 23:00Z in summer and 00:00Z in winter", () => {
  // BST: London midnight is the previous day at 23:00 UTC
  assert.equal(londonMidnight(2026, 7, 15).toISOString(), "2026-07-14T23:00:00.000Z");
  // GMT: London midnight is UTC midnight
  assert.equal(londonMidnight(2026, 1, 15).toISOString(), "2026-01-15T00:00:00.000Z");
});

test("the clock-change days are still exactly one day long in calendar terms", () => {
  // 29 Mar 2026: clocks go forward, the day is 23 hours
  const spring = dayKeys(londonMidnight(2026, 3, 29), londonMidnight(2026, 3, 30));
  assert.deepEqual(spring, ["2026-03-29"]);
  // 25 Oct 2026: clocks go back, the day is 25 hours
  const autumn = dayKeys(londonMidnight(2026, 10, 25), londonMidnight(2026, 10, 26));
  assert.deepEqual(autumn, ["2026-10-25"]);
});

test("a range spanning the clock change counts calendar days, not 24-hour blocks", () => {
  const p = resolvePeriod("custom", "2026-10-24", "2026-10-26", new Date("2026-10-27T12:00:00Z"));
  assert.equal(p.days, 3);
  assert.deepEqual(dayKeys(p.from, p.to), ["2026-10-24", "2026-10-25", "2026-10-26"]);
  // 73 real hours, because one of those days is 25 hours long
  assert.equal((p.to.getTime() - p.from.getTime()) / 3_600_000, 73);
});

test("the comparison window is the same number of calendar days, immediately before", () => {
  const p = resolvePeriod("7d", null, null, new Date("2026-10-22T13:00:00Z"));
  assert.equal(p.days, 7);
  assert.equal(p.prev.to.getTime(), p.from.getTime(), "previous period must end where this one begins");
  assert.equal(dayKeys(p.prev.from, p.prev.to).length, 7);
});

test("'today' ends at tomorrow's London midnight, so late-evening activity counts today", () => {
  const p = resolvePeriod("today", null, null, new Date("2026-10-22T13:00:00Z"));
  // 22:30 London on 22 Oct is 21:30Z — inside the window
  const lateEvening = new Date("2026-10-22T21:30:00Z");
  assert.ok(lateEvening >= p.from && lateEvening < p.to);
  assert.equal(londonDayKey(lateEvening), "2026-10-22");
});

test("a malformed range falls back to 7 days rather than blanking the page", () => {
  assert.equal(resolvePeriod("nonsense", null, null).label, "Last 7 days");
  assert.equal(resolvePeriod("custom", "not-a-date", "2026-01-01").label, "Last 7 days");
  // backwards range is rejected too
  assert.equal(resolvePeriod("custom", "2026-05-10", "2026-05-01").label, "Last 7 days");
});

test("delta reports nothing rather than infinity when the previous period was empty", () => {
  assert.equal(delta(5, 0), null);
  assert.equal(delta(10, 5), 100);
  assert.equal(delta(5, 10), -50);
});

/* ----------------------------------------------------------- MRR */

test("annual plans are normalised to a twelfth, not counted whole", () => {
  assert.equal(monthlyPence(120_00, "year"), 10_00);
  assert.equal(monthlyPence(49_00, "month"), 49_00);
  // weekly normalises on a 30.4375-day month
  assert.equal(monthlyPence(10_00, "week"), 4348);
  // a one-off price has no interval and contributes nothing
  assert.equal(monthlyPence(99_00, null), 0);
});

const sub = (status: string, amount: number, interval: string, currency = "gbp", qty = 1) => ({
  id: `sub_${status}_${amount}_${currency}`,
  status,
  customer: "cus_1",
  livemode: true,
  created: 0,
  items: { data: [{ quantity: qty, price: { id: "p", product: "prod_x", unit_amount: amount, currency, recurring: { interval } } }] },
});

test("MRR counts active and trialing only, and honours quantity", () => {
  const m = mrrFrom([
    sub("active", 49_00, "month"),
    sub("trialing", 99_00, "month"),
    sub("past_due", 49_00, "month"),   // money that has not arrived is not revenue
    sub("canceled", 49_00, "month"),
    sub("incomplete", 49_00, "month"),
  ] as never);
  assert.equal(m.byCurrency.gbp, 148_00);
  assert.equal(m.activeCount, 1);
  assert.equal(m.trialingCount, 1);
  assert.equal(m.gbpOnly, 148_00);
});

test("different currencies are reported apart and never added together", () => {
  const m = mrrFrom([sub("active", 49_00, "month", "gbp"), sub("active", 60_00, "month", "usd")] as never);
  assert.equal(m.byCurrency.gbp, 49_00);
  assert.equal(m.byCurrency.usd, 60_00);
  // no single headline is offered, because there is no FX rate here
  assert.equal(m.gbpOnly, null);
  assert.deepEqual(m.currencies.sort(), ["gbp", "usd"]);
});

test("an annual subscriber shows a twelfth of their payment as MRR", () => {
  const m = mrrFrom([sub("active", 588_00, "year")] as never);
  assert.equal(m.byCurrency.gbp, 49_00);
});

test("no subscriptions is a real zero, not a missing value", () => {
  const m = mrrFrom([]);
  assert.equal(m.gbpOnly, 0);
  assert.equal(m.activeCount, 0);
});

/* ------------------------------------------------------- attribution */

test("channel prefers UTM tags, then falls back to the referrer", () => {
  assert.equal(channelOf("linkedin", "social", null), "linkedin / social");
  assert.equal(channelOf(null, null, "www.google.com"), "google / organic");
  assert.equal(channelOf(null, null, "linkedin.com"), "linkedin / referral");
  assert.equal(channelOf(null, null, "t.co"), "x / referral");
});

test("no referrer and no tags is reported as direct, not guessed at", () => {
  assert.equal(channelOf(null, null, null), "direct / none");
});

test("a UTM source with no medium says unknown rather than inventing one", () => {
  assert.equal(channelOf("newsletter", null, "example.com"), "newsletter / unknown");
});

/* --------------------------------------------------- bots and devices */

test("declared crawlers are recognised, and a real browser is not", () => {
  assert.ok(isBotUA("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"));
  assert.ok(isBotUA("GPTBot/1.0"));
  assert.ok(isBotUA("curl/8.4.0"));
  assert.ok(isBotUA(""), "a missing user-agent is treated as a bot");
  assert.equal(
    isBotUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"),
    false,
  );
});

test("device class separates phone, tablet and desktop", () => {
  assert.equal(deviceFrom("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "mobile");
  assert.equal(deviceFrom("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
  assert.equal(deviceFrom("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "desktop");
});

test("an IP is stored only as a stable salted hash, never recoverable", () => {
  const h = hashIp("81.2.69.142");
  assert.equal(h, hashIp("81.2.69.142"), "same address must hash the same, or exclusions break");
  assert.notEqual(h, hashIp("81.2.69.143"));
  assert.equal(h.length, 32);
  assert.ok(!h.includes("81.2"), "the address itself must not survive in the hash");
});

/* --------------------------------------------------------- enrichment */

import { extractContact } from "../lib/enrich.ts";

const PAGE = `<html><head>
  <title>Smile Dental — Croydon's friendly dentist</title>
  <meta property="og:site_name" content="Smile Dental">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Dentist","name":"Smile Dental","address":{"@type":"PostalAddress","streetAddress":"12 High St","addressLocality":"Croydon","postalCode":"CR0 1AB"}}</script>
  <script>var junk = "not-an-email@2x.png"; call("020 0000 0000");</script>
</head><body>
  <a href="tel:+442081234567">Call us: 020 8123 4567</a>
  <a href="mailto:hello@smiledental.co.uk">Email us</a>
  <p>Or ring 07700 900123 after hours. Prices from 2024-2026: £45.</p>
  <img src="logo@2x.png"> <img src="team@photo.jpg">
  <a href="https://www.facebook.com/smiledentalcroydon">Facebook</a>
  <a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
  <a href="https://instagram.com/smiledental">Instagram</a>
</body></html>`;

test("enrichment copies published details and nothing else", () => {
  const c = extractContact(PAGE);
  assert.equal(c.title, "Smile Dental", "og:site_name beats the sloganed <title>");
  assert.ok(c.phones.includes("+442081234567"), "the tel: link is the primary phone");
  assert.ok(c.emails.includes("hello@smiledental.co.uk"));
  assert.ok(!c.emails.some((e) => e.endsWith(".png") || e.endsWith(".jpg")), "image filenames are not emails");
  assert.match(c.address ?? "", /12 High St, Croydon/, "schema.org PostalAddress is read");
  assert.ok(c.socials.some((s) => s.includes("facebook.com/smiledentalcroydon")));
  assert.ok(!c.socials.some((s) => s.includes("/sharer")), "share widgets are not the business's page");
  assert.ok(c.socials.some((s) => s.includes("instagram.com/smiledental")));
});

test("a page that publishes nothing yields nothing — never a guess", () => {
  const c = extractContact("<html><head><title>Hello</title></head><body><p>Welcome to our site. Established 2019. £1,234,567 turnover.</p></body></html>");
  assert.deepEqual(c.phones, [], "prices and years must not become phone numbers");
  assert.deepEqual(c.emails, []);
  assert.equal(c.address, null);
  assert.deepEqual(c.socials, []);
  assert.equal(c.title, "Hello");
});

test("script contents are not treated as visible contact details", () => {
  const c = extractContact('<html><body><script>fallback("020 7946 0000")</script><p>No contact here.</p></body></html>');
  assert.deepEqual(c.phones, [], "a number inside a script tag is code, not a published phone");
});

test("empty input is an empty result, not an error", () => {
  const c = extractContact("");
  assert.deepEqual(c.phones, []);
  assert.equal(c.title, null);
});
