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
const MODULE_STRIP_WIDTH = 80;
const SUBMENU_PANEL_WIDTH = 220;

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
  // Always prefer the client-side pathname (usePathname) as it's always accurate.
  // The prop is only used as SSR fallback but can be stale (defaults to /dashboard).
  const pathname = pathnameFromHook ?? pathnameProp ?? "/dashboard";
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
  const [activeSectionTitle, setActiveSectionTitle] = useState<string | null>(() => {
    // Initialize from pathname to avoid flash on refresh
    const match = visibleSections.find((s) =>
      s.items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    );
    return match?.title ?? visibleSections[0]?.title ?? null;
  });

  // Auto-select active section based on pathname
  useEffect(() => {
    const match = visibleSections.find((s) =>
      s.items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    );
    if (match) {
      setActiveSectionTitle(match.title);
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
          className="flex h-full transition-[width] duration-300 ease-in-out"
          style={{
            width: desktopCollapsed
              ? MODULE_STRIP_WIDTH
              : MODULE_STRIP_WIDTH + SUBMENU_PANEL_WIDTH,
          }}
        >
          {/* TIER 1: Module Strip */}
          <div className="flex w-[80px] shrink-0 flex-col items-center border-r border-sidebar-accent/30 bg-sidebar-bg py-6 z-10 backdrop-blur-xl">
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
                      "group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg",
                      isActive
                        ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                        : "text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                    )}
                    title={section.title}
                    aria-label={section.title}
                    aria-current={isActive ? "true" : undefined}
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
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl transition-colors",
                  desktopCollapsed
                    ? "bg-card text-primary shadow-sm ring-1 ring-border hover:bg-primary hover:text-white"
                    : "text-sidebar-foreground/40 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground",
                )}
                title={desktopCollapsed ? "Tampilkan sub-menu" : "Sembunyikan sub-menu"}
                aria-label={desktopCollapsed ? "Tampilkan sub-menu" : "Sembunyikan sub-menu"}
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
                animate={{ width: SUBMENU_PANEL_WIDTH, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex h-full flex-col overflow-hidden bg-sidebar-bg z-0"
              >
                <div className="flex h-full w-[220px] flex-col">
                  <div className="px-6 py-5">
                    <h2 className="font-outfit text-xl font-medium text-sidebar-foreground tracking-tight">
                      {activeSection?.title}
                    </h2>
                  </div>
                  <nav className="flex-1 overflow-y-auto px-4 pb-5">
                    <ul className="space-y-1">
                      {(() => {
                        // Compute best matching item once (longest href match)
                        const matchingItems = (activeSection?.items ?? []).filter(
                          (i) => i.active && (pathname === i.href || pathname.startsWith(`${i.href}/`))
                        );
                        const bestMatchHref = [...matchingItems].sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

                        let lastGroup: string | undefined;
                        return activeSection?.items.map((item) => {
                          const isActive = bestMatchHref !== null && bestMatchHref === item.href;
                          const unreadCount =
                            (item.href === "/disposisi" ? unreadDisposisiCount : 0) +
                            (item.href === "/pengumuman" ? unreadAnnouncementCount : 0);

                          // Render group separator if group changed
                          const showGroupLabel = item.group && item.group !== lastGroup;
                          if (item.group) lastGroup = item.group;

                        if (!item.active) {
                          return (
                            <li key={item.href}>
                              {showGroupLabel && (
                                <p className="mb-0.5 mt-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
                                  {item.group}
                                </p>
                              )}
                              <div className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm text-muted-foreground opacity-80">
                                <item.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                                <span className="flex-1 font-normal">{item.label}</span>
                                <LockKeyhole className="h-3.5 w-3.5" />
                              </div>
                            </li>
                          );
                        }

                        return (
                          <li key={item.href}>
                              {showGroupLabel && (
                                <p className="mb-0.5 mt-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
                                  {item.group}
                                </p>
                              )}
                            <Link
                              href={item.href}
                              aria-current={isActive ? "page" : undefined}
                              className={cn(
                                "group flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-normal transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg",
                                isActive
                                  ? "bg-muted/80 font-medium text-primary"
                                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/20 hover:text-sidebar-foreground"
                              )}
                            >
                              <item.icon
                                className={cn(
                                  "h-[18px] w-[18px] transition-transform group-hover:scale-110",
                                  isActive ? "text-primary" : "text-muted-foreground"
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
                      });
                      })()}
                    </ul>
                  </nav>
                  
                  {/* ID Card Profil Minimalis */}
                  <div className="p-4 mt-auto border-t border-sidebar-accent/20">
                    <div className="bg-primary/5 rounded-2xl p-3 flex items-center gap-3 border border-primary/10">
                       <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-medium text-sm">
                          {userRole?.charAt(0).toUpperCase() || "A"}
                       </div>
                       <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-sidebar-foreground truncate uppercase">{userRole || "Administrator"}</p>
                          <p className="text-[10px] text-sidebar-foreground/60 truncate">Status: Aktif</p>
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
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Landmark className="h-5 w-5" />
                </div>
                <span className="font-outfit font-medium text-foreground">{appName}</span>
              </div>
              <button
                type="button"
                onClick={() => onMobileOpenChange?.(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
              {visibleSections.map((section) => (
                <div key={section.title} className="space-y-3">
                  <h3 className="font-outfit text-sm font-medium text-foreground flex items-center gap-2">
                     <section.icon className="h-4 w-4 text-primary" />
                     {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {(() => {
                      const matchingItems = section.items.filter(
                        (i) => i.active && (pathname === i.href || pathname.startsWith(`${i.href}/`))
                      );
                      const bestMatchHref = matchingItems.sort((a, b) => b.href.length - a.href.length)[0]?.href;

                      let lastGroup: string | undefined;
                      return section.items.map((item) => {
                      const isActive = bestMatchHref === item.href;
                      const showGroupLabel = item.group && item.group !== lastGroup;
                      if (item.group) lastGroup = item.group;
                      return (
                        <li key={item.href}>
                          {showGroupLabel && (
                            <p className="mb-0.5 mt-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
                              {item.group}
                            </p>
                          )}
                          <Link
                            href={item.href}
                            onClick={() => onMobileOpenChange?.(false)}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-normal transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              isActive
                                ? "bg-primary/10 font-medium text-primary"
                                : "text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <span className="flex-1">{item.label}</span>
                          </Link>
                        </li>
                      );
                    });
                    })()}
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
