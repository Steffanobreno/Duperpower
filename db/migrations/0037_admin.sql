-- The app owner's dashboard: each business's plan and trial, when it was last used, and where
-- the signup came from.
alter table businesses add column if not exists plan_status text not null default 'trial'; -- trial | active | past_due | cancelled | free
alter table businesses add column if not exists plan_interval text;                        -- month | year
alter table businesses add column if not exists plan_amount_cents int;                     -- what they pay per interval
alter table businesses add column if not exists plan_currency text;
alter table businesses add column if not exists trial_ends_at timestamptz;
alter table businesses add column if not exists cancelled_at timestamptz;
alter table businesses add column if not exists last_active_at timestamptz;
alter table businesses add column if not exists signup_source text;
alter table businesses alter column trial_ends_at set default now() + interval '14 days';
update businesses set trial_ends_at = created_at + interval '14 days' where trial_ends_at is null;
create index if not exists businesses_created_at on businesses (created_at);
