import { getOwnerI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { requirePermission } from "@/lib/auth";
import { logoUrl } from "@/lib/business-logo";
import { sql } from "@/lib/db";
import { phoneLabel } from "@/lib/format";
import { CopyField } from "@/components/copy-field";
import { Button, ButtonLink, Card, Page, PageHeader } from "@/components/ui";
import { LogoUpload } from "../settings/business/logo-upload";
import { HoursForm } from "../settings/forms";
import { finishWelcomeAction, welcomeHoursAction } from "./actions";
import { BusinessStep, PricesStep, type PriceRow } from "./welcome-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getOwnerI18n();
  return { title: t("Set up your business") };
}

const STEPS = 5;

// The first run after signup: five short steps, each one can be skipped. Finishing (or
// "Skip setup") marks the business as set up, and the app opens on Today from then on.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getOwnerI18n();
  const staff = await requirePermission("settings");
  const raw = Number((await searchParams).step ?? 1);
  const step = Number.isInteger(raw) && raw >= 1 && raw <= STEPS ? raw : 1;
  const next = `/welcome?step=${step + 1}`;
  const titles = [t("Your business"), t("Your prices"), t("Your working hours"), t("Your clients"), t("Share your booking link")];
  const intros = [
    t("Your logo and how clients reach you. You can change it anytime in Settings."),
    t("These are starting prices. Change them to yours: the app and your booking page use them."),
    t("When you take appointments. Clients only see free times inside them."),
    t("Bring them in now from your old app, or add them as they book."),
    t("Clients book on this page by themselves. Put it on your Instagram, WhatsApp and Google profile."),
  ];

  let body: React.ReactNode = null;
  if (step === 1) {
    const [[b], logo] = await Promise.all([
      sql<{ phone: string | null; address_line: string | null; city: string | null; zip: string | null }[]>`
        select phone, address_line, city, zip from businesses where id = ${staff.businessId}`,
      logoUrl(staff.businessId),
    ]);
    body = (
      <>
        <Card><LogoUpload src={logo} /></Card>
        <Card>
          <BusinessStep initial={{ phone: b.phone ? phoneLabel(b.phone) : "", address_line: b.address_line ?? "", city: b.city ?? "", zip: b.zip ?? "" }} />
        </Card>
      </>
    );
  } else if (step === 2) {
    const services = await sql<PriceRow[]>`
      select id, name, kind, category, price_cents, active from services
      where business_id = ${staff.businessId} order by kind desc, sort_order, name`;
    body = <PricesStep services={services} />;
  } else if (step === 3) {
    const rows = await sql<{ weekday: number; start: string; end: string }[]>`
      select weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as end
      from working_hours where staff_id = ${staff.staffId} order by weekday`;
    body = <Card><HoursForm action={welcomeHoursAction} hours={rows} submitLabel={t("Continue")} /></Card>;
  } else if (step === 4) {
    body = (
      <div className="space-y-3">
        <ButtonLink href="/settings/import" className="w-full justify-start py-4 text-left">
          <span>
            <span className="block text-base">📥 {t("Import from another app")}</span>
            <span className="block text-sm font-normal opacity-80">{t("Upload the client list (CSV) from your old app or a spreadsheet.")}</span>
          </span>
        </ButtonLink>
        <ButtonLink href="/clients/new" kind="secondary" className="w-full justify-start py-4 text-left">
          <span>
            <span className="block text-base">➕ {t("Add my first client")}</span>
            <span className="block text-sm font-normal opacity-80">{t("Name, phone and their pet. Takes a minute.")}</span>
          </span>
        </ButtonLink>
        <ButtonLink href={next} kind="secondary" className="w-full py-3.5">{t("I'll do it later")}</ButtonLink>
      </div>
    );
  } else {
    const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const bookUrl = `${appUrl}/book/${staff.bookingSlug}`;
    const qr = await QRCode.toString(bookUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0b1f3a", light: "#ffffff" } });
    body = (
      <>
        <Card className="space-y-4">
          <CopyField label={t("Your booking page")} value={bookUrl} />
          <div className="mx-auto w-44" role="img" aria-label={t("QR code for {url}", { url: bookUrl })} dangerouslySetInnerHTML={{ __html: qr }} />
          <ButtonLink href={`/book/${staff.bookingSlug}`} kind="secondary" className="w-full">{t("Open my booking page")}</ButtonLink>
        </Card>
        <form action={finishWelcomeAction}>
          <Button type="submit" className="w-full py-3.5 text-base">{t("Finish")} 🎉</Button>
        </form>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("Set up your business")} />
      <Page>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-muted">{t("Step {n} of {total}", { n: step, total: STEPS })}</span>
            <form action={finishWelcomeAction}>
              <button type="submit" className="font-semibold text-brand underline">{t("Skip setup")}</button>
            </form>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step}
            aria-label={t("Step {n} of {total}", { n: step, total: STEPS })}>
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(step / STEPS) * 100}%` }} />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">{titles[step - 1]}</h1>
          <p className="mt-1 text-muted">{intros[step - 1]}</p>
        </div>
        {body}
        {step < 4 && (
          <p className="text-center">
            <a href={next} className="text-sm font-semibold text-muted underline">{t("Skip this step")}</a>
          </p>
        )}
      </Page>
    </>
  );
}
