-- Driving times from Google (Routes API), kept a week so reopening Today makes no new request.
create table if not exists route_cache (
  key text primary key,          -- sha256 of the day's stops in order
  minutes int[] not null,        -- driving minutes between consecutive stops
  created_at timestamptz not null default now()
);
alter table route_cache enable row level security;
