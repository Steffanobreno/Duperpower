-- Tries per visitor (IP) and action, shared by every server instance: login, signup, password
-- reset, online booking and the client's own links. Old rows are swept as new ones come in.
create table if not exists rate_hits (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists rate_hits_key_at on rate_hits (key, at);
create index if not exists rate_hits_at on rate_hits (at);
