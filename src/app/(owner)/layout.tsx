import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { TabBar } from "@/components/tab-bar";
import { SideMenu } from "@/components/side-menu";
import { AppLock } from "@/components/app-lock";
import { OfflineSupport } from "@/components/offline-support";
import { I18nProvider } from "@/components/i18n";
import { getOwnerI18n } from "@/lib/i18n/server";

export default async function OwnerLayout({ children }: LayoutProps<"/">) {
  const staff = await requireStaff();
  const { lang, messages, dir } = await getOwnerI18n();
  // One trip: the requests badge, whether the app lock is on, and the logo's version.
  const [{ requests, lock, logo }] = await sql<{ requests: number; lock: boolean; logo: string | null }[]>`
    select (select count(*)::int from appointments
            where business_id = ${staff.businessId}
              and ((status = 'requested' and start_at > now())
                   or (reschedule_requested_at is not null and status in ('unconfirmed', 'confirmed') and start_at > now()))) as requests,
           (select pin_hash is not null from staff where id = ${staff.staffId}) as lock,
           (select extract(epoch from updated_at)::bigint::text from business_logos where business_id = ${staff.businessId}) as logo`;
  return (
    <I18nProvider lang={lang} messages={messages}>
     <div lang={lang} dir={dir} className="contents">
      {lock && <AppLock />}
      <OfflineSupport />
      {children}
      <TabBar can={staff.can} />
      <SideMenu staffName={staff.staffName} businessName={staff.businessName} requests={requests} role={staff.role} can={staff.can}
        logo={logo ? `/logo/${staff.businessId}?v=${logo}` : null} />
     </div>
    </I18nProvider>
  );
}
