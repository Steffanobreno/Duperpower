// The service agreement keeps every version, end to end. Run after slice.mjs (Maria Lopez, Woofers
// Dog Spa) and after signup.mjs (it counts the businesses; this test signs up one more), with
// DATABASE_URL. Maria signs → the owner edits the text: a new kept version, her signature still
// counts and still shows the text she signed → an edit with "sign again" makes her sign again (and
// refuses a signature of the version she was reading) →
// removing her warns that her signatures go too → the no-show fee fills the text → a business that
// signs up in Portuguese starts with a Portuguese agreement. Signs once a year during the test;
// puts the text and that option back at the end.
// Usage: node tests/e2e/agreement-versions.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const newPage = async (locale = "en-US") => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale, extraHTTPHeaders: { "accept-language": locale } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

const owner = await newPage();
await owner.goto(`${BASE}/login`);
await owner.fill('input[name="email"]', "owner@example.com");
await owner.fill('input[name="password"]', "correct horse battery");
await owner.click('button[type="submit"]');
await owner.waitForURL(/\/today/);

const [maria] = await db`select c.id, c.sign_token, c.business_id from clients c where c.first_name = 'Maria' and c.last_name = 'Lopez'`;
const agreementRow = async () => (await db`select id, title, body, version, resign_from_version, sign_every_booking from agreements
                                           where business_id = ${maria.business_id} and active order by created_at desc limit 1`)[0];
const original = await agreementRow();
const [v1] = await db`select title, body from agreement_versions where agreement_id = ${original.id} and version = ${original.version}`;
if (!v1 || v1.body !== original.body) fail("the current text should be kept as a version");
await db`delete from agreement_signatures where client_id = ${maria.id}`;

// Maria signs the current version from her link.
const client = await newPage();
await client.goto(`${BASE}/s/${maria.sign_token}`);
await client.locator('input[name="agree"]').check();
await client.locator('input[name="signature"]').fill("Maria Lopez");
await client.locator('button[type="submit"]').click();
await client.getByText("Thank you! You signed the service agreement.").waitFor();
const [sig] = await db`select agreement_version from agreement_signatures where client_id = ${maria.id}`;
if (sig?.agreement_version !== original.version) fail(`the signature should point to version ${original.version}, got ${sig?.agreement_version}`);
step(`Maria signs version ${original.version}`);

const saveAgreement = async ({ body, resign = false, fee = null, every = false }) => {
  await owner.goto(`${BASE}/settings/agreement`);
  await owner.waitForLoadState("networkidle"); // typing before the page is live can mix the old text in
  const text = owner.locator('textarea[name="body"]');
  await text.fill(body);
  if ((await text.inputValue()) !== body) fail("the agreement text box should hold exactly the new text");
  if (fee !== null) await owner.getByLabel("No-show fee").fill(fee);
  await owner.getByLabel("Sign on every online booking (instead of once a year)").setChecked(every);
  if (resign) await owner.getByLabel("This is an important change: ask every client to sign again").check();
  await owner.getByRole("button", { name: "Save", exact: true }).click();
  await owner.getByText("Saved.").waitFor();
};

// An edit without "sign again": a new version, Maria's signature still counts, her text is the old one.
const MARKER = "Version two marker: towels are provided by us.";
await saveAgreement({ body: `${original.body}\n\n${MARKER}` });
let a = await agreementRow();
if (a.version !== original.version + 1) fail(`the edit should make version ${original.version + 1}, got ${a.version}`);
if (a.resign_from_version !== original.resign_from_version) fail("an edit without “sign again” must keep who has to sign again");
const [v2] = await db`select body from agreement_versions where agreement_id = ${a.id} and version = ${a.version}`;
if (!v2?.body.includes(MARKER)) fail("the new text should be kept as the new version");
const [still] = await db`select body from agreement_versions where agreement_id = ${a.id} and version = ${original.version}`;
if (still?.body !== original.body) fail("the old version must stay as it was");
await owner.goto(`${BASE}/clients/${maria.id}`);
await owner.getByText(/Agreement signed .* by "Maria Lopez"/).waitFor();
await owner.getByText(`See the text Maria signed (version ${original.version})`).click();
const signedText = await owner.getByTestId("signed-agreement").innerText();
if (signedText.includes("Version two marker")) fail("the signed text should be the version Maria signed, not the new one");
if (!signedText.includes(original.body.split("\n").find((l) => l.startsWith("## ")).slice(3))) fail("the signed text should show version 1's body");
await client.reload();
await client.getByText("Thank you! You signed the service agreement.").waitFor();
step(`an edit makes version ${a.version}; Maria's signature still counts and shows the text she signed`);

// An edit with "sign again": her signature no longer counts.
await saveAgreement({ body: `${original.body}\n\n${MARKER} Updated.`, resign: true });
a = await agreementRow();
if (a.version !== original.version + 2 || a.resign_from_version !== a.version) fail("“sign again” should ask from the new version on");
await owner.goto(`${BASE}/clients/${maria.id}`);
await owner.getByText("Agreement not signed yet (they'll be asked on their confirm link).").waitFor();
await client.goto(`${BASE}/s/${maria.sign_token}`);
await client.locator('input[name="signature"]').waitFor();
step("an edit with “sign again”: Maria has to sign again");

// The text changes while Maria reads it: her signature points to the version she read.
const read = a.version;
await saveAgreement({ body: `${original.body}\n\n${MARKER} Updated again.` });
await client.locator('input[name="agree"]').check();
await client.locator('input[name="signature"]').fill("Maria Lopez");
await client.locator('button[type="submit"]').click();
await client.getByText("Thank you! You signed the service agreement.").waitFor();
const [late] = await db`select agreement_version from agreement_signatures where client_id = ${maria.id} order by signed_at desc limit 1`;
if (late?.agreement_version !== read) fail(`the signature should point to version ${read} she read, got ${late?.agreement_version}`);
step(`the text changed while she read it: her signature points to version ${read}, the one she read`);

// "Sign again" while Maria reads: the version she read no longer counts, so her signature is
// refused, nothing is recorded and the link shows the current text.
await saveAgreement({ body: `${original.body}\n\n${MARKER} Stale.`, resign: true });
await client.goto(`${BASE}/s/${maria.sign_token}`);
await client.getByText(`${MARKER} Stale.`).waitFor();
await saveAgreement({ body: `${original.body}\n\n${MARKER} Fresh.`, resign: true });
const [{ before }] = await db`select count(*)::int as before from agreement_signatures where client_id = ${maria.id}`;
await client.locator('input[name="agree"]').check();
await client.locator('input[name="signature"]').fill("Maria Lopez");
await client.locator('button[type="submit"]').click();
await client.getByText("The agreement changed. Please read it again.").waitFor();
await client.getByText(`${MARKER} Fresh.`).waitFor();
const [{ after }] = await db`select count(*)::int as after from agreement_signatures where client_id = ${maria.id}`;
if (after !== before) fail("a signature of a version that no longer counts must not be recorded");
// A version that doesn't exist is refused too.
await client.goto(`${BASE}/s/${maria.sign_token}`);
if (await client.getByText("The agreement changed. Please read it again.").count()) fail("a fresh link should not say the agreement changed");
await client.evaluate(() => { document.querySelector('input[name="version"]').value = "999"; });
await client.locator('input[name="agree"]').check();
await client.locator('input[name="signature"]').fill("Maria Lopez");
await client.locator('button[type="submit"]').click();
await client.getByText("The agreement changed. Please read it again.").waitFor();
const [{ again }] = await db`select count(*)::int as again from agreement_signatures where client_id = ${maria.id}`;
if (again !== before) fail("a signature of a version that doesn't exist must not be recorded");
step("“sign again” while Maria read: her signature is refused and the link shows the current text");

// Removing Maria warns that her signed agreements go too (not removed here).
await owner.goto(`${BASE}/clients/${maria.id}`);
await owner.getByText("Remove client").click();
await owner.getByText("Their signed agreements will be deleted too.").waitFor();
step("the remove-client confirmation warns about the signed agreements");

// The no-show fee fills {no_show_fee} in the text the client reads.
const FEE_LINE = "A no-show is charged {no_show_fee}.";
// ("sign again" so the link shows the text instead of "Thank you").
await saveAgreement({ body: `${original.body}\n\n${FEE_LINE}`, fee: "", resign: true });
await client.goto(`${BASE}/s/${maria.sign_token}`);
await client.getByText("A no-show is charged a fee.").waitFor();
await saveAgreement({ body: `${original.body}\n\n${FEE_LINE}`, fee: "25.00", resign: true });
a = await agreementRow();
const [feeVersion] = await db`select no_show_fee_cents from agreement_versions where agreement_id = ${a.id} and version = ${a.version}`;
if (feeVersion?.no_show_fee_cents !== 2500) fail("a new fee should be kept with a new version");
await client.goto(`${BASE}/s/${maria.sign_token}`);
await client.getByText("A no-show is charged $25.00.").waitFor();
step("the no-show fee shows as “a fee” when empty and as $25.00 once set");

// A business that signs up in Portuguese starts with its agreement in Portuguese, valid for 12 months.
const bia = await newPage("pt-BR");
const email = `contrato${Date.now()}@example.com`;
await bia.goto(`${BASE}/signup`);
await bia.getByLabel("Nome do negócio").fill("Tosa da Lia");
await bia.getByLabel("Seu nome").fill("Lia");
await bia.getByLabel("E-mail").fill(email);
await bia.getByLabel("Senha").fill("banho banho 123");
await bia.getByRole("checkbox").check();
await bia.getByRole("button", { name: "Criar minha conta" }).click();
await bia.waitForURL(/\/welcome/);
const [pt] = await db`select a.title, a.body from agreements a join staff st on st.business_id = a.business_id
  join users u on u.id = st.user_id where u.email = ${email}`;
if (!pt?.title.startsWith("Contrato de serviço")) fail(`the title should be in Portuguese, got “${pt?.title}”`);
if (!pt.body.includes("Este contrato vale por 12 meses a partir da assinatura.")) fail("the 12-month validity should be in Portuguese");
if (!pt.body.includes("{no_show_fee}")) fail("the starter agreement should carry the no-show fee");
step("a business that signs up in Portuguese gets a Portuguese agreement with the fee and the 12 months");

// A signature from before Fino kept each version points to a version made from the text at that
// time (migration 0050, "backfilled"): the profile says the text may have changed since.
a = await agreementRow();
await db`update agreement_versions set backfilled = true where agreement_id = ${a.id} and version = ${a.version}`;
await db`insert into agreement_signatures (agreement_id, agreement_version, client_id, signed_name, signed_at)
         values (${a.id}, ${a.version}, ${maria.id}, 'Maria Lopez', now() - interval '10 days')`;
await owner.goto(`${BASE}/clients/${maria.id}`);
await owner.getByText(`See the agreement text (version ${a.version})`).click();
await owner.getByText("Signed before Fino kept each version; the text may have changed since.").waitFor();
if (await owner.getByText(/See the text Maria signed/).count()) fail("a backfilled version must not be shown as the text Maria signed");
await db`update agreement_versions set backfilled = false where agreement_id = ${a.id} and version = ${a.version}`;
await db`delete from agreement_signatures where client_id = ${maria.id}`;
step("a signature of a backfilled version: the profile says the text may have changed since");

// Put the text back as it was (a new version, nobody asked to sign again).
await saveAgreement({ body: original.body, fee: "", every: original.sign_every_booking });

await db.end();
await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
