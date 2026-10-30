-- Team: logins for groomers, roles with permissions, payroll rates and clocking in and out.
alter table staff drop constraint if exists staff_role_check;
alter table staff add constraint staff_role_check check (role in ('owner', 'admin', 'groomer'));

-- What each role may do (the owner may do everything). A row means allowed.
create table if not exists role_permissions (
  business_id uuid not null references businesses(id) on delete cascade,
  role text not null check (role in ('admin', 'groomer')),
  perm text not null,
  primary key (business_id, role, perm)
);
alter table role_permissions enable row level security;
alter table businesses add column if not exists roles_seeded boolean not null default false;

-- Payroll: commission on services, share of tips, hourly pay.
alter table staff add column if not exists commission_pct numeric(5,2) not null default 0 check (commission_pct between 0 and 100);
alter table staff add column if not exists tips_pct numeric(5,2) not null default 100 check (tips_pct between 0 and 100);
alter table staff add column if not exists hourly_cents int not null default 0 check (hourly_cents >= 0);

alter table businesses add column if not exists clock_enabled boolean not null default false;
create table if not exists clock_entries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  in_at timestamptz not null,
  out_at timestamptz,
  constraint clock_order check (out_at is null or out_at > in_at)
);
create index if not exists clock_entries_staff on clock_entries (staff_id, in_at desc);
-- One open entry per person.
create unique index if not exists clock_entries_open on clock_entries (staff_id) where out_at is null;
alter table clock_entries enable row level security;
