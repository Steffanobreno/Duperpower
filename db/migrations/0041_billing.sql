-- Subscriptions with Stripe: who the business is on Stripe, its subscription, and when the
-- paid period ends. Businesses that existed before billing (the app owner's own) are courtesy
-- accounts and are never asked to pay.
alter table businesses add column if not exists stripe_customer_id text;
alter table businesses add column if not exists stripe_subscription_id text;
alter table businesses add column if not exists plan_period_end timestamptz;
alter table businesses add column if not exists plan_cancel_at_period_end boolean not null default false;
create unique index if not exists businesses_stripe_customer on businesses (stripe_customer_id) where stripe_customer_id is not null;
update businesses set plan_status = 'free' where plan_status = 'trial' and created_at < now() - interval '1 hour';
