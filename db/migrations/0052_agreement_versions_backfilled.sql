-- The versions 0050 created from the text each agreement had then: older signatures point to them,
-- but those clients may have signed an earlier text that wasn't kept. The client page says so.
alter table agreement_versions add column if not exists backfilled boolean not null default false;
update agreement_versions set backfilled = true
where created_at <= (select applied_at from schema_migrations where name = '0050_agreement_versions.sql');
