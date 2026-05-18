import type { Metadata } from "next";
import { getCurrentUserAccess, getSession } from "@/server/actions/auth";
import { getRoleDashboardData, getProjectCentricData } from "@/server/actions/statistics";
import { getUserDashboardPreferences } from "@/server/actions/dashboard-preferences";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export const metadata: Metadata = {
  title: "Dashboard | ARKA",
};

export default async function DashboardPage() {
  // getSession() and getCurrentUserAccess() use React cache(),
  // so they deduplicate with the layout calls within the same request.
  const [access, session] = await Promise.all([
    getCurrentUserAccess(),
    getSession(),
  ]);
  const capabilities = access?.capabilities ?? [];
  const isSuperAdmin = access?.isSuperAdmin ?? false;
  const userName = session?.user.name ?? null;
  const userId = session?.user.id ?? null;

  const isProjectCentric =
    !isSuperAdmin && capabilities.includes("projects:view");

  const [data, projectData, preferences] = await Promise.all([
    getRoleDashboardData(capabilities, isSuperAdmin, userId),
    isProjectCentric && userId
      ? getProjectCentricData(userId)
      : Promise.resolve(null),
    getUserDashboardPreferences(),
  ]);

  return (
    <DashboardContent
      data={data}
      projectData={projectData}
      preferences={preferences}
      userName={userName}
    />
  );
}
