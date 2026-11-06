-- First-run setup (/welcome): when the owner finished or skipped it. Businesses from before it
-- count as done.
alter table businesses add column if not exists onboarded_at timestamptz;
update businesses set onboarded_at = created_at where onboarded_at is null;

-- What a service is for, whatever its name says in the owner's language ('demat': the matted-coat fee
-- the booking page asks about).
alter table services add column if not exists role text;
update services set role = 'demat' where kind = 'addon' and role is null and name ~* 'demat';
