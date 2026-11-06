-- The language each person sees the app in (null: the phone's language).
alter table staff add column if not exists language text;
