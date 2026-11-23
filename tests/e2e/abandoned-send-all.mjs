// "Send to all" on Abandoned bookings, end to end. Run after slice.mjs, with DATABASE_URL and the
// dev server sending email to a local catcher whose folder is MAIL_DIR.
// Three people stopped booking (two left an email), one more stopped but booked since → the
// screen counts three → "Sorry, it's fixed" → emails go out at once to the two, each with their
// own name, pet and link → the texts are a queue: each opens Messages with that person's text
// (name, pet, link with their phone) → everyone is marked contacted; the one who booked isn't sent.
// The message menu (Random picked when it opens): Random, "Finish booking", "Sorry, it's fixed" and the 20 ready messages; picking one
// fills the box; Random hides the box and each person gets one of the 20 (not all the same, no raw {…}).
// "Clear recovered (1)" hides the one who booked since, keeps the others, and the 30-day numbers stay.
// You can pick who gets it (everyone ticked to start). Other drafts already in the database are hidden first, so the counts are this test's own.
// Usage: MAIL_DIR=/path node tests/e2e/abandoned-send-all.mjs [baseUrl]
import { readdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const MAIL_DIR = process.env.MAIL_DIR;
if (!MAIL_DIR) throw new Error("Set MAIL_DIR");
const db = postgres(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/woofers", { max: 1 });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const mails = () => readdirSync(MAIL_DIR).sort().map((f) => readFileSync(`${MAIL_DIR}/${f}`, "latin1")
  .replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))));

const [biz] = await db`select id from businesses where booking_slug = 'woofers'`;
await db`update booking_drafts set dismissed_at = now() where business_id = ${biz.id} and dismissed_at is null`;
const stuck = [
  { phone: "+16505550301", first: "Ava", pets: "Reese", email: "ava.stuck@example.com" },
  { phone: "+16505550302", first: "Ben", pets: "Milo", email: "ben.stuck@example.com" },
  { phone: "+16505550303", first: "Cy", pets: "Luna", email: null },
];
for (const s of stuck) {
  await db`insert into booking_drafts (business_id, phone, first_name, email, pets, step, created_at, updated_at)
           values (${biz.id}, ${s.phone}, ${s.first}, ${s.email}, ${s.pets}, 'review', now() - interval '2 days', now() - interval '2 days')`;
}
// One more stopped, but booked since: not sent.
const [booked] = await db`select c.phone from appointments a join clients c on c.id = a.client_id where a.business_id = ${biz.id} order by a.created_at limit 1`;
await db`insert into booking_drafts (business_id, phone, first_name, pets, step, created_at, updated_at)
         values (${biz.id}, ${booked.phone}, 'Booked', 'Biscuit', 'review', now() - interval '20 days', now() - interval '20 days')`;

const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/abandoned`);
await page.getByRole("link", { name: /Send to all/ }).click();
await page.waitForURL(/\/abandoned\/send/);
await page.getByText("3 people started booking and didn't finish").waitFor();
step("the screen counts the three who didn't finish (not the one who booked since)");

// The menu: 3 starting points and the 20 ready messages; picking one fills the box.
const menu = page.getByLabel("Message to start from");
if ((await menu.inputValue()) !== "random") fail("Random should be picked when the page opens");
if (await page.locator('textarea[name="body"]').count()) fail("with Random picked, the message box should be hidden");
const options = await menu.locator("option").allInnerTexts();
if (options.length !== 23) fail(`the menu should have 23 options, has ${options.length}`);
await menu.selectOption({ index: 7 });
const picked = await page.locator('textarea[name="body"]').inputValue();
if (!options[7] || !picked.startsWith(options[7].replace(/^\d+\.\s*/, "").replace(/…$/, "").trim())) fail(`picking an option should fill the box: ${options[7]} / ${picked}`);
step("the menu has Random, Finish booking, Sorry and 20 ready messages; picking one fills the box");

const before = mails().length;
await menu.selectOption({ label: "Sorry, it's fixed" });
if (!(await page.locator('textarea[name="body"]').inputValue()).includes("It's fixed now")) fail("the apology text should be filled in");
await page.getByRole("button", { name: "Send to all 3" }).click();
await page.getByText("Emails sent: 2").waitFor();
let sent = [];
for (let i = 0; i < 40 && sent.length < 2; i++) {
  sent = mails().slice(before).filter((m) => /stuck@example\.com/.test(m));
  await page.waitForTimeout(250);
}
if (sent.length !== 2) fail(`two emails should go out, got ${sent.length}`);
const ava = sent.find((m) => m.includes("ava.stuck@example.com"));
if (!/Hi Ava!/.test(ava) || !/Reese's visit/.test(ava) || !/\/book\/woofers\?phone=6505550301/.test(ava)) fail("Ava's email should have her name, pet and link");
step("emails go out at once to the two who left one, each with their own name, pet and link");

// The texts: a queue, each a link that opens Messages with that person's own text. (The test
// keeps the page instead of leaving for Messages.)
await page.evaluate(() => document.addEventListener("click", (e) => {
  if (e.target.closest?.('a[href^="sms:"]')) e.preventDefault();
}, true));
const opened = [];
for (let i = 1; i <= 3; i++) {
  const link = page.getByRole("link", { name: new RegExp(`^Text .+ \\(${i} of 3\\)$`) });
  opened.push(await link.getAttribute("href"));
  await link.click();
}
const cy = decodeURIComponent(opened.find((u) => u.startsWith("sms:+16505550303")) ?? "");
if (!/Hi Cy!/.test(cy) || !/Luna's visit/.test(cy) || !/phone=6505550303/.test(cy)) fail(`Cy's text should have his name, pet and link: ${cy}`);
step("the texts are a queue: each tap opens Messages with that person's own text");

const rows = await db`select phone, contacted_at is not null as contacted from booking_drafts where business_id = ${biz.id} and step = 'review' and dismissed_at is null`;
if (!rows.filter((r) => stuck.some((s) => s.phone === r.phone)).every((r) => r.contacted)) fail("everyone sent to should be marked contacted");
if (rows.find((r) => r.phone === booked.phone)?.contacted) fail("the one who booked since shouldn't be contacted");
step("everyone sent to is marked contacted; the one who booked since is left alone");

// Random: each person gets one of the 20, not all the same, with every blank filled in.
await page.goto(`${BASE}/abandoned/send`);
await page.evaluate(() => document.addEventListener("click", (e) => {
  if (e.target.closest?.('a[href^="sms:"]')) e.preventDefault();
}, true));
await menu.selectOption({ index: 0 });
if (await page.locator('textarea[name="body"]').isVisible()) fail("Random should hide the message box");
await page.getByText("Each person gets one of the 20 messages, picked at random.").waitFor();
await db`delete from messages where business_id = ${biz.id} and dedupe_key like 'abandoned-all:%'`;
await page.getByRole("button", { name: "Send to all 3" }).click();
await page.getByText("Emails sent: 2").waitFor();
const randomTexts = [];
for (let i = 1; i <= 3; i++) {
  const link = page.getByRole("link", { name: new RegExp(`^Text .+ \\(${i} of 3\\)$`) });
  randomTexts.push(decodeURIComponent((await link.getAttribute("href")).split("body=")[1]));
  await link.click();
}
if (randomTexts.some((t) => /\{\w+\}/.test(t))) fail(`a blank was left unfilled: ${randomTexts.join(" | ")}`);
const [{ n: kinds }] = await db`select count(distinct body)::int as n from messages where business_id = ${biz.id} and dedupe_key like 'abandoned-all:%'`;
if (kinds !== 2) fail(`two emails with their own random text expected, got ${kinds} distinct`);
step("Random: each person gets one of the 20 messages, every blank filled in");

// Picking who gets it: everyone is ticked; unticking Cy sends to the other two only.
await page.goto(`${BASE}/abandoned/send`);
await page.evaluate(() => document.addEventListener("click", (e) => {
  if (e.target.closest?.('a[href^="sms:"]')) e.preventDefault();
}, true));
const who = page.getByRole("group", { name: "Who gets it" });
const boxes = who.getByRole("checkbox");
if ((await boxes.count()) !== 3) fail(`three people to pick from expected, got ${await boxes.count()}`);
for (const b of await boxes.all()) if (!(await b.isChecked())) fail("everyone should be ticked when the page opens");
await who.getByRole("checkbox", { name: /Cy/ }).uncheck();
await page.getByRole("button", { name: "Clear" }).click();
if (await page.getByRole("button", { name: /^Send to/ }).isEnabled()) fail("with nobody ticked, sending should be off");
await page.getByRole("button", { name: "Select all" }).click();
await who.getByRole("checkbox", { name: /Cy/ }).uncheck();
await db`delete from messages where business_id = ${biz.id} and dedupe_key like 'abandoned-all:%'`;
await page.getByRole("button", { name: "Send to 2" }).click();
await page.getByText("Emails sent: 2").waitFor();
const picks = [];
for (let i = 1; i <= 2; i++) {
  const link = page.getByRole("link", { name: new RegExp(`^Text .+ \\(${i} of 2\\)$`) });
  picks.push(await link.getAttribute("href"));
  await link.click();
}
if (picks.some((u) => u.startsWith("sms:+16505550303"))) fail("Cy was unticked and shouldn't be in the texts");
step("you pick who gets it: everyone ticked, Clear and Select all, and the unticked one is left out");

// Clear recovered: hides the one who booked since; the others stay; the numbers don't move.
await page.goto(`${BASE}/abandoned`);
const stats = async () => (await page.locator(".grid-cols-3").first().innerText()).replace(/\s+/g, " ");
const statsBefore = await stats();
await page.getByRole("button", { name: "Clear recovered (1)" }).click();
await page.getByRole("link", { name: /Booked/ }).waitFor({ state: "detached" });
for (const s of stuck) await page.getByRole("link", { name: new RegExp(s.first) }).first().waitFor();
if ((await stats()) !== statsBefore) fail(`the numbers changed: ${statsBefore} → ${await stats()}`);
if (await page.getByRole("button", { name: /Clear recovered/ }).count()) fail("with nobody recovered left, the button should be gone");
step("Clear recovered hides the one who booked since, keeps the others, and the numbers stay");

await db.end();
await browser.close();
console.log("abandoned-send-all: all good");
