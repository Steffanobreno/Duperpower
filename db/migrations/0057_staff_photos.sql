-- A groomer's photo, shown to clients on the booking page (instead of their initials).
create table if not exists staff_photos (
  staff_id uuid primary key references staff(id) on delete cascade,
  content_type text not null,
  data bytea not null,
  updated_at timestamptz not null default now()
);
