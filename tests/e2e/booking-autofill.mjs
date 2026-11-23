// A real request is never dropped because the browser filled a hidden field. Run after slice.mjs
// (Maria Lopez, 650-555-0142, Biscuit), with DATABASE_URL.
// A client reported the "request was sent" page while nothing reached the owner, and the try later
// showed as abandoned: the page had a hidden "Website" field (a trap for bots) and, when it came back
// filled, the server answered "ok" without saving anything. Browsers' autofill can fill it.
// Here the hidden field is filled before sending: the request must be saved and the owner told, and
// the try must not stay in Abandoned.
// Usage: node tests/e2e/booking-autofill.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL);
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const [maria] = await db`select id from clients where first_name = 'Maria' and phone like '%6505550142'`;
// A clean day for Maria: no online visits left from other tests (3 requests a day is the limit).
const old = (await db`select id from appointments where client_id = ${maria.id} and source = 'online'`).map((r) => r.id);
await db`delete from messages where appointment_id = any(${old})`;
await db`delete from appointment_services where appointment_pet_id in (select id from appointment_pets where appointment_id = any(${old}))`;
await db`delete from appointment_pets where appointment_id = any(${old})`;
await db`delete from appointments where id = any(${old})`;
await db`delete from booking_drafts where right(phone, 10) = '6505550142'`;

const client = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const button = (name) => client.getByRole("button", { name, exact: true });
try {
  await client.goto(`${BASE}/book`);
  await client.getByLabel("Mobile phone").fill("650-555-0142");
  await button("Next").click();
  await client.getByText("Welcome back, Maria!").waitFor();
  await button("Continue").click();
  await button("Continue to service").click();
  await client.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().click();
  await button("Continue").click();
  await client.getByRole("radio", { name: "No", exact: true }).click();
  await button("Confirm info for Biscuit").click();
  await client.getByRole("heading", { name: "Select a time" }).waitFor();
  await client.locator("button[aria-label*='open time']:not([disabled])").last().click();
  await client.getByRole("group", { name: "Open times" }).locator("button").first().click();
  await client.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  if (await client.getByRole("button", { name: /Read and sign/ }).count()) {
    await client.getByRole("button", { name: /Read and sign/ }).click();
    await client.getByLabel("I have read and agree to the service agreement.").check();
    await client.getByLabel("Type your full name to sign").fill("Maria Lopez");
    const pad = client.getByLabel("Draw your signature here");
    await pad.scrollIntoViewIfNeeded();
    const box = await pad.boundingBox();
    await client.mouse.move(box.x + 30, box.y + 60);
    await client.mouse.down();
    await client.mouse.move(box.x + 160, box.y + 30, { steps: 8 });
    await client.mouse.up();
    await button("Sign agreement").click();
  }
  // What the browser's autofill can do: fill every field it recognizes, hidden or not.
  const filled = await client.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden])")) {
      const label = (el.closest("label")?.textContent ?? el.getAttribute("aria-label") ?? el.name ?? "").toLowerCase();
      if (/website|url|homepage/.test(label) || el.name === "website") {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        set.call(el, "https://maria.example.com");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        n++;
      }
    }
    return n;
  });
  step(`autofill filled ${filled} website field(s) on the page`);
  await button("Submit booking request").click();
  await client.getByRole("heading", { name: /You're booked|request was sent/ }).waitFor();

  const [appt] = await db`select a.id, a.status from appointments a where a.client_id = ${maria.id} and a.source = 'online'
                           order by a.created_at desc limit 1`;
  if (!appt) fail("the page said the request was sent, but nothing was saved");
  step(`the request is saved (${appt.status}) when the page says it was sent`);
  const [draft] = await db`select completed_at from booking_drafts where right(phone, 10) = '6505550142' order by created_at desc limit 1`;
  if (draft && !draft.completed_at) fail("the try should be marked finished, not left to show as abandoned");
  step("the try is marked finished, so it doesn't show up in Abandoned");
  console.log("booking-autofill: all good");
} finally {
  await browser.close();
  await db.end();
}
