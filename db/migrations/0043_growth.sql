-- Referrals, discount codes, the trial emails and the app's error log. New tables and
-- columns only; nothing existing changes.

-- Each business's referral code (made the first time its plan page opens) and who referred it.
alter table businesses add column if not exists referral_code text unique;
alter table businesses add column if not exists referred_by uuid references businesses(id) on delete set null;

-- One row per referred business: the referrer gets their credit once the referred one pays.
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references businesses(id) on delete cascade,
  referred_id uuid not null unique references businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  reward_cents int
);
create index if not exists referrals_referrer on referrals (referrer_id);

-- Discount codes made in /admin (each one is a Stripe coupon with a promotion code).
create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  stripe_coupon_id text not null,
  stripe_promotion_code_id text not null,
  percent_off numeric(5,2),
  amount_off_cents int,
  duration text not null check (duration in ('once', 'repeating', 'forever')),
  duration_months int,
  max_redemptions int,
  expires_at timestamptz,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Emails about the account itself (trial ending, first visit): each kind once per business.
create table if not exists lifecycle_emails (
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (business_id, kind)
);

-- Server errors, grouped (same message and page = one row), for /admin and the alert email.
create table if not exists app_errors (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  message text not null,
  path text,
  digest text,
  count int not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  emailed_at timestamptz
);
create index if not exists app_errors_last on app_errors (last_at desc);
