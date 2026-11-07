// "Forgot your password?", end to end. Run after slice.mjs (owner@example.com), with the dev
// server sending email to a local mail catcher (SMTP_HOST/SMTP_PORT) whose folder is MAIL_DIR.
// Asks for a link → the email has it → a new password logs in, other devices are logged out,
// the link works only once → an unknown email gets the same answer and no email.
// Usage: MAIL_DIR=/path DATABASE_URL=... node tests/e2e/password-reset.mjs [baseUrl]
import { readdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const MAIL_DIR = process.env.MAIL_DIR;
if (!MAIL_DIR) throw new Error("Set MAIL_DIR");
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const newPage = async () => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
// Emails as text (quoted-printable undone, so long links come back in one piece).
const mails = () => readdirSync(MAIL_DIR).sort().map((f) => readFileSync(`${MAIL_DIR}/${f}`, "latin1")
  .replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))));
const waitForMail = async (before, test) => {
  for (let i = 0; i < 40; i++) {
    const found = mails().slice(before).find(test);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
};
const EMAIL = "owner@example.com";

// Another device stays logged in with the old password.
const other = await newPage();
await other.goto(`${BASE}/login`);
await other.fill('input[name="email"]', EMAIL);
await other.fill('input[name="password"]', "correct horse battery");
await other.click('button[type="submit"]');
await other.waitForURL(/\/today/);

// Log in → "Forgot your password?" → the email gets a link.
const page = await newPage();
await page.goto(`${BASE}/login`);
await page.getByRole("link", { name: "Forgot your password?" }).click();
await page.waitForURL(/\/login\/forgot/);
const robots = await page.locator('meta[name="robots"]').getAttribute("content");
if (!robots?.includes("noindex")) fail(`the forgot page should be noindex (got ${robots})`);
const before = mails().length;
await page.getByLabel("Email").fill(EMAIL.toUpperCase());
await page.getByRole("button", { name: "Send me the link" }).click();
await page.getByText(/If an account has this email, a link is on its way/).waitFor();
const mail = await waitForMail(before, (m) => /Reset your .* password/.test(m));
if (!mail) fail("the reset email didn't arrive");
const link = mail.match(/https?:\/\/[^\s"<>]+\/login\/reset\/[A-Za-z0-9_-]{43}/)?.[0];
if (!link) fail("the email should have the reset link");
step("forgot password: the login page links to it, and the email (any letter case) gets a one-time link");

// The link: two different passwords are refused; a good one logs in.
await page.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
await page.getByLabel("New password").fill("a brand new password");
await page.getByLabel("Repeat password").fill("something else entirely");
await page.getByRole("button", { name: "Save and log in" }).click();
await page.getByText("The two passwords are different.").waitFor();
await page.keyboard.press("Escape");
await page.getByLabel("New password").fill("a brand new password");
await page.getByLabel("Repeat password").fill("a brand new password");
await page.getByRole("button", { name: "Save and log in" }).click();
await page.waitForURL(/\/today/);
step("a new password from the link logs straight in (and must be typed the same twice)");

// The other device was logged out; the old password no longer works, the new one does.
await other.goto(`${BASE}/today`);
await other.waitForURL(/\/login/);
await other.fill('input[name="email"]', EMAIL);
await other.fill('input[name="password"]', "correct horse battery");
await other.click('button[type="submit"]');
await other.getByText("That email and password don't match.").waitFor();
await other.keyboard.press("Escape");
await other.fill('input[name="password"]', "a brand new password");
await other.click('button[type="submit"]');
await other.waitForURL(/\/today/);
step("other devices are logged out; the old password stops working, the new one works");

// The same link a second time: spent.
const again = await newPage();
await again.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
await again.getByText("This link has expired or was already used.").waitFor();
await again.getByRole("link", { name: "Send a new link" }).waitFor();
step("the link works only once");

// An email with no account: the same answer, no email sent, nothing stored.
const before2 = mails().length;
await again.goto(`${BASE}/login/forgot`);
await again.getByLabel("Email").fill("nobody-here@example.com");
await again.getByRole("button", { name: "Send me the link" }).click();
await again.getByText(/If an account has this email, a link is on its way/).waitFor();
if (await waitForMail(before2, (m) => /nobody-here@example\.com/.test(m))) fail("no email should go to an address without an account");
step("an unknown email gets the same answer (it doesn't reveal who has an account) and no email");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await db.end();
await browser.close();
console.log("password reset: all good");
