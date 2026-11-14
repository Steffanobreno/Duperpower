-- The limit between clients is now drive minutes (a free estimate from ZIP distance).
-- max_cluster_miles is no longer used and stays in place.
alter table businesses
  add column if not exists max_drive_minutes int not null default 35 check (max_drive_minutes between 10 and 90);
