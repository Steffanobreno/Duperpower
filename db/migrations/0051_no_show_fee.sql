-- The no-show fee the agreement text names where it says {no_show_fee} (null: "a fee").
-- Kept with each version too, since it is part of the text a client signs.
alter table agreements add column if not exists no_show_fee_cents int check (no_show_fee_cents >= 0);
alter table agreement_versions add column if not exists no_show_fee_cents int check (no_show_fee_cents >= 0);
