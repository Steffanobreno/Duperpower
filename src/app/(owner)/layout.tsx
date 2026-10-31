import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { TabBar } from "@/components/tab-bar";
import { SideMenu } from "@/components/side-menu";
import { AppLock } from "@/components/app-lock";
import { OfflineSupport } from "@/components/offline-support";

export default async function OwnerLayout({ children }: LayoutProps<"/">) {
  const staff = await requireStaff();
  // One trip: the requests badge, whether the app lock is on, and the logo's version.
  const [{ requests, lock, logo }] = await sql<{ requests: number; lock: boolean; logo: string | null }[]>`
    select (select count(*)::int from appointments
            where business_id = ${staff.businessId}
              and ((status = 'requested' and start_at > now())
                   or (reschedule_requested_at is not null and status in ('unconfirmed', 'confirmed') and start_at > now()))) as requests,
           (select pin_hash is not null from staff where id = ${staff.staffId}) as lock,
           (select extract(epoch from updated_at)::bigint::text from business_logos where business_id = ${staff.businessId}) as logo`;
  return (
    <>
      {lock && <AppLock />}
      <OfflineSupport />
      {children}
      <TabBar can={staff.can} />
      <SideMenu staffName={staff.staffName} businessName={staff.businessName} requests={requests} role={staff.role} can={staff.can}
        logo={logo ? `/logo/${staff.businessId}?v=${logo}` : null} />
    </>
  );
}
