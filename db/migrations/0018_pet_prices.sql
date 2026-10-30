-- A pet's own price (and, if set, time) for a service, e.g. a doodle that always takes longer.
-- Used instead of the service's standard price when that pet is booked, online or in the app.
create table if not exists pet_service_prices (
  pet_id uuid not null references pets(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  price_cents int not null check (price_cents >= 0),
  duration_min int check (duration_min between 0 and 600),
  updated_at timestamptz not null default now(),
  primary key (pet_id, service_id)
);
alter table pet_service_prices enable row level security;
