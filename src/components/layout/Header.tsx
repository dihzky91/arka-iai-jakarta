"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronDown, LogOut, Menu, Palette, Search, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTanggalLengkapJakarta } from "@/lib/utils";
import { getNavigationItem } from "@/components/layout/navigation";
import { COLOR_THEME_PRESETS, type ColorThemeId } from "@/lib/color-themes";
import { setUserColorTheme } from "@/server/actions/color-theme";

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
  userRole?: string | null;
  isSuperAdmin?: boolean;
  colorTheme?: ColorThemeId;
  onOpenSidebar?: () => void;
}

export function Header({ userName, userId, userRole, isSuperAdmin, colorTheme = "ocean", onOpenSidebar }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { setTheme, theme } = useTheme();
  const pathname = usePathname();
  const currentItem = getNavigationItem(pathname);
  const todayLabel = useMemo(
    () => formatTanggalLengkapJakarta(new Date()),
    [],
  );

  const name = userName || "Pengguna";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  const roleLabel = isSuperAdmin
    ? "Super Admin"
    : userRole === "admin"
      ? "Admin"
      : userRole === "staff"
        ? "Staff"
        : userRole === "pejabat"
          ? "Pejabat"
          : (userRole ?? "Member");

  function handleThemeChange(themeId: ColorThemeId) {
    setTheme(themeId);
    startTransition(async () => {
      await setUserColorTheme(themeId);
    });
  }

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

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 px-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </div>
                <span className="hidden max-w-[120px] truncate text-sm font-normal text-foreground sm:inline">
                  {name}
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex items-center gap-3 py-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">IAI Jakarta</p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Peran
                  </span>
                  <span className="font-medium text-foreground">{roleLabel}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Status
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                    TERVERIFIKASI
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              {/* Color Theme Picker */}
              <div className="px-2 py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Palette className="h-3.5 w-3.5" />
                  Tema
                </div>
                <TooltipProvider delayDuration={200}>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_THEME_PRESETS.map((preset) => {
                      const isActive = (theme ?? colorTheme) === preset.id;
                      return (
                        <Tooltip key={preset.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => handleThemeChange(preset.id)}
                              className={"relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1" + (isActive ? " border-white ring-1 ring-primary shadow-sm" : " border-transparent")}
                              style={{ backgroundColor: preset.previewHex }}
                            >
                              {isActive && (
                                <svg className="h-3 w-3 text-white drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {preset.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profil" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profil Saya
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
