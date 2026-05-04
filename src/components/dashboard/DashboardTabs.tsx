"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  LayoutDashboard,
  BarChart3,
  Activity,
  GraduationCap,
} from "lucide-react";

interface DashboardTabsProps {
  ringkasan: React.ReactNode;
  analitik: React.ReactNode;
  aktivitas: React.ReactNode;
  ujian?: React.ReactNode;
}

export function DashboardTabs({
  ringkasan,
  analitik,
  aktivitas,
  ujian,
}: DashboardTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = searchParams.get("tab") ?? "ringkasan";

  function onTabChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`);
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
        <TabsTrigger
          value="ringkasan"
          className="gap-2 px-4 py-2.5 text-sm"
        >
          <LayoutDashboard className="h-4 w-4" />
          Ringkasan
        </TabsTrigger>
        <TabsTrigger value="analitik" className="gap-2 px-4 py-2.5 text-sm">
          <BarChart3 className="h-4 w-4" />
          Analitik
        </TabsTrigger>
        <TabsTrigger value="aktivitas" className="gap-2 px-4 py-2.5 text-sm">
          <Activity className="h-4 w-4" />
          Aktivitas
        </TabsTrigger>
        {ujian && (
          <TabsTrigger value="ujian" className="gap-2 px-4 py-2.5 text-sm">
            <GraduationCap className="h-4 w-4" />
            Ujian
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="ringkasan" className="space-y-5 sm:space-y-6">
        {ringkasan}
      </TabsContent>
      <TabsContent value="analitik" className="space-y-5 sm:space-y-6">
        {analitik}
      </TabsContent>
      <TabsContent value="aktivitas" className="space-y-5 sm:space-y-6">
        {aktivitas}
      </TabsContent>
      {ujian && (
        <TabsContent value="ujian" className="space-y-5 sm:space-y-6">
          {ujian}
        </TabsContent>
      )}
    </Tabs>
  );
}
