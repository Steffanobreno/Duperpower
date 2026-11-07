-- "Forgot your password?": one-time links sent by email. Only the token's hash is kept;
-- each link works once, for one hour.
create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user on password_resets (user_id, created_at desc);
