-- Every text of the service agreement is kept: each edit adds a version, none is ever changed
-- or removed, and each signature (agreement_id, agreement_version) points to the text signed.
-- resign_from_version: signatures of an older version no longer count ("ask everyone to sign again").
create table if not exists agreement_versions (
  agreement_id uuid not null references agreements(id) on delete cascade,
  version int not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  primary key (agreement_id, version)
);
alter table agreement_versions enable row level security;

-- The text each agreement has today is its current version.
insert into agreement_versions (agreement_id, version, title, body, created_at)
select id, version, title, body, updated_at from agreements
on conflict do nothing;

-- Until now a new version meant "sign again", so signatures of older versions already didn't count.
alter table agreements add column if not exists resign_from_version int not null default 1;
update agreements set resign_from_version = version;
