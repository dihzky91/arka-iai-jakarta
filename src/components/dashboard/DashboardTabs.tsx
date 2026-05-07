"use client";

import { useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  LayoutDashboard,
  BarChart3,
  GraduationCap,
  Mail,
  Users,
  Award,
  Banknote,
} from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import type { Capability } from "@/lib/rbac/capabilities";

interface TabConfig {
  value: string;
  label: string;
  icon: typeof LayoutDashboard;
  capabilityGate?: Capability[];
}

const ALL_TABS: TabConfig[] = [
  { value: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
  {
    value: "persuratan",
    label: "Persuratan",
    icon: Mail,
    capabilityGate: ["surat_masuk:view", "surat_keluar:view", "disposisi:view"],
  },
  {
    value: "kepegawaian",
    label: "Kepegawaian",
    icon: Users,
    capabilityGate: ["absensi:view", "cuti:view"],
  },
  {
    value: "sertifikat",
    label: "Sertifikat",
    icon: Award,
    capabilityGate: ["sertifikat:view"],
  },
  {
    value: "keuangan",
    label: "Keuangan",
    icon: Banknote,
    capabilityGate: ["keuangan:view"],
  },
  {
    value: "ujian",
    label: "Ujian",
    icon: GraduationCap,
    capabilityGate: ["jadwal_ujian:view"],
  },
  {
    value: "analitik",
    label: "Analitik Persuratan",
    icon: BarChart3,
    capabilityGate: ["surat_masuk:view", "surat_keluar:view", "disposisi:view"],
  },
];

interface DashboardTabsProps {
  ringkasan: React.ReactNode;
  persuratan?: React.ReactNode;
  kepegawaian?: React.ReactNode;
  sertifikat?: React.ReactNode;
  keuangan?: React.ReactNode;
  ujian?: React.ReactNode;
  analitik?: React.ReactNode;
}

function hasAnyCapability(
  userCaps: Capability[],
  required: Capability[],
): boolean {
  return userCaps.some((c) => required.includes(c));
}

export function DashboardTabs({
  ringkasan,
  persuratan,
  kepegawaian,
  sertifikat,
  keuangan,
  ujian,
  analitik,
}: DashboardTabsProps) {
  const { capabilities, isSuperAdmin } = useDashboard();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const contentMap: Record<string, React.ReactNode> = {
    ringkasan,
    persuratan,
    kepegawaian,
    sertifikat,
    keuangan,
    ujian,
    analitik,
  };

  const visibleTabs = ALL_TABS.filter((tab) => {
    const hasContent = tab.value === "ringkasan" || contentMap[tab.value] !== undefined;
    if (!hasContent) return false;
    if (!tab.capabilityGate) return true;
    return isSuperAdmin || hasAnyCapability(capabilities, tab.capabilityGate);
  });

  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab") ?? "ringkasan";
    return visibleTabs.some((t) => t.value === tab) ? tab : (visibleTabs[0]?.value ?? "ringkasan");
  });

  function onTabChange(value: string) {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={onTabChange}
      className="space-y-5 sm:space-y-6"
    >
      <TabsList
        variant="line"
        className="h-auto w-full flex-wrap gap-0 border-b border-border bg-transparent"
      >
        {visibleTabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="gap-2 px-4 py-2.5 text-sm"
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {visibleTabs.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className="space-y-5 sm:space-y-6"
        >
          {contentMap[tab.value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
