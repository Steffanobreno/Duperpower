// The fake gateway's "Pay (test)" refuses when test mode is off: production without
// FAKE_PAYMENTS=1, or an unknown NODE_ENV, and no plan or credit changes. Calls the real
// payFakeCheckout against the database (any business on its free trial, e.g. the seed's).
// Usage: DATABASE_URL=... npx tsx --conditions=react-server tests/fake-pay-refusal.test.mjs
import assert from "node:assert/strict";

const { payFakeCheckout } = await import("../src/lib/fake-payments.ts");
const { sql } = await import("../src/lib/db.ts");

const [biz] = await sql`select id from businesses where plan_status = 'trial' order by created_at limit 1`;
assert.ok(biz, "needs a business on its free trial (run after the seed)");
const snapshot = async () => {
  const [b] = await sql`
    select plan_status, plan_interval, plan_amount_cents, plan_currency, plan_period_end, plan_cancel_at_period_end,
           stripe_customer_id, stripe_subscription_id, fake_plan_discount, cancelled_at
    from businesses where id = ${biz.id}`;
  const [r] = await sql`select count(*)::int as n, count(rewarded_at)::int as rewarded from referrals where referred_id = ${biz.id}`;
  return { b, r };
};

delete process.env.STRIPE_SECRET_KEY;
for (const [nodeEnv, flag] of [["production", undefined], ["production", "0"], [undefined, undefined], ["staging", undefined]]) {
  if (nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = nodeEnv;
  if (flag === undefined) delete process.env.FAKE_PAYMENTS; else process.env.FAKE_PAYMENTS = flag;
  const before = await snapshot();
  for (const interval of ["month", "year"]) assert.equal(await payFakeCheckout(biz.id, interval, ""), "refused");
  assert.deepEqual(await snapshot(), before);
  console.log(`✓ NODE_ENV=${nodeEnv ?? "(unset)"} FAKE_PAYMENTS=${flag ?? "(unset)"}: Pay (test) is refused and nothing changes`);
}

await sql.end();
console.log("fake-pay-refusal: all good");
