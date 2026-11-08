-- "Get Found by AI" as a self-serve product — additive migration.
--
-- Three tables. A business is one paying contact's published profile and its
-- settings; a check is one monthly (or manual) run across the assistants the
-- customer chose; a result is one assistant's answer to one question inside
-- that run. Results stay in their own table because the admin needs per-model
-- history through PostgREST filters, and answer text is far too large to sit on
-- the business row that every dashboard call reads.
--
-- Status is one axis, on bilabs_businesses.status:
--   onboarding -> processing -> live | paused | cancelled
-- Billing truth stays in bilabs_subscriptions; bilabs_leads is untouched.
--
-- RLS is enabled with no policies, as on every other table: service role only.

create table if not exists bilabs_businesses (
  id                      uuid primary key default gen_random_uuid(),
  contact_id              uuid not null unique references bilabs_leads(id) on delete cascade,
  evaluation_id           uuid references bilabs_evaluations(id) on delete set null,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  plan                    text,                        -- get-found | front-desk
  slug                    text unique,
  name                    text,
  website                 text,
  business_type           text,
  area                    text,
  postcode                text,
  address                 text,
  description             text,
  services                jsonb not null default '[]'::jsonb,  -- [{name,description,price}]
  hours                   jsonb not null default '[]'::jsonb,  -- [{day,open,close,closed}]
  prices                  jsonb not null default '[]'::jsonb,  -- [{item,price}]
  faqs                    jsonb not null default '[]'::jsonb,  -- [{q,a}]
  areas                   jsonb not null default '[]'::jsonb,  -- string[]
  photos                  jsonb not null default '[]'::jsonb,  -- [{url,alt}]  (URLs only in v1)
  socials                 jsonb not null default '[]'::jsonb,  -- string[]
  phone                   text,
  email                   text,                        -- public contact email, not the login email
  target_models           text[] not null default '{anthropic,openai,gemini,xai}',
  status                  text not null default 'onboarding',
  onboarding_step         integer not null default 0,  -- 0 confirm, 1 models, 2 details, 3 done
  confirmed_at            timestamptz,
  details_completed_at    timestamptz,
  published_at            timestamptz,                 -- first publish only
  republished_at          timestamptz,
  indexnow_pinged_at      timestamptz,
  paused_at               timestamptz,
  cancelled_at            timestamptz,
  next_check_at           timestamptz,
  last_check_at           timestamptz,
  last_check_id           uuid,
  last_error              text,
  is_test                 boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists bilabs_biz_due_idx    on bilabs_businesses (next_check_at) where status in ('live','processing');
create index if not exists bilabs_biz_status_idx on bilabs_businesses (status, created_at desc);
create index if not exists bilabs_biz_slug_idx   on bilabs_businesses (slug);

create table if not exists bilabs_checks (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references bilabs_businesses(id) on delete cascade,
  trigger            text not null default 'scheduled',  -- first | scheduled | manual | admin
  status             text not null default 'queued',     -- queued | running | completed | failed | abandoned
  requested_by       text,                               -- 'cron' | customer email | admin email
  started_at         timestamptz,
  completed_at       timestamptz,
  runtime_ms         integer,
  providers          text[] not null default '{}',       -- attempted
  questions          jsonb,                              -- the questions used
  totals             jsonb,   -- {openai:{found,available,total,model,skipped}, ...}
  found_total        integer,
  answers_total      integer,                            -- usable answers across providers
  competitors        jsonb,
  est_cost_pence     numeric(10,4),
  failure_reason     text,
  report_emailed_at  timestamptz,
  is_test            boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists bilabs_checks_biz_idx   on bilabs_checks (business_id, created_at desc);
create index if not exists bilabs_checks_queue_idx on bilabs_checks (status, created_at) where status in ('queued','running');

create table if not exists bilabs_check_results (
  id              uuid primary key default gen_random_uuid(),
  check_id        uuid not null references bilabs_checks(id) on delete cascade,
  business_id     uuid not null references bilabs_businesses(id) on delete cascade,
  provider        text not null,     -- anthropic | openai | gemini | xai
  model           text,
  question_id     text not null,
  question        text,
  available       boolean not null default false,
  found           boolean not null default false,
  answer_text     text,
  competitors     jsonb,
  searches        integer,
  est_cost_pence  numeric(10,4),
  error           text,
  created_at      timestamptz not null default now(),
  unique (check_id, provider, question_id)
);
create index if not exists bilabs_results_biz_idx on bilabs_check_results (business_id, provider, created_at desc);

alter table bilabs_businesses    enable row level security;
alter table bilabs_checks        enable row level security;
alter table bilabs_check_results enable row level security;
