import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Card, Field, Input, Page, PageHeader } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { saveAutoAcceptAction, saveBookingSettingsAction } from "../actions";
import QRCode from "qrcode";
import { logoUrl } from "@/lib/business-logo";
import { QrCard } from "./qr-card";
import { SimpleForm } from "../forms";

export const metadata: Metadata = { title: "Online booking" };

export default async function BookingSettingsPage() {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const [b] = await sql`
    select online_booking_enabled, buffer_minutes, max_cluster_miles::float8 as max_cluster_miles,
           service_radius_miles::float8 as service_radius_miles, min_notice_hours, booking_days_ahead,
           cancellation_hours, start_zip, slot_minutes, auto_accept, name
    from businesses where id = ${staff.businessId}`;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const bookUrl = `${appUrl}/book/${staff.bookingSlug}`;
  const [svg, logo] = await Promise.all([
    QRCode.toString(bookUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0b1f3a", light: "#ffffff" } }),
    logoUrl(staff.businessId),
  ]);
  const embed = `<iframe src="${bookUrl}" title="Book a visit" style="width:100%;min-height:1400px;border:0"></iframe>`;
  return (
    <>
      <PageHeader title={t("Online booking")} back="/settings" />
      <Page>
        <Card className="space-y-3">
          <h2 className="font-bold">{t("Your booking page")}</h2>
          <CopyField label={t("Link for the Book Now button")} value={bookUrl} />
          <CopyField label={t("Or embed it inside a page of your site")} value={embed} />
          <CopyField label={t("New client form (pet and contact info, no booking)")} value={`${appUrl}/intake/${staff.bookingSlug}`} />
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">{t("QR code")}</h2>
          <p className="text-sm text-muted">{t("Put it on the van, flyers or business cards. Clients scan it to book.")}</p>
          <QrCard svg={svg} name={b.name} logo={logo} url={bookUrl} />
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">{t("Automation")}</h2>
          <SimpleForm action={saveAutoAcceptAction}>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">{t("When a client books online")}</legend>
              {([
                ["none", "I accept or decline each request", "The time is held until you answer."],
                ["returning", "Book clients I already know right away", "New clients still wait for you."],
                ["all", "Book everyone right away", "Every online booking goes straight on the calendar."],
              ] as const).map(([value, title, text]) => (
                <label key={value} className="flex items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                  <input type="radio" name="auto_accept" value={value} defaultChecked={b.auto_accept === value} className="mt-1 h-4 w-4" />
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm text-muted">{text}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </SimpleForm>
        </Card>
        <Card>
          <SimpleForm action={saveBookingSettingsAction}>
            <label className="flex items-center gap-3 font-medium">
              <input type="checkbox" name="online_booking_enabled" defaultChecked={b.online_booking_enabled} className="h-5 w-5" />
              {t("Clients can request appointments online")}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Max miles between a day's stops")} hint={t("New requests must be this close to the other visits that day.")}>
                <Input name="max_cluster_miles" inputMode="decimal" defaultValue={b.max_cluster_miles} />
              </Field>
              <Field label={t("Driving time between visits (min)")} hint={t("Kept free before and after each visit.")}>
                <Input name="buffer_minutes" inputMode="numeric" defaultValue={b.buffer_minutes} />
              </Field>
              <Field label={t("Van's home ZIP")} hint={t("Private. Used to check the service area.")}>
                <Input name="start_zip" inputMode="numeric" maxLength={5} defaultValue={b.start_zip ?? ""} />
              </Field>
              <Field label={t("Service area (miles from home)")}>
                <Input name="service_radius_miles" inputMode="decimal" defaultValue={b.service_radius_miles} />
              </Field>
              <Field label={t("Start times every (min)")} hint={t("120 = 7, 9, 11… After a visit ends, times restart from there.")}>
                <Input name="slot_minutes" inputMode="numeric" defaultValue={b.slot_minutes} />
              </Field>
              <Field label={t("Minimum notice (hours)")}>
                <Input name="min_notice_hours" inputMode="numeric" defaultValue={b.min_notice_hours} />
              </Field>
              <Field label={t("Book up to (days ahead)")} hint={t("365 = the whole year ahead.")}>
                <Input name="booking_days_ahead" inputMode="numeric" defaultValue={b.booking_days_ahead} />
              </Field>
              <Field label={t("Clients can cancel up to (hours before)")}>
                <Input name="cancellation_hours" inputMode="numeric" defaultValue={b.cancellation_hours} />
              </Field>
            </div>
          </SimpleForm>
        </Card>
        <p className="text-center text-xs text-muted">
          {t("Requests show up in Today and in Requests. They hold the time until you accept or decline. Bookings made right away show up on the calendar, and you get a notification.")}
        </p>
      </Page>
    </>
  );
}
