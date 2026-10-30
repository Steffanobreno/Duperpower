import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
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
  const staff = await requireStaff();
  const [b] = await sql`
    select online_booking_enabled, buffer_minutes, max_cluster_miles::float8 as max_cluster_miles,
           service_radius_miles::float8 as service_radius_miles, min_notice_hours, booking_days_ahead,
           cancellation_hours, start_zip, slot_minutes, auto_accept, name
    from businesses where id = ${staff.businessId}`;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const bookUrl = `${appUrl}/book`;
  const [svg, logo] = await Promise.all([
    QRCode.toString(bookUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0b1f3a", light: "#ffffff" } }),
    logoUrl(staff.businessId),
  ]);
  const embed = `<iframe src="${bookUrl}" title="Book a visit" style="width:100%;min-height:1400px;border:0"></iframe>`;
  return (
    <>
      <PageHeader title="Online booking" back="/settings" />
      <Page>
        <Card className="space-y-3">
          <h2 className="font-bold">Your booking page</h2>
          <CopyField label="Link for the Book Now button" value={bookUrl} />
          <CopyField label="Or embed it inside a page of your site" value={embed} />
          <CopyField label="New client form (pet and contact info, no booking)" value={`${appUrl}/intake`} />
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">QR code</h2>
          <p className="text-sm text-muted">Put it on the van, flyers or business cards. Clients scan it to book.</p>
          <QrCard svg={svg} name={b.name} logo={logo} url={bookUrl} />
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">Automation</h2>
          <SimpleForm action={saveAutoAcceptAction}>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">When a client books online</legend>
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
              Clients can request appointments online
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max miles between a day's stops" hint="New requests must be this close to the other visits that day.">
                <Input name="max_cluster_miles" inputMode="decimal" defaultValue={b.max_cluster_miles} />
              </Field>
              <Field label="Driving time between visits (min)" hint="Kept free before and after each visit.">
                <Input name="buffer_minutes" inputMode="numeric" defaultValue={b.buffer_minutes} />
              </Field>
              <Field label="Van's home ZIP" hint="Private. Used to check the service area.">
                <Input name="start_zip" inputMode="numeric" maxLength={5} defaultValue={b.start_zip ?? ""} />
              </Field>
              <Field label="Service area (miles from home)">
                <Input name="service_radius_miles" inputMode="decimal" defaultValue={b.service_radius_miles} />
              </Field>
              <Field label="Start times every (min)" hint="120 = 7, 9, 11… After a visit ends, times restart from there.">
                <Input name="slot_minutes" inputMode="numeric" defaultValue={b.slot_minutes} />
              </Field>
              <Field label="Minimum notice (hours)">
                <Input name="min_notice_hours" inputMode="numeric" defaultValue={b.min_notice_hours} />
              </Field>
              <Field label="Book up to (days ahead)">
                <Input name="booking_days_ahead" inputMode="numeric" defaultValue={b.booking_days_ahead} />
              </Field>
              <Field label="Clients can cancel up to (hours before)">
                <Input name="cancellation_hours" inputMode="numeric" defaultValue={b.cancellation_hours} />
              </Field>
            </div>
          </SimpleForm>
        </Card>
        <p className="text-center text-xs text-muted">
          Requests show up in Today and in Requests. They hold the time until you accept or decline.
          Bookings made right away show up on the calendar, and you get a notification.
        </p>
      </Page>
    </>
  );
}
