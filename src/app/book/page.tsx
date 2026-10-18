import type { Metadata } from "next";
import { getPublicBusiness, onlineServices } from "@/lib/booking";
import { activeAgreement } from "@/lib/agreement";
import { AgreementText } from "@/components/agreement-text";
import { phoneLabel } from "@/lib/format";
import { Notice } from "@/components/ui";
import { BookingWizard } from "./booking-wizard";

export const metadata: Metadata = { title: "Book a visit", robots: { index: true } };
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const b = await getPublicBusiness();
  if (!b) return null;
  const [services, agreement] = await Promise.all([onlineServices(b.id), activeAgreement(b.id)]);
  const phone = phoneLabel(b.phone);
  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Book {b.name}</h1>
        <p className="text-muted">Mobile grooming at your door. Pick your pet&apos;s service and a time that works for you.</p>
      </header>
      {b.online_booking_enabled ? (
        <BookingWizard
          services={services}
          businessPhone={phone}
          agreement={
            agreement?.required_online ? <AgreementText title={agreement.title} body={agreement.body} /> : null
          }
        />
      ) : (
        <Notice kind="info">Online booking is paused right now. Please text us at {phone} to book.</Notice>
      )}
    </main>
  );
}
