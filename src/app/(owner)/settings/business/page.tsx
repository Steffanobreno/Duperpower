import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { logoUrl } from "@/lib/business-logo";
import { sql } from "@/lib/db";
import { phoneLabel } from "@/lib/format";
import { TIMEZONES } from "@/lib/timezones";
import { Card, Field, Input, Page, PageHeader, Select } from "@/components/ui";
import { saveBusinessAction } from "../actions";
import { SimpleForm } from "../forms";
import { LogoUpload } from "./logo-upload";

export const metadata: Metadata = { title: "Business" };

type Business = {
  name: string; phone: string | null; booking_slug: string; timezone: string;
  address_line: string | null; city: string | null; state: string | null; zip: string | null;
  website_url: string | null; facebook_url: string | null; instagram_url: string | null; yelp_url: string | null; google_url: string | null;
};

export default async function BusinessPage() {
  const staff = await requireStaff();
  const [[b], logo] = await Promise.all([
    sql<Business[]>`select name, phone, booking_slug, timezone, address_line, city, state, zip,
                           website_url, facebook_url, instagram_url, yelp_url, google_url
                    from businesses where id = ${staff.businessId}`,
    logoUrl(staff.businessId),
  ]);
  return (
    <>
      <PageHeader title="Business" back="/settings" />
      <Page>
        <Card>
          <LogoUpload src={logo} />
        </Card>
        <Card>
          <SimpleForm action={saveBusinessAction}>
            <Field label="Business name">
              <Input name="name" defaultValue={b.name} required maxLength={80} />
            </Field>
            <Field label="Business phone" hint="Shown in texts and receipts.">
              <Input name="phone" type="tel" defaultValue={phoneLabel(b.phone)} />
            </Field>
            <h2 className="section-label pt-2">Address</h2>
            <p className="-mt-2 text-xs text-muted">Shown on receipts. A mobile business can leave it empty.</p>
            <Field label="Street">
              <Input name="address_line" defaultValue={b.address_line ?? ""} autoComplete="street-address" />
            </Field>
            <div className="grid grid-cols-[1fr_5rem_6rem] gap-2">
              <Field label="City"><Input name="city" defaultValue={b.city ?? ""} /></Field>
              <Field label="State"><Input name="state" defaultValue={b.state ?? "CA"} maxLength={20} /></Field>
              <Field label="ZIP"><Input name="zip" defaultValue={b.zip ?? ""} inputMode="numeric" maxLength={5} /></Field>
            </div>
            <h2 className="section-label pt-2">Links</h2>
            <Field label="Website"><Input name="website_url" type="url" defaultValue={b.website_url ?? ""} placeholder="https://" /></Field>
            <Field label="Facebook"><Input name="facebook_url" type="url" defaultValue={b.facebook_url ?? ""} placeholder="https://facebook.com/…" /></Field>
            <Field label="Instagram"><Input name="instagram_url" type="url" defaultValue={b.instagram_url ?? ""} placeholder="https://instagram.com/…" /></Field>
            <Field label="Yelp"><Input name="yelp_url" type="url" defaultValue={b.yelp_url ?? ""} placeholder="https://yelp.com/biz/…" /></Field>
            <Field label="Google Business"><Input name="google_url" type="url" defaultValue={b.google_url ?? ""} placeholder="https://g.page/…" /></Field>
            <h2 className="section-label pt-2">Preferences</h2>
            <Field label="Time zone" hint="Every time in the app, texts and the booking page uses it.">
              <Select name="timezone" defaultValue={b.timezone}>
                {TIMEZONES.map(([z, label]) => <option key={z} value={z}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Booking link name" hint="Letters, numbers and dashes.">
              <Input name="booking_slug" defaultValue={b.booking_slug} required />
            </Field>
          </SimpleForm>
        </Card>
      </Page>
    </>
  );
}
