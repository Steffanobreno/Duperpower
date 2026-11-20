// Booking on an iPhone with the finger (touch, not a mouse), end to end. Run after slice.mjs.
// A client reached the last page, tapped "Submit booking request" and nothing happened: the button
// was off until the service agreement was signed, but looked on. Now: the button always answers
// (unsigned → it opens the agreement and says why), the agreement opens on top of everything,
// "Sign agreement" stays on screen, a finger signature counts, and the booking goes through.
// Usage: node tests/e2e/booking-phone.mjs [baseUrl]
import { chromium, devices } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:3000";
const fail = (msg) => { throw new Error(msg); };
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const button = (name) => page.getByRole("button", { name, exact: true });
await page.goto(`${BASE}/book`);
await page.getByLabel("Mobile phone").fill("9255550177");
await button("Next").tap();
await page.getByLabel("First name").fill("Mike"); await page.getByLabel("Last name").fill("Test"); await page.getByLabel("Email").fill("m@example.com");
await button("Continue").tap();
await page.getByLabel("Street address").fill("1 Main St"); await page.getByLabel("City").fill("Palo Alto"); await page.getByLabel("ZIP code").fill("94301");
await button("Continue").tap();
await page.getByLabel("Breed").fill("malt"); await button("Maltese").tap();
await page.getByLabel("Pet's name").fill("Reese"); await page.getByRole("radio", { name: /^Small/ }).tap();
await button("Save Reese").tap(); await button("Continue to service").tap();
await page.getByRole("radiogroup", { name: "Category" }).getByRole("radio", { name: "Bath", exact: true }).tap();
await page.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().tap();
await button("Continue").tap();
await page.getByRole("radio", { name: "No", exact: true }).tap();
await button("Confirm info for Reese").tap();
await page.getByRole("heading", { name: "Select a time" }).waitFor();
await page.getByRole("group", { name: "Open times" }).locator("button").first().tap();
await page.getByRole("dialog").getByRole("button", { name: "Continue" }).tap();
const submit = button("Submit booking request");
await submit.waitFor();
if (await submit.isDisabled()) fail("the submit button should always answer");
await page.getByText("Required before you submit").waitFor();
await submit.tap();
await page.getByRole("dialog").waitFor();
await page.waitForTimeout(400);
// The top of the agreement (title and close) is on screen, not under the site's header.
const title = await page.getByRole("dialog").getByRole("heading").first().boundingBox();
const onTop = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('[role="dialog"]'), [title.x + 5, title.y + 5]);
if (!onTop) fail("the agreement's title is covered");
console.log("✓ tapping Submit before signing opens the agreement, on top of everything");
await page.getByText("To sign: tick the box, type your full name and draw your signature.").waitFor();
await page.getByLabel("I have read and agree to the service agreement.").tap();
await page.getByLabel("Type your full name to sign").fill("Mike Test");
const pad = page.getByLabel("Draw your signature here");
await pad.evaluate((el) => el.closest(".scroll-mb-40").scrollIntoView({ block: "end" }));
await page.waitForTimeout(300);
const box = await pad.boundingBox();
const cdp = await ctx.newCDPSession(page);
const tp = (x, y) => [{ x: box.x + x, y: box.y + y }];
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(30, 60) });
for (let i = 1; i <= 12; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(30 + i * 18, 60 + (i % 2 ? 25 : -25)) });
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
const sign = button("Sign agreement");
if (await sign.isDisabled()) fail("a finger signature should count");
const vh = await page.evaluate(() => innerHeight);
const sb = await sign.boundingBox();
if (sb.y < 0 || sb.y + sb.height > vh) fail(`"Sign agreement" is off screen (${Math.round(sb.y + sb.height)} of ${vh})`);
console.log("✓ a finger signature counts, and \"Sign agreement\" is on screen");
// A person's finger takes a moment to go from the signature to the button (the browser reads
// two touches within ~0.3 s as one gesture and drops the click).
await page.waitForTimeout(500);
await sign.tap();
await page.getByText("Signed by Mike Test").waitFor();
await submit.tap();
await page.getByText(/Waiting for confirmation|booked/i).first().waitFor();
console.log("✓ the booking goes through");
console.log("booking-phone: all good");
await b.close();
