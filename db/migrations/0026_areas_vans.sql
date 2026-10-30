-- Mobile grooming: service areas by ZIP code and weekday, each groomer's van and where their day starts and ends.
alter table service_areas add column if not exists color text not null default '#2563eb';
alter table service_areas enable row level security;
alter table staff add column if not exists van_name text;
alter table staff add column if not exists van_plate text;
alter table staff add column if not exists start_address text;
alter table staff add column if not exists end_address text;
