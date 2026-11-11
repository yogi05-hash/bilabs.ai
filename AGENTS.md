<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project rules

- **No SDKs.** Supabase, Stripe, Resend and every AI provider are called with plain `fetch`. Keep it that way.
- **All database access goes through `sb()` in `lib/leads.ts`** (PostgREST with the service-role key). RLS is enabled with no policies on every table; nothing runs in the browser against the database.
- **Migrations are additive and numbered** in `supabase/` (`0005_…` is the latest). Never drop or rewrite a column; add one with a default.
- **Dashboards use the `.ad-*` classes** in `app/globals.css`, not Tailwind utilities (they do not apply in this project). The customer dashboard shares them with the admin on purpose.
- **Route handlers** declare `runtime = "nodejs"` and `dynamic = "force-dynamic"`; anything that starts background work with `after()` must also export `maxDuration = 60`. `params` and `cookies()` are Promises in this Next.js.
- **Events** are allow-listed in `lib/analytics.ts`; those in `SERVER_ONLY_EVENTS` may only be recorded by server code and `/api/track` refuses them.
- **The honesty line** (`HONESTY_LINE` in `lib/site.ts`) is product policy: we make a business discoverable to AI web search and measure whether assistants name it; nobody can put facts inside a model. Do not weaken it in copy, emails or the guide's facts.
- **A failed provider call is "unavailable", never "not mentioned"**, and a run in which nothing answered is a failed job, not a zero. The free check (`app/api/visibility`) and the paid check (`lib/checks.ts`) both follow this.
- **Tests:** `npm test` for pure logic; `npm run test:flows` against a server started with `PROVIDER_MOCK=1` on port 3701 and the real Supabase. Test contacts use reserved domains (`@example.com`, `@shared-test.com`) and the teardown sweeps every table by those.
