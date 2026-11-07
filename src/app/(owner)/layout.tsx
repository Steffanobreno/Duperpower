import { isAdmin, requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { TabBar } from "@/components/tab-bar";
import { SideMenu } from "@/components/side-menu";
import { AppLock } from "@/components/app-lock";
import { OfflineSupport } from "@/components/offline-support";
import { I18nProvider } from "@/components/i18n";
import { getOwnerI18n } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { accessOf, billingOn } from "@/lib/billing";

export default async function OwnerLayout({ children }: LayoutProps<"/">) {
  const staff = await requireStaff();
  const { lang, messages, dir, t } = await getOwnerI18n();
  // One trip: the requests badge, whether the app lock is on, and the logo's version.
  const [{ requests, lock, logo, plan_status, trial_ends_at }] = await sql<{ requests: number; lock: boolean; logo: string | null; plan_status: string; trial_ends_at: Date | null }[]>`
    select (select count(*)::int from appointments
            where business_id = ${staff.businessId}
              and ((status = 'requested' and start_at > now())
                   or (reschedule_requested_at is not null and status in ('unconfirmed', 'confirmed') and start_at > now()))) as requests,
           (select pin_hash is not null from staff where id = ${staff.staffId}) as lock,
           (select extract(epoch from updated_at)::bigint::text from business_logos where business_id = ${staff.businessId}) as logo,
           (select plan_status from businesses where id = ${staff.businessId}) as plan_status,
           (select trial_ends_at from businesses where id = ${staff.businessId}) as trial_ends_at`;
  // The plan: once the trial is over (or the plan cancelled), only the billing page opens.
  const access = accessOf({ plan_status, trial_ends_at });
  if (billingOn() && access.locked) redirect("/billing");
  const planNote = !billingOn() ? null
    : plan_status === "past_due" ? t("The last payment didn't go through. Update your card.")
      : plan_status === "trial" && (access.trialDaysLeft ?? 99) <= 5 ? t("Free trial: {n} days left.", { n: access.trialDaysLeft ?? 0 })
        : null;
  return (
    <I18nProvider lang={lang} messages={messages} region={staff.region}>
     <div lang={lang} dir={dir} className="contents">
      {lock && <AppLock />}
      {planNote && staff.role === "owner" && (
        <a href="/billing" className="block bg-[#fdf3d7] px-4 py-2 text-center text-sm font-semibold text-[#7a5b0c]">{planNote} {t("Choose a plan")} ›</a>
      )}
      <OfflineSupport />
      {children}
      <TabBar can={staff.can} />
      <SideMenu staffName={staff.staffName} businessName={staff.businessName} requests={requests} role={staff.role} can={staff.can}
        logo={logo ? `/logo/${staff.businessId}?v=${logo}` : null} admin={await isAdmin(staff.staffId)} />
     </div>
    </I18nProvider>
  );
}
