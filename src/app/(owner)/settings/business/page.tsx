import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { logoUrl } from "@/lib/business-logo";
import { sql } from "@/lib/db";
import { phoneLabel } from "@/lib/format";
import { CountryFields } from "@/components/country-fields";
import { placeNames } from "@/lib/countries";
import { Card, Field, Input, Page, PageHeader, Select } from "@/components/ui";
import { saveBusinessAction } from "../actions";
import { SimpleForm } from "../forms";
import { LogoUpload } from "./logo-upload";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Business") };
}

type Business = {
  name: string; phone: string | null; booking_slug: string; timezone: string; country: string; currency: string;
  address_line: string | null; city: string | null; state: string | null; zip: string | null;
  website_url: string | null; facebook_url: string | null; instagram_url: string | null; yelp_url: string | null; google_url: string | null;
};

export default async function BusinessPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const [[b], logo] = await Promise.all([
    sql<Business[]>`select name, phone, booking_slug, timezone, country, currency, address_line, city, state, zip,
                           website_url, facebook_url, instagram_url, yelp_url, google_url
                    from businesses where id = ${staff.businessId}`,
    logoUrl(staff.businessId),
  ]);
  return (
    <>
      <PageHeader title={t("Business")} back="/settings" />
      <Page>
        <Card>
          <LogoUpload src={logo} />
        </Card>
        <Card>
          <SimpleForm action={saveBusinessAction}>
            <Field label={t("Business name")}>
              <Input name="name" defaultValue={b.name} required maxLength={80} />
            </Field>
            <Field label={t("Business phone")} hint={t("Shown in texts and receipts.")}>
              <Input name="phone" type="tel" defaultValue={phoneLabel(b.phone)} />
            </Field>
            <h2 className="section-label pt-2">{t("Address")}</h2>
            <p className="-mt-2 text-xs text-muted">{t("Shown on receipts. A mobile business can leave it empty.")}</p>
            <Field label={t("Street")}>
              <Input name="address_line" defaultValue={b.address_line ?? ""} autoComplete="street-address" />
            </Field>
            <div className="grid grid-cols-[1fr_5rem_6rem] gap-2">
              <Field label={t("City")}><Input name="city" defaultValue={b.city ?? ""} /></Field>
              <Field label={b.country === "US" ? t("State") : t("State / region")}><Input name="state" defaultValue={b.state ?? (b.country === "US" ? "CA" : "")} maxLength={20} /></Field>
              <Field label={b.country === "US" ? "ZIP" : t("Postal code")}><Input name="zip" defaultValue={b.zip ?? ""} inputMode={b.country === "US" ? "numeric" : "text"} maxLength={10} /></Field>
            </div>
            <h2 className="section-label pt-2">{t("Links")}</h2>
            <Field label={t("Website")}><Input name="website_url" type="url" defaultValue={b.website_url ?? ""} placeholder="https://" /></Field>
            <Field label={t("Facebook")}><Input name="facebook_url" type="url" defaultValue={b.facebook_url ?? ""} placeholder="https://facebook.com/…" /></Field>
            <Field label={t("Instagram")}><Input name="instagram_url" type="url" defaultValue={b.instagram_url ?? ""} placeholder="https://instagram.com/…" /></Field>
            <Field label={t("Yelp")}><Input name="yelp_url" type="url" defaultValue={b.yelp_url ?? ""} placeholder="https://yelp.com/biz/…" /></Field>
            <Field label={t("Google Business")}><Input name="google_url" type="url" defaultValue={b.google_url ?? ""} placeholder="https://g.page/…" /></Field>
            <h2 className="section-label pt-2">{t("Preferences")}</h2>
            <CountryFields country={b.country} currency={b.currency} timezone={b.timezone} names={placeNames(staff.lang)} />
            <h2 className="section-label pt-2">{t("Measurements")}</h2>
            <Field label={t("Sort dogs into sizes by")} hint={t("Prices by size follow it, in the app and on your booking page.")}>
              <Select name="size_by" defaultValue={staff.region.sizeBy}>
                <option value="height">{t("Height at the shoulder")}</option>
                <option value="weight">{t("Weight")}</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Weight in")}>
                <Select name="weight_unit" defaultValue={staff.region.kg ? "kg" : "lb"}>
                  <option value="lb">{t("Pounds (lb)")}</option>
                  <option value="kg">{t("Kilograms (kg)")}</option>
                </Select>
              </Field>
              <Field label={t("Height in")}>
                <Select name="length_unit" defaultValue={staff.region.metric ? "cm" : "in"}>
                  <option value="in">{t("Inches (in)")}</option>
                  <option value="cm">{t("Centimeters (cm)")}</option>
                </Select>
              </Field>
            </div>
            <Field label={t("Booking link name")} hint={t("Letters, numbers and dashes.")}>
              <Input name="booking_slug" defaultValue={b.booking_slug} required />
            </Field>
          </SimpleForm>
        </Card>
      </Page>
    </>
  );
}
