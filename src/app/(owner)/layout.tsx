import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { TabBar } from "@/components/tab-bar";
import { SideMenu } from "@/components/side-menu";
import { logoUrl } from "@/lib/business-logo";
import { AppLock } from "@/components/app-lock";

export default async function OwnerLayout({ children }: LayoutProps<"/">) {
  const staff = await requireStaff();
  const [{ requests }] = await sql<{ requests: number }[]>`
    select count(*)::int as requests from appointments
    where business_id = ${staff.businessId}
      and ((status = 'requested' and start_at > now()) or (reschedule_requested_at is not null and status in ('unconfirmed', 'confirmed') and start_at > now()))`;
  const [lock] = await sql<{ on: boolean }[]>`select pin_hash is not null as on from staff where id = ${staff.staffId}`;
  return (
    <>
      {lock?.on && <AppLock />}
      {children}
      <TabBar can={staff.can} />
      <SideMenu staffName={staff.staffName} businessName={staff.businessName} requests={requests} role={staff.role} can={staff.can}
        logo={await logoUrl(staff.businessId)} />
    </>
  );
}
