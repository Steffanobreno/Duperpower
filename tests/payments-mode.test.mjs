// paymentsMode: which payment provider the app uses. Stripe when its key is set; otherwise a
// fake one (TEST mode, no real charges) in development or with FAKE_PAYMENTS=1; otherwise none.
// Usage: npx tsx tests/payments-mode.test.mjs
import assert from "node:assert/strict";
import { paymentsMode } from "../src/lib/payments-mode.ts";

assert.equal(paymentsMode({ STRIPE_SECRET_KEY: "sk_live_x", NODE_ENV: "production" }), "stripe");
assert.equal(paymentsMode({ STRIPE_SECRET_KEY: "sk_test_x", NODE_ENV: "development" }), "stripe");
assert.equal(paymentsMode({ STRIPE_SECRET_KEY: "sk_live_x", NODE_ENV: "production", FAKE_PAYMENTS: "1" }), "stripe");
console.log("✓ a Stripe key → stripe (whatever else is set)");

assert.equal(paymentsMode({ NODE_ENV: "development" }), "fake");
assert.equal(paymentsMode({ NODE_ENV: "test" }), "fake");
assert.equal(paymentsMode({}), "fake");
console.log("✓ not production, no Stripe key → fake");

assert.equal(paymentsMode({ NODE_ENV: "production" }), "off");
assert.equal(paymentsMode({ NODE_ENV: "production", FAKE_PAYMENTS: "0" }), "off");
assert.equal(paymentsMode({ NODE_ENV: "production", FAKE_PAYMENTS: "true" }), "off");
assert.equal(paymentsMode({ NODE_ENV: "production", STRIPE_SECRET_KEY: "" }), "off");
console.log("✓ production without the flag → off (nobody can activate a plan for free)");

assert.equal(paymentsMode({ NODE_ENV: "production", FAKE_PAYMENTS: "1" }), "fake");
console.log("✓ production with FAKE_PAYMENTS=1 → fake");

assert.equal(paymentsMode(), process.env.STRIPE_SECRET_KEY ? "stripe" : process.env.NODE_ENV !== "production" || process.env.FAKE_PAYMENTS === "1" ? "fake" : "off");
console.log("✓ reads process.env by default");
console.log("payments-mode: all good");
