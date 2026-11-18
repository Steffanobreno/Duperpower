-- Who clients can book online: the booking page shows the groomer before the times, and lets
-- the client choose when more than one takes online bookings. Admins (office) don't groom.
alter table staff add column if not exists online_booking boolean not null default true;
update staff set online_booking = false where role = 'admin';
