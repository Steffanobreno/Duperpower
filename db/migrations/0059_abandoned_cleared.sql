-- "Clear recovered" on Abandoned bookings: hides a recovered draft from the list while the
-- 30-day numbers (recovered, recovered revenue) keep counting it. dismissed_at stays "not wanted at all".
alter table booking_drafts add column if not exists cleared_at timestamptz;
