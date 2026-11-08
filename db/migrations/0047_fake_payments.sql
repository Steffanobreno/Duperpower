-- Test mode (the fake payment gateway, before Stripe is set up; see src/lib/fake-payments.ts).
-- Discount codes made in test mode have no Stripe coupon or promotion code.
alter table discount_codes alter column stripe_coupon_id drop not null;
alter table discount_codes alter column stripe_promotion_code_id drop not null;
-- A test-mode subscription's discount for its next charges (what Stripe keeps on its own
-- subscription): {"code": "LAUNCH50" | null, "percentOff": 50 | null, "amountOffCents": 2900 | null,
-- "chargesLeft": 1 | null (null = forever)}. Null when it has none.
alter table businesses add column if not exists fake_plan_discount jsonb;
