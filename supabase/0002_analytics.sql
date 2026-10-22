-- BiLabs admin analytics — additive migration.
--
-- Nothing here drops, renames or rewrites an existing column. bilabs_leads
-- keeps every row and every field it already had; the new columns are added
-- with defaults and backfilled from what is already there.
--
-- Every table is RLS-enabled with no policies, which is this project's
-- existing convention for "service role only" — the anon key can neither read
-- nor write any of it.
--
-- One deliberate split runs through the whole design: browser-reported events
-- are analytics signals and live in bilabs_events, while anything financial or
-- anything that decides a customer's state comes from a signature-verified
-- server event and lives in bilabs_payments / bilabs_subscriptions. The
-- dashboard never adds the two together.

-- ---------------------------------------------------------------- visitors

create table if not exists bilabs_visitors (
  id               uuid primary key default gen_random_uuid(),
  -- a random first-party id we set ourselves. Not a fingerprint: it carries
  -- no device characteristics and dies with the cookie.
  visitor_key      text not null unique,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  visit_count      integer not null default 1,
  page_views       integer not null default 0,
  landing_path     text,
  landing_referrer text,
  referrer_host    text,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_term         text,
  utm_content      text,
  device           text,          -- mobile | tablet | desktop
  country          text,          -- coarse, from the CDN edge header only
  last_path        text,
  -- set only when the person volunteers an address
  contact_id       uuid references bilabs_leads(id) on delete set null,
  identified_at    timestamptz,
  is_bot           boolean not null default false,
  is_internal      boolean not null default false,
  is_test          boolean not null default false
);

create index if not exists bilabs_visitors_last_seen_idx  on bilabs_visitors (last_seen_at desc);
create index if not exists bilabs_visitors_first_seen_idx on bilabs_visitors (first_seen_at desc);
create index if not exists bilabs_visitors_contact_idx    on bilabs_visitors (contact_id);
create index if not exists bilabs_visitors_real_idx       on bilabs_visitors (first_seen_at desc)
  where is_bot = false and is_internal = false and is_test = false;

-- ------------------------------------------------------------------ events

create table if not exists bilabs_events (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  occurred_at   timestamptz not null default now(),
  received_at   timestamptz not null default now(),
  visitor_id    uuid references bilabs_visitors(id) on delete cascade,
  contact_id    uuid references bilabs_leads(id) on delete set null,
  evaluation_id uuid,
  -- 'browser' events are signals; 'server' and 'stripe' are authoritative
  origin        text not null default 'browser',
  path          text,
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  props         jsonb not null default '{}'::jsonb,
  -- retries and double-fires collapse onto the same row instead of inflating
  -- every count on the dashboard
  dedupe_key    text unique,
  is_bot        boolean not null default false,
  is_internal   boolean not null default false,
  is_test       boolean not null default false
);

create index if not exists bilabs_events_name_time_idx on bilabs_events (name, occurred_at desc);
create index if not exists bilabs_events_time_idx      on bilabs_events (occurred_at desc);
create index if not exists bilabs_events_visitor_idx   on bilabs_events (visitor_id, occurred_at desc);
create index if not exists bilabs_events_contact_idx   on bilabs_events (contact_id, occurred_at desc);
create index if not exists bilabs_events_real_idx      on bilabs_events (name, occurred_at desc)
  where is_bot = false and is_internal = false and is_test = false;

-- ------------------------------------------------------------- evaluations

create table if not exists bilabs_evaluations (
  id              uuid primary key default gen_random_uuid(),
  visitor_id      uuid references bilabs_visitors(id) on delete set null,
  contact_id      uuid references bilabs_leads(id) on delete set null,
  website         text,
  business_name   text,
  business_type   text,
  area            text,
  postcode        text,
  -- queued -> running -> completed | failed, or abandoned by the sweeper
  status          text not null default 'queued',
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  runtime_ms      integer,
  -- the site scan: readability of their own website. Deliberately a separate
  -- pair of columns from the mention counts below -- they measure different
  -- things and must never be presented as one number.
  readiness_score integer,
  readiness_max   integer,
  site_reachable  boolean,
  checks          jsonb,
  -- what an assistant actually said, and how it was asked
  mentions        integer,
  mentions_total  integer,
  competitors     jsonb,
  queries         jsonb,
  model           text,
  web_searches    integer,
  est_cost_pence  numeric(10,4),
  report_emailed_at timestamptz,
  report_viewed_at  timestamptz,
  report_views    integer not null default 0,
  failure_reason  text,
  attempt         integer not null default 1,
  retry_of        uuid references bilabs_evaluations(id) on delete set null,
  requested_by    text,            -- 'visitor' | admin email, for retries
  is_test         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists bilabs_eval_started_idx on bilabs_evaluations (started_at desc);
create index if not exists bilabs_eval_status_idx  on bilabs_evaluations (status, started_at desc);
create index if not exists bilabs_eval_contact_idx on bilabs_evaluations (contact_id, started_at desc);
create index if not exists bilabs_eval_visitor_idx on bilabs_evaluations (visitor_id, started_at desc);
create index if not exists bilabs_eval_website_idx on bilabs_evaluations (lower(website));
create index if not exists bilabs_eval_real_idx    on bilabs_evaluations (started_at desc)
  where is_test = false;

-- ------------------------------------------------- stripe: the raw ledger
-- Every webhook delivery lands here first, keyed by Stripe's own event id.
-- Stripe retries, and can deliver out of order; this is what makes both safe.

create table if not exists bilabs_webhook_events (
  stripe_event_id text primary key,
  type            text not null,
  api_created_at  timestamptz,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz,
  -- received | processed | ignored_other_product | ignored_test | error
  status          text not null default 'received',
  reason          text,
  livemode        boolean,
  payload         jsonb
);

create index if not exists bilabs_webhook_received_idx on bilabs_webhook_events (received_at desc);
create index if not exists bilabs_webhook_status_idx   on bilabs_webhook_events (status, received_at desc);

-- ---------------------------------------------------------------- payments
-- Money that actually moved, as reported by a verified webhook. One row per
-- Stripe event id, so a redelivery cannot double-count revenue.

create table if not exists bilabs_payments (
  id                 uuid primary key default gen_random_uuid(),
  stripe_event_id    text unique,
  stripe_object_id   text,
  -- payment | refund | payment_failed
  kind               text not null,
  contact_id         uuid references bilabs_leads(id) on delete set null,
  email              text,
  stripe_customer_id text,
  stripe_subscription_id text,
  -- refunds are stored negative so a plain sum() is net receipts
  amount_pence       integer not null,
  currency           text not null default 'gbp',
  product_id         text,
  price_id           text,
  plan               text,
  recurring          boolean not null default false,
  livemode           boolean not null default true,
  occurred_at        timestamptz not null,
  created_at         timestamptz not null default now()
);

create index if not exists bilabs_payments_time_idx    on bilabs_payments (occurred_at desc);
create index if not exists bilabs_payments_contact_idx on bilabs_payments (contact_id, occurred_at desc);
create index if not exists bilabs_payments_kind_idx    on bilabs_payments (kind, occurred_at desc);
create index if not exists bilabs_payments_live_idx    on bilabs_payments (occurred_at desc) where livemode = true;

-- ----------------------------------------------------------- subscriptions
-- A mirror of Stripe state, not a source of truth. last_event_at guards
-- against an older webhook arriving after a newer one and winding state back.

create table if not exists bilabs_subscriptions (
  id                   text primary key,          -- Stripe subscription id
  stripe_customer_id   text,
  contact_id           uuid references bilabs_leads(id) on delete set null,
  email                text,
  status               text not null,
  product_id           text,
  price_id             text,
  plan                 text,
  unit_amount_pence    integer,
  currency             text not null default 'gbp',
  interval             text,                      -- month | year
  quantity             integer not null default 1,
  started_at           timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at          timestamptz,
  livemode             boolean not null default true,
  last_event_at        timestamptz,
  updated_at           timestamptz not null default now()
);

create index if not exists bilabs_subs_status_idx  on bilabs_subscriptions (status);
create index if not exists bilabs_subs_contact_idx on bilabs_subscriptions (contact_id);

-- --------------------------------------------------------------- follow-ups

create table if not exists bilabs_followups (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid references bilabs_leads(id) on delete cascade,
  title      text not null,
  -- task | report_delivery. Report delivery is a thing the person asked for
  -- and is never gated on marketing consent; marketing is.
  kind       text not null default 'task',
  owner      text,
  due_at     timestamptz,
  done_at    timestamptz,
  status     text not null default 'open',   -- open | done | cancelled
  notes      text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists bilabs_followups_due_idx     on bilabs_followups (status, due_at);
create index if not exists bilabs_followups_contact_idx on bilabs_followups (contact_id);

-- --------------------------------------------------------------- email log
-- So "did that actually send?" has an answer in the dashboard.

create table if not exists bilabs_email_log (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid references bilabs_leads(id) on delete set null,
  email      text,
  kind       text not null,        -- report | alert | nurture | welcome | admin_link
  subject    text,
  resend_id  text,
  status     text not null default 'sent',   -- sent | failed
  error      text,
  created_at timestamptz not null default now()
);

create index if not exists bilabs_email_log_time_idx   on bilabs_email_log (created_at desc);
create index if not exists bilabs_email_log_status_idx on bilabs_email_log (status, created_at desc);

-- ------------------------------------------------------- admins and audit

create table if not exists bilabs_admins (
  email         text primary key,
  role          text not null default 'admin',   -- owner | admin | readonly
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists bilabs_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor       text not null,
  role        text,
  action      text not null,
  target_type text,
  target_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists bilabs_audit_time_idx on bilabs_audit_log (created_at desc);

-- ---------------------------------------------------------------- settings

create table if not exists bilabs_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- --------------------------------------- additive columns on bilabs_leads

alter table bilabs_leads add column if not exists pipeline_status   text;
alter table bilabs_leads add column if not exists owner             text;
alter table bilabs_leads add column if not exists next_follow_up_at timestamptz;
alter table bilabs_leads add column if not exists first_source      text;
alter table bilabs_leads add column if not exists last_source       text;
alter table bilabs_leads add column if not exists first_utm         jsonb;
alter table bilabs_leads add column if not exists last_utm          jsonb;
alter table bilabs_leads add column if not exists first_seen_at     timestamptz;
alter table bilabs_leads add column if not exists visitor_id        uuid;
alter table bilabs_leads add column if not exists merged_into       uuid references bilabs_leads(id) on delete set null;
alter table bilabs_leads add column if not exists is_test           boolean not null default false;

-- Backfill, idempotent. The existing `status` column keeps driving the nurture
-- state machine untouched; pipeline_status is the separate sales pipeline the
-- dashboard shows, because "unsubscribed" is a marketing preference and not a
-- stage of a sales conversation.
update bilabs_leads set first_source = source where first_source is null;
update bilabs_leads set last_source  = source where last_source  is null;
update bilabs_leads set first_seen_at = created_at where first_seen_at is null;
update bilabs_leads set pipeline_status = case
    when status = 'paid'        then 'customer'
    when status = 'nurturing'   then 'contacted'
    when status = 'lost'        then 'closed'
    when status = 'unsubscribed' then 'new'
    else 'new'
  end
  where pipeline_status is null;

create index if not exists bilabs_leads_pipeline_idx  on bilabs_leads (pipeline_status);
create index if not exists bilabs_leads_created_idx   on bilabs_leads (created_at desc);
create index if not exists bilabs_leads_followup_idx  on bilabs_leads (next_follow_up_at) where next_follow_up_at is not null;
create index if not exists bilabs_leads_merged_idx    on bilabs_leads (merged_into) where merged_into is not null;

-- ------------------------------------------------------------------ RLS
-- Enabled with no policies: service role only, matching bilabs_leads.

alter table bilabs_visitors       enable row level security;
alter table bilabs_events         enable row level security;
alter table bilabs_evaluations    enable row level security;
alter table bilabs_webhook_events enable row level security;
alter table bilabs_payments       enable row level security;
alter table bilabs_subscriptions  enable row level security;
alter table bilabs_followups      enable row level security;
alter table bilabs_email_log      enable row level security;
alter table bilabs_admins         enable row level security;
alter table bilabs_audit_log      enable row level security;
alter table bilabs_settings       enable row level security;
