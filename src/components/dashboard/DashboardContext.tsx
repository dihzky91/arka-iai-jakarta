"use client";

import { createContext, useContext } from "react";
import type { Capability } from "@/lib/rbac/capabilities";

interface DashboardContextValue {
  capabilities: Capability[];
  isSuperAdmin: boolean;
  userRole: string | null;
}

const DashboardContext = createContext<DashboardContextValue>({
  capabilities: [],
  isSuperAdmin: false,
  userRole: null,
});

export function DashboardProvider({
  capabilities,
  isSuperAdmin,
  userRole,
  children,
}: DashboardContextValue & { children: React.ReactNode }) {
  return (
    <DashboardContext.Provider value={{ capabilities, isSuperAdmin, userRole }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  return useContext(DashboardContext);
}

export function useHasCapability(required: Capability[]): boolean {
  const { capabilities, isSuperAdmin } = useDashboard();
  if (isSuperAdmin) return true;
  return capabilities.some((c) => required.includes(c));
}
