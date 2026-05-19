import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUserAccess, getSession } from "@/server/actions/auth";
import { countUnreadAnnouncements } from "@/server/actions/announcements";
import { countUnreadDisposisi } from "@/server/actions/disposisi";
import { getSystemSettings } from "@/server/actions/systemSettings";
import { getUserColorTheme } from "@/server/actions/color-theme";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AnnouncementToastNotifier } from "@/components/announcements/AnnouncementToastNotifier";
import { DashboardProvider } from "@/components/dashboard/DashboardContext";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const access = await getCurrentUserAccess();
  const userRole =
    access?.role ?? (session.user as { role?: string } | undefined)?.role ?? null;

  const [unreadDisposisiCount, unreadAnnouncementCount, systemIdentity, colorTheme] = await Promise.all([
    countUnreadDisposisi(),
    countUnreadAnnouncements(),
    getSystemSettings(),
    getUserColorTheme(),
  ]);

  // Ambil pathname dari header agar SSR match dengan client hydration
  const headersList = await headers();
  const pathname = headersList.get("x-pathname")
    ?? headersList.get("next-url")
    ?? "/dashboard";

  return (
    <DashboardShell
      unreadDisposisiCount={unreadDisposisiCount}
      unreadAnnouncementCount={unreadAnnouncementCount}
      systemIdentity={systemIdentity}
      userRole={userRole as "admin" | "staff" | "pejabat" | "viewer" | null}
      userCapabilities={access?.capabilities ?? []}
      isSuperAdmin={access?.isSuperAdmin ?? false}
      userName={session.user.name}
      userId={session.user.id}
      pathname={pathname}
      colorTheme={colorTheme}
    >
      <DashboardProvider
        capabilities={access?.capabilities ?? []}
        isSuperAdmin={access?.isSuperAdmin ?? false}
        userRole={userRole}
      >
        <AnnouncementToastNotifier unreadCount={unreadAnnouncementCount} />
        {children}
      </DashboardProvider>
    </DashboardShell>
  );
}
