import type { Metadata } from "next";
import { getCurrentUserAccess, getSession } from "@/server/actions/auth";
import { getRoleDashboardData } from "@/server/actions/statistics";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export const metadata: Metadata = {
  title: "Dashboard | ARKA",
};

export default async function DashboardPage() {
  const [access, session] = await Promise.all([
    getCurrentUserAccess(),
    getSession(),
  ]);
  const capabilities = access?.capabilities ?? [];
  const isSuperAdmin = access?.isSuperAdmin ?? false;
  const userName = session?.user.name ?? null;
  const userId = session?.user.id ?? null;

  const data = await getRoleDashboardData(capabilities, isSuperAdmin, userId);

  return <DashboardContent data={data} userName={userName} />;
}
