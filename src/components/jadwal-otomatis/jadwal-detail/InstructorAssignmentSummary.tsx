"use client";

import { useMemo } from "react";
import { AlertTriangle, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Assignment, Session } from "./types";
import { toAvailabilityStatus } from "./types";

interface InstructorAssignmentSummaryProps {
  assignments: Assignment[];
  sessions: Session[];
  sessionBlocks: string[];
}

export function InstructorAssignmentSummary({
  assignments,
  sessions,
  sessionBlocks,
}: InstructorAssignmentSummaryProps) {
  // Group assignments by instructor → materiBlock
  const instructorMap = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        totalSessions: number;
        blocks: Map<string, { total: number; accepted: number; pending: number; rejected: number }>;
      }
    >();

    for (const a of assignments) {
      if (!a.materiName) continue;
      let entry = map.get(a.plannedInstructorId);
      if (!entry) {
        entry = { name: a.plannedInstructorName, totalSessions: 0, blocks: new Map() };
        map.set(a.plannedInstructorId, entry);
      }

      entry.totalSessions += 1;

      let blockEntry = entry.blocks.get(a.materiName);
      if (!blockEntry) {
        blockEntry = { total: 0, accepted: 0, pending: 0, rejected: 0 };
        entry.blocks.set(a.materiName, blockEntry);
      }

      blockEntry.total += 1;
      const status = toAvailabilityStatus(a.availabilityStatus);
      if (status === "accepted") blockEntry.accepted += 1;
      else if (status === "rejected") blockEntry.rejected += 1;
      else blockEntry.pending += 1;
    }

    return map;
  }, [assignments]);

  // Find unassigned blocks
  const unassignedBlocks = useMemo(() => {
    const assignedMateri = new Set(assignments.map((a) => a.materiName).filter(Boolean));
    const nonExamSessions = sessions.filter((s) => !s.isExamDay && s.materiName);

    const result: { name: string; sessionCount: number }[] = [];
    for (const blockName of sessionBlocks) {
      if (assignedMateri.has(blockName)) continue;
      const count = nonExamSessions.filter((s) => s.materiName === blockName).length;
      if (count > 0) result.push({ name: blockName, sessionCount: count });
    }
    return result;
  }, [assignments, sessions, sessionBlocks]);

  const hasAssignments = instructorMap.size > 0;
  const hasUnassigned = unassignedBlocks.length > 0;

  if (!hasAssignments && !hasUnassigned) return null;

  return (
    <Card className="rounded-[24px]">
      <CardHeader className="border-b border-border/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Ringkasan Penugasan</CardTitle>
          {hasUnassigned && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              {unassignedBlocks.length} materi belum ditugaskan
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {/* Instructor cards grid */}
        {hasAssignments && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...instructorMap.entries()].map(([id, entry]) => {
              const allAccepted = [...entry.blocks.values()].every((b) => b.accepted === b.total);
              const hasRejected = [...entry.blocks.values()].some((b) => b.rejected > 0);

              return (
                <div
                  key={id}
                  className={cn(
                    "rounded-2xl border p-4 transition-colors",
                    allAccepted
                      ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20"
                      : hasRejected
                        ? "border-rose-200 bg-rose-50/50 dark:border-rose-800/40 dark:bg-rose-950/20"
                        : "border-border bg-muted/30",
                  )}
                >
                  {/* Instructor header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                      allAccepted
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "bg-primary/10 text-primary",
                    )}>
                      {entry.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">{entry.totalSessions} sesi total</p>
                    </div>
                  </div>

                  {/* Materi chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[...entry.blocks.entries()].map(([blockName, stats]) => {
                      const statusColor = stats.accepted === stats.total
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : stats.rejected > 0
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";

                      return (
                        <span
                          key={blockName}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium",
                            statusColor,
                          )}
                        >
                          {blockName}
                          <span className="opacity-60">·</span>
                          <span className="tabular-nums">{stats.total}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Unassigned blocks */}
        {hasUnassigned && (
          <div className={cn("mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-4 dark:border-amber-700/50 dark:bg-amber-950/20", !hasAssignments && "mt-0")}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Belum Ada Instruktur</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unassignedBlocks.map((block) => (
                <span
                  key={block.name}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  {block.name}
                  <span className="opacity-60">·</span>
                  <span className="tabular-nums">{block.sessionCount} sesi</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
