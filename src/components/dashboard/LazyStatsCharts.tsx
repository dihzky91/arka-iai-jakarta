"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "@/server/actions/statistics";

const StatsCharts = dynamic(
  () =>
    import("@/components/dashboard/StatsCharts").then((mod) => ({
      default: mod.StatsCharts,
    })),
  {
    loading: () => <ChartsLoading />,
    ssr: false,
  }
);

function ChartsLoading() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[24px] border border-border/60 bg-card p-4 shadow-sm sm:p-6"
        >
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function LazyStatsCharts({ stats }: { stats: DashboardStats }) {
  return <StatsCharts stats={stats} />;
}
