# bilabs.ai

Marketing site, free AI visibility check, the paid "Get Found by AI" product, and the admin dashboard. Next.js 16 (App Router), Supabase via PostgREST, Stripe, Resend — all called with plain `fetch`, no SDKs.

## Run

```bash
npm install
npm run dev                      # http://localhost:3000
npm test                         # unit tests (pure logic, no network)
PROVIDER_MOCK=1 npx next dev -p 3701   # in one terminal…
npm run test:flows               # …then the end-to-end flows against it and the real Supabase
```

`PROVIDER_MOCK=1` replaces every AI provider with a canned answer that names "Mock Dental Practice". It is ignored when `VERCEL_ENV=production`.

## How the product works

```
Free check (homepage) ──▶ Stripe checkout ──▶ /welcome ──▶ email with dashboard link
                                   │ webhook: checkout.session.completed
                                   ▼
              bilabs_businesses row, pre-filled from the free check (status: onboarding)
                                   ▼
   /dashboard: confirm business → choose assistants → services/hours/prices/FAQ → Publish
                                   ▼
   lib/pipeline.publishBusiness: slug → /b/<slug> (HTML + JSON-LD + llms.txt) → IndexNow
                                → first check (runs immediately via after()) → "you're live" email
                                   ▼
   lib/checks.runCheck: every chosen assistant × 5 questions, live web search
                      → bilabs_checks + bilabs_check_results → report email → dashboard
                                   ▼
   /api/cron/checks (daily): queues the monthly run for every live business and drains the queue
```

The honest line that every page, email and plan description carries (`HONESTY_LINE` in `lib/site.ts`): *we make a business discoverable to AI web search and measure whether assistants name it; we do not — and cannot — put anything inside a model.*

## Database

Supabase. Run the SQL files in `supabase/` in order in the SQL editor: `0002_analytics.sql` → `0003_capture.sql` → `0004_ai_visibility.sql`. Migrations are additive only. RLS is enabled with no policies on every table — all access is server-side with the service-role key through `sb()` in `lib/leads.ts`.

## Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | database |
| `NEXT_PUBLIC_SITE_URL` | absolute links in emails, profiles, IndexNow |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude (free check and paid checks) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | ChatGPT (paid checks; default `gpt-4.1-mini`) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini (paid checks; default `gemini-2.5-flash`) |
| `XAI_API_KEY`, `XAI_MODEL` | Grok (paid checks; default `grok-4-fast`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_GET_FOUND`, `STRIPE_PRICE_FRONT_DESK` | billing — full price from the first payment, no coupons |
| `RESEND_API_KEY`, `LEAD_FROM`, `NURTURE_FROM`, `CUSTOMER_FROM`, `LEAD_NOTIFY_TO` | email (`CUSTOMER_FROM` for dashboard links and reports; falls back to `NURTURE_FROM`) |
| `ADMIN_EMAILS`, `ADMIN_SESSION_SECRET` | admin magic-link sign-in |
| `CUSTOMER_SESSION_SECRET` | customer magic-link sign-in (falls back to `ADMIN_SESSION_SECRET`) |
| `CRON_SECRET` | bearer token for `/api/cron/*` — Vercel sends it automatically |
| `INDEXNOW_KEY` | IndexNow key; served at `/indexnow/<key>.txt` |
| `CHECK_INTERVAL_DAYS` | days between scheduled checks (default 30) |
| `CUSTOM_QUERIES` | per-domain question overrides, JSON |
| `PROVIDER_MOCK` | `1` to mock every assistant (dev/test only) |

A provider with no key is simply not asked: the dashboard shows it as "coming soon" and a check records it as skipped, never as "not found".

## Scheduled jobs (`vercel.json`)

- `/api/cron/nurture` daily 09:00 — the consented email sequence for free-check leads.
- `/api/cron/checks` daily 10:15 — queues each live business whose monthly date has come and works the queue in 60-second slices, chaining itself through `after()` until it is empty. Customer-triggered checks never wait for this.

## Where things are

- `lib/providers.ts` — one `ask()` for Claude / ChatGPT / Gemini / Grok with live web search, pure parsers, cost estimates.
- `lib/questions.ts`, `lib/match.ts` — the five questions and the mention/competitor matcher, shared by the free and paid checks.
- `lib/businesses.ts`, `lib/businessForm.ts`, `lib/pipeline.ts`, `lib/checks.ts` — the paid product's model, input sanitising, publishing, and check runner.
- `lib/profile.ts`, `lib/snippets.ts` — JSON-LD / llms.txt / FAQ / robots builders for the hosted profile and the customer's own site.
- `lib/customerAuth.ts`, `lib/adminAuth.ts`, `lib/signedToken.ts` — the two magic-link sign-ins on one token format.
- `app/dashboard`, `components/dashboard/*` — the customer dashboard. `app/admin`, `components/admin/*` — the admin (Businesses tab for the paid product).
- `app/b/[slug]` — the public profile page and its `llms.txt`.
