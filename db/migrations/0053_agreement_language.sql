-- The language the agreement is written in (the owner's, when it was created), so the parts Fino
-- fills in, like "a fee" for an empty {no_show_fee}, read in it too. null: the owner's language.
alter table agreements add column if not exists language text;
