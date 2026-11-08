// paymentsMode: which payment provider the app uses. Stripe when its key is set; otherwise a
// fake one (TEST mode, no real charges) on a development/test server or with FAKE_PAYMENTS=1;
// otherwise none (it fails closed: an unknown or missing NODE_ENV is "off").
// Usage: npx tsx tests/payments-mode.test.mjs
import assert from "node:assert/strict";
import { paymentsMode } from "../src/lib/payments-mode.ts";

assert.equal(paymentsMode({ STRIPE_SECRET_KEY: "sk_live_x" }, "production"), "stripe");
assert.equal(paymentsMode({ STRIPE_SECRET_KEY: "sk_test_x" }, "development"), "stripe");
assert.equal(paymentsMode({ STRIPE_SECRET_KEY: "sk_live_x", FAKE_PAYMENTS: "1" }, "production"), "stripe");
assert.equal(paymentsMode({ STRIPE_SECRET_KEY: "sk_live_x" }, undefined), "stripe");
console.log("✓ a Stripe key → stripe (whatever else is set)");

assert.equal(paymentsMode({}, "development"), "fake");
assert.equal(paymentsMode({}, "test"), "fake");
console.log("✓ development or test, no Stripe key → fake");

assert.equal(paymentsMode({}, "production"), "off");
assert.equal(paymentsMode({ FAKE_PAYMENTS: "0" }, "production"), "off");
assert.equal(paymentsMode({ FAKE_PAYMENTS: "true" }, "production"), "off");
assert.equal(paymentsMode({ STRIPE_SECRET_KEY: "" }, "production"), "off");
console.log("✓ production without the flag → off (nobody can activate a plan for free)");

assert.equal(paymentsMode({}, undefined), "off");
assert.equal(paymentsMode({}, ""), "off");
assert.equal(paymentsMode({}, "staging"), "off");
// NODE_ENV comes only from the second parameter (process.env.NODE_ENV), never from `env`.
assert.equal(paymentsMode({ NODE_ENV: "development" }, "production"), "off");
assert.equal(paymentsMode({ NODE_ENV: "development" }, undefined), "off");
console.log("✓ missing or unknown NODE_ENV without the flag → off (fails closed)");

assert.equal(paymentsMode({ FAKE_PAYMENTS: "1" }, "production"), "fake");
assert.equal(paymentsMode({ FAKE_PAYMENTS: "1" }, undefined), "fake");
console.log("✓ FAKE_PAYMENTS=1 → fake");

const e = process.env;
assert.equal(paymentsMode(), e.STRIPE_SECRET_KEY ? "stripe"
  : e.FAKE_PAYMENTS === "1" || e.NODE_ENV === "development" || e.NODE_ENV === "test" ? "fake" : "off");
console.log("✓ reads process.env by default");
console.log("payments-mode: all good");
