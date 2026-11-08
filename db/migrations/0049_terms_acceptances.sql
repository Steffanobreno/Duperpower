-- Each time someone accepts the Terms (at signup, or when choosing a plan): which version, when, from where.
create table if not exists terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  ip text,
  context text not null check (context in ('signup', 'checkout'))
);
create index if not exists terms_acceptances_business_idx on terms_acceptances (business_id, accepted_at desc);
alter table terms_acceptances enable row level security;
