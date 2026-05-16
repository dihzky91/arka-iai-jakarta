"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTanggalLengkapJakarta } from "@/lib/utils";
import { getNavigationItem } from "@/components/layout/navigation";

const GlobalSearch = dynamic(
  () => import("@/components/search/GlobalSearch").then((mod) => mod.GlobalSearch),
  { ssr: false }
);

const NotificationBell = dynamic(
  () => import("@/components/notifications/NotificationBell").then((mod) => mod.NotificationBell),
  { ssr: false }
);

interface HeaderProps {
  userName?: string | null;
  userId?: string;
  onOpenSidebar?: () => void;
}

export function Header({ userName, userId, onOpenSidebar }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const currentItem = getNavigationItem(pathname);
  const todayLabel = useMemo(
    () => formatTanggalLengkapJakarta(new Date()),
    [],
  );

  async function handleLogout() {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // Hard redirect — pastikan semua cache server component ter-clear
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:px-6 lg:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={onOpenSidebar}
            aria-label="Buka navigasi"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-medium text-foreground">
              {currentItem?.label ?? "Workspace"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{todayLabel}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} aria-label="Cari">
            <Search className="h-5 w-5" />
          </Button>
          {userId && <NotificationBell userId={userId} />}
          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <p className="hidden text-sm font-normal text-foreground sm:block">{userName || "Pengguna"}</p>
          <Button variant="outline" size="sm" onClick={handleLogout} className="shrink-0">
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Keluar</span>
          </Button>
        </div>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
