import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { TabBar } from "@/components/tab-bar";
import { SideMenu } from "@/components/side-menu";

export default async function OwnerLayout({ children }: LayoutProps<"/">) {
  const staff = await requireStaff();
  const [{ requests }] = await sql<{ requests: number }[]>`
    select count(*)::int as requests from appointments where business_id = ${staff.businessId} and status = 'requested'`;
  return (
    <>
      {children}
      <TabBar />
      <SideMenu staffName={staff.staffName} businessName={staff.businessName} requests={requests} />
    </>
  );
}
