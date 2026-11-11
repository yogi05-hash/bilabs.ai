-- Self-serve automation — additive migration.
--
-- Columns the platform needs to chase and recover on its own:
--   setup_nudge_step / setup_nudged_at  reminders to a paying customer who
--                                        has not finished the setup wizard
--   check_failures                       consecutive failed scheduled checks,
--                                        so a retry becomes a notice after two
--   trouble_notified_at                  when the customer was last told a
--                                        check could not complete
--   snippets_seen_at                     when our structured data was last
--                                        found on the customer's own website
-- Every column has a default; nothing is dropped or rewritten.

alter table bilabs_businesses add column if not exists setup_nudge_step    integer not null default 0;
alter table bilabs_businesses add column if not exists setup_nudged_at     timestamptz;
alter table bilabs_businesses add column if not exists check_failures      integer not null default 0;
alter table bilabs_businesses add column if not exists trouble_notified_at timestamptz;
alter table bilabs_businesses add column if not exists snippets_seen_at    timestamptz;

create index if not exists bilabs_biz_onboarding_idx on bilabs_businesses (created_at) where status = 'onboarding';
