-- Lead capture upgrade — additive migration.
--
-- Nothing dropped or rewritten. Every new column has a default, so existing
-- rows stay valid, and the backfill below only fills blanks.

-- Per-check capture and call-tracking.
alter table bilabs_evaluations add column if not exists site_title   text;
alter table bilabs_evaluations add column if not exists phone        text;
-- lead_status tracks the OUTREACH on this specific run (new / called /
-- interested / paid / not_interested). It is deliberately not the contact's
-- pipeline_status: marking a check "paid" is a note about a call, and only
-- the verified Stripe webhook marks a person paid.
alter table bilabs_evaluations add column if not exists lead_status  text not null default 'new';
alter table bilabs_evaluations add column if not exists lead_notes   text;
alter table bilabs_evaluations add column if not exists is_internal  boolean not null default false;
-- how they arrived at the check: null = organic, otherwise e.g. nurture-fixes
alter table bilabs_evaluations add column if not exists entry_source text;
-- what the business itself publishes: phones, emails, address, socials.
-- Copied from their own pages, never inferred.
alter table bilabs_evaluations add column if not exists enrichment   jsonb;
alter table bilabs_evaluations add column if not exists enriched_at  timestamptz;

create index if not exists bilabs_eval_clean_idx  on bilabs_evaluations (started_at desc)
  where is_test = false and is_internal = false;
create index if not exists bilabs_eval_status2_idx on bilabs_evaluations (lead_status);
