import { Skeleton } from "@/components/ui/skeleton";

function MetricCardSkeleton({ compact = false }: { compact?: boolean }) {
  const p = compact ? "p-3 sm:p-4" : "p-4 sm:p-5";
  return (
    <div className={`rounded-3xl border border-border bg-card shadow-sm ${p}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className={compact ? "h-7 w-14" : "h-8 w-16"} />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className={compact ? "h-9 w-9 rounded-2xl" : "h-11 w-11 rounded-2xl"} />
      </div>
    </div>
  );
}

function SectionSkeleton({ cards, cols }: { cards: number; cols: string }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <div className={`grid gap-4 ${cols}`}>
        {Array.from({ length: cards }).map((_, i) => (
          <MetricCardSkeleton key={i} compact />
        ))}
      </div>
    </div>
  );
}

function ListPanelSkeleton() {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="mt-5 grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-border bg-muted/25 px-4 py-3">
            <div className="flex gap-2">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="ml-auto h-3 w-14" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <Skeleton className="h-7 w-52 sm:h-8" />
        <Skeleton className="h-4 w-72" />
      </header>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-none rounded-t-sm" />
        ))}
      </div>

      {/* Ringkasan content */}
      <div className="space-y-6 sm:space-y-7">
        <SectionSkeleton cards={4} cols="sm:grid-cols-2 xl:grid-cols-4" />
        <SectionSkeleton cards={3} cols="sm:grid-cols-2 xl:grid-cols-3" />
        <div className="grid gap-5 xl:grid-cols-2">
          <ListPanelSkeleton />
          <ListPanelSkeleton />
        </div>
      </div>
    </div>
  );
}
