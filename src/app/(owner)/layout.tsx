import { requireStaff } from "@/lib/auth";
import { TabBar } from "@/components/tab-bar";

export default async function OwnerLayout({ children }: LayoutProps<"/">) {
  await requireStaff();
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
