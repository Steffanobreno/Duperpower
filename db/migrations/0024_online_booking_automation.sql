-- Online booking automation: which requests book themselves without the owner accepting.
-- 'none' = every request waits for the owner; 'returning' = clients already on file; 'all' = everyone.
alter table businesses add column if not exists auto_accept text not null default 'none'
  check (auto_accept in ('none', 'returning', 'all'));
-- Intake forms: what new clients send from the public form, until the owner adds them.
create table if not exists intake_submissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table intake_submissions enable row level security;
