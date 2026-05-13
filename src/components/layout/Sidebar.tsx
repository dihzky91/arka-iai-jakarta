"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Landmark,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getNavigationItem,
  navigationSections,
  type NavRole,
  type NavigationSection,
} from "@/components/layout/navigation";
import { APP_BRAND_DESCRIPTION, APP_BRAND_NAME } from "@/lib/branding";
import type { Capability } from "@/lib/rbac/capabilities";

const SIDEBAR_COLLAPSED_KEY = "iai-sidebar-collapsed";
const EMPTY_CAPABILITIES: Capability[] = [];

interface SidebarProps {
  unreadDisposisiCount?: number;
  unreadAnnouncementCount?: number;
  systemIdentity?: { namaSistem: string; logoUrl: string | null };
  userRole?: NavRole | null;
  userCapabilities?: Capability[];
  isSuperAdmin?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  pathname?: string;
}

export function Sidebar({
  unreadDisposisiCount = 0,
  unreadAnnouncementCount = 0,
  systemIdentity,
  userRole,
  userCapabilities,
  isSuperAdmin = false,
  mobileOpen = false,
  onMobileOpenChange,
  pathname: pathnameProp,
}: SidebarProps) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [hasLoadedCollapsedState, setHasLoadedCollapsedState] = useState(false);
  const pathnameFromHook = usePathname();
  const pathname = pathnameProp ?? pathnameFromHook;
  const appName =
    systemIdentity?.namaSistem ??
    process.env.NEXT_PUBLIC_APP_NAME ??
    APP_BRAND_NAME;
  const logoUrl = systemIdentity?.logoUrl ?? "/iai-logo.png";
  
  const userCapabilityList = userCapabilities ?? EMPTY_CAPABILITIES;
  const capabilitySet = useMemo(
    () => new Set(userCapabilityList),
    [userCapabilityList],
  );

  // Filter section + item berdasarkan role
  const visibleSections = useMemo(
    () =>
      navigationSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              isSuperAdmin ||
              (item.requiredCapability
                ? capabilitySet.has(item.requiredCapability) ||
                  item.fallbackCapabilities?.some((capability) =>
                    capabilitySet.has(capability),
                  ) === true
                : !item.allowedRoles ||
                  (userRole && item.allowedRoles.includes(userRole))),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [capabilitySet, isSuperAdmin, userRole],
  );

  // Tier 1 Active Section State
  const [activeSectionTitle, setActiveSectionTitle] = useState<string | null>(null);

  // Auto-select active section based on pathname
  useEffect(() => {
    const match = visibleSections.find((s) =>
      s.items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    );
    if (match) {
      setActiveSectionTitle(match.title);
    } else if (visibleSections.length > 0 && !activeSectionTitle) {
      setActiveSectionTitle(visibleSections[0]!.title);
    }
  }, [pathname, visibleSections]);

  const activeSection = visibleSections.find((s) => s.title === activeSectionTitle) || visibleSections[0];

  useEffect(() => {
    try {
      setDesktopCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      setDesktopCollapsed(false);
    } finally {
      setHasLoadedCollapsedState(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedCollapsedState) return;
    try {
      if (desktopCollapsed) {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
      } else {
        window.localStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
      }
    } catch {
      // ignore
    }
  }, [desktopCollapsed, hasLoadedCollapsedState]);

  if (!hasLoadedCollapsedState) return null;

  return (
    <>
      {/* DESKTOP SIDEBAR - DUAL TIER */}
      <aside className="relative sticky top-0 hidden h-screen shrink-0 border-r border-border bg-card lg:flex">
        <div
          className={cn(
            "flex h-full transition-[width] duration-300 ease-in-out",
            desktopCollapsed ? "w-[80px]" : "w-[300px]"
          )}
        >
          {/* TIER 1: Module Strip */}
          <div className="flex w-[80px] shrink-0 flex-col items-center border-r border-slate-100 bg-slate-50/60 py-6 z-10 backdrop-blur-xl">
            {/* Logo */}
            <div className="mb-8 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-sm">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={appName} className="h-full w-full object-contain" />
              ) : (
                <Landmark className="h-6 w-6" />
              )}
            </div>

            {/* Icons List */}
            <div className="flex w-full flex-col items-center gap-4 px-3 flex-1 overflow-y-auto no-scrollbar">
              {visibleSections.map((section) => {
                const isActive = section.title === activeSectionTitle;
                return (
                  <button
                    key={section.title}
                    onClick={() => {
                      setActiveSectionTitle(section.title);
                      if (desktopCollapsed) setDesktopCollapsed(false);
                    }}
                    className={cn(
                      "group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-200",
                      isActive
                        ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                        : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-900"
                    )}
                    title={section.title}
                  >
                    <section.icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.5 : 2} />
                  </button>
                );
              })}
            </div>

            {/* Toggle Button */}
            <div className="mt-4 px-3">
              <button
                onClick={() => setDesktopCollapsed(!desktopCollapsed)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-slate-400 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
                title={desktopCollapsed ? "Expand" : "Collapse"}
              >
                {desktopCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* TIER 2: Sub-menu Panel */}
          <AnimatePresence initial={false}>
            {!desktopCollapsed && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 220, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex h-full flex-col overflow-hidden bg-white z-0"
              >
                <div className="w-[220px] flex h-full flex-col">
                  <div className="px-6 py-8">
                    <h2 className="font-outfit text-xl font-medium text-slate-900 tracking-tight">
                      {activeSection?.title}
                    </h2>
                  </div>
                  <nav className="flex-1 overflow-y-auto px-4 pb-6">
                    <ul className="space-y-2">
                      {activeSection?.items.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                        const unreadCount =
                          (item.href === "/disposisi" ? unreadDisposisiCount : 0) +
                          (item.href === "/pengumuman" ? unreadAnnouncementCount : 0);

                        if (!item.active) {
                          return (
                            <li key={item.href}>
                              <div className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-400 opacity-80">
                                <item.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                                <span className="flex-1 font-medium">{item.label}</span>
                                <LockKeyhole className="h-3.5 w-3.5" />
                              </div>
                            </li>
                          );
                        }

                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={cn(
                                "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200",
                                isActive
                                  ? "bg-slate-100/80 font-medium text-primary"
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              )}
                            >
                              <item.icon
                                className={cn(
                                  "h-[18px] w-[18px] transition-transform group-hover:scale-110",
                                  isActive ? "text-primary" : "text-slate-400"
                                )}
                                strokeWidth={isActive ? 2.5 : 2}
                              />
                              <span className="flex-1">{item.label}</span>
                              {unreadCount > 0 && (
                                <Badge
                                  variant={isActive ? "default" : "secondary"}
                                  className={cn(
                                    "rounded-full px-1.5 h-5 min-w-5 flex items-center justify-center text-[10px]",
                                    isActive ? "bg-primary text-white" : ""
                                  )}
                                >
                                  {unreadCount > 99 ? "99+" : unreadCount}
                                </Badge>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                  
                  {/* ID Card Profil Minimalis */}
                  <div className="p-4 mt-auto border-t border-slate-100">
                    <div className="bg-primary/5 rounded-2xl p-3 flex items-center gap-3 border border-primary/10">
                       <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                          {userRole?.charAt(0).toUpperCase() || "A"}
                       </div>
                       <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 truncate uppercase">{userRole || "Administrator"}</p>
                          <p className="text-[10px] text-slate-500 truncate">Status: Aktif</p>
                       </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* MOBILE DIALOG */}
      <Dialog open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="left-0 top-0 h-dvh w-[min(22rem,100vw-1rem)] max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-y-0 border-l-0 p-0 sm:max-w-none"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Navigasi utama</DialogTitle>
          <div className="flex h-full min-h-0 flex-col bg-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Landmark className="h-5 w-5" />
                </div>
                <span className="font-outfit font-semibold text-slate-900">{appName}</span>
              </div>
              <button
                type="button"
                onClick={() => onMobileOpenChange?.(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
              {visibleSections.map((section) => (
                <div key={section.title} className="space-y-3">
                  <h3 className="font-outfit text-sm font-semibold text-slate-900 flex items-center gap-2">
                     <section.icon className="h-4 w-4 text-primary" />
                     {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => onMobileOpenChange?.(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <span className="flex-1">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
