-- Worldwide: each business has a country (phone numbers, addresses, maps, distances, holidays)
-- and a currency. Existing businesses are in the US.
alter table businesses add column if not exists country text not null default 'US';
alter table businesses add column if not exists currency text not null default 'USD';

-- Postal codes outside the California table, placed on the map once (with Google) and kept.
create table if not exists postal_points (
  country text not null,
  code text not null,
  lat float8,
  lng float8,
  city text,
  looked_up_at timestamptz not null default now(),
  primary key (country, code)
);
