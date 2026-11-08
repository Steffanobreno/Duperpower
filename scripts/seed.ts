// Creates the Woofers Dog Spa business with its services, hours and SMS texts.
// Safe to run more than once: it does nothing if a business already exists.
// Usage: npm run db:seed
import postgres from "postgres";
import { dbConfig } from "../src/lib/db-config";
import { AGREEMENT_BODY, AGREEMENT_TITLE } from "./agreement";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = dbConfig(url);
const sql = postgres(db.url, { max: 1, prepare: db.prepare, onnotice: () => {} });

import { createBusiness } from "../src/lib/new-business";

async function main() {
  const [existing] = await sql`select id from businesses limit 1`;
  if (existing) {
    // Added after the first seed: make sure the service agreement exists.
    const added = await sql`
      with a as (
        insert into agreements (business_id, title, body)
        select ${existing.id}, ${AGREEMENT_TITLE}, ${AGREEMENT_BODY}
        where not exists (select 1 from agreements where business_id = ${existing.id})
        returning id, version, title, body)
      insert into agreement_versions (agreement_id, version, title, body) select id, version, title, body from a
      returning agreement_id`;
    console.log(added.length ? "added the service agreement" : "business already exists, nothing to seed");
    return sql.end();
  }

  await sql.begin(async (tx) => {
    await createBusiness(tx, {
      name: "Woofers Dog Spa", phone: "+16504800599", slug: "woofers", timezone: "America/Los_Angeles", zip: "94401",
      ownerName: "Steffano",
      extra: { reviewUrl: "https://g.page/r/CQs7lH-SjO5jEAE/review", websiteUrl: "https://woofersdogspa.com", cancellationHours: 48,
               mailingAddress: "1201 Monte Diablo Ave, San Mateo, CA 94401" },
      agreement: { title: AGREEMENT_TITLE, body: AGREEMENT_BODY },
    });
  });
  console.log("seeded Woofers Dog Spa");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
