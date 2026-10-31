-- How each pet was groomed on each visit: blade or comb, length/style, a note and a photo of the
-- cut, so the next visit can repeat it ("same as last time").
create table if not exists pet_grooms (
  id uuid primary key default gen_random_uuid(),
  appointment_pet_id uuid not null unique references appointment_pets(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  blade text,
  style text,
  note text,
  photo bytea,
  photo_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pet_grooms_pet on pet_grooms (pet_id, created_at desc);
alter table pet_grooms enable row level security;
