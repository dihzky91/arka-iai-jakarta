"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignInstructorToBlock,
  getInstructorRecommendationsForBlock,
  type InstructorRecommendation,
} from "@/server/actions/jadwal-otomatis/assignments";
import type { Assignment, Instructor, Session } from "./types";
import { toExpertiseLabel } from "./types";

interface AssignInstrukturSectionProps {
  kelasId: string;
  programId: string;
  sessions: Session[];
  assignments: Assignment[];
  instructors: Instructor[];
  sessionBlocks: string[];
}

export function AssignInstrukturSection({
  kelasId,
  programId,
  sessions,
  assignments,
  instructors,
  sessionBlocks,
}: AssignInstrukturSectionProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [assignBlock, setAssignBlock] = useState("");
  const [assignInstructor, setAssignInstructor] = useState("");
  const [recommendations, setRecommendations] = useState<InstructorRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  useEffect(() => {
    if (!assignBlock) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;
    setLoadingRecommendations(true);
    setRecommendations([]);

    void getInstructorRecommendationsForBlock({
      kelasId,
      programId,
      materiBlock: assignBlock,
    })
      .then((rows) => {
        if (cancelled) return;
        setRecommendations(rows);
        const firstRecommendation = rows[0];
        if (
          firstRecommendation &&
          !rows.some((row) => row.instructorId === assignInstructor)
        ) {
          setAssignInstructor(firstRecommendation.instructorId);
        }
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Gagal memuat rekomendasi instruktur.");
      })
      .finally(() => {
        if (!cancelled) setLoadingRecommendations(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assignBlock, assignInstructor, kelasId, programId]);

  const orderedInstructors = useMemo(() => {
    const recommendationRank = new Map(
      recommendations.map((recommendation, index) => [recommendation.instructorId, index]),
    );
    return [...instructors]
      .filter((instructor) => instructor.isActive)
      .sort((a, b) => {
        const rankA = recommendationRank.get(a.id);
        const rankB = recommendationRank.get(b.id);
        if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
        if (rankA !== undefined) return -1;
        if (rankB !== undefined) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [instructors, recommendations]);

  const availableInstructors = useMemo(() => {
    if (!assignBlock || loadingRecommendations || recommendations.length === 0) return [];
    const recommendedIds = new Set(recommendations.map((r) => r.instructorId));
    return orderedInstructors.filter((i) => recommendedIds.has(i.id));
  }, [orderedInstructors, recommendations, assignBlock, loadingRecommendations]);

  function handleAssign() {
    if (!assignBlock || !assignInstructor) {
      toast.error("Pilih blok materi dan instruktur");
      return;
    }

    // Check if this block already has an instructor assigned
    const existingAssignments = assignments.filter(
      (a) => a.materiName === assignBlock,
    );
    if (existingAssignments.length > 0) {
      const existingInstructor = existingAssignments[0]?.plannedInstructorName;
      const isSameInstructor = existingAssignments[0]?.plannedInstructorId === assignInstructor;

      if (isSameInstructor) {
        toast.warning(
          `"${assignBlock}" sudah ditugaskan ke ${existingInstructor} (${existingAssignments.length} sesi). Tidak ada sesi baru untuk di-assign.`,
        );
        return;
      }

      const totalSessionsForBlock = sessions.filter(
        (s) => s.materiName === assignBlock && !s.isExamDay,
      ).length;
      const unassignedCount = totalSessionsForBlock - existingAssignments.length;

      if (unassignedCount <= 0) {
        toast.warning(
          `Semua sesi "${assignBlock}" sudah ditugaskan ke ${existingInstructor}. Tidak ada sesi tersisa untuk di-assign.`,
        );
        return;
      }

      toast.info(
        `"${assignBlock}" sudah punya ${existingAssignments.length} sesi ditugaskan ke ${existingInstructor}. Akan assign ${unassignedCount} sesi tersisa.`,
      );
    }

    start(async () => {
      const result = await assignInstructorToBlock(kelasId, assignInstructor, assignBlock);
      if (result.ok) {
        if (result.assignedCount === 0) {
          toast.warning("Tidak ada sesi baru yang bisa di-assign. Semua sesi sudah memiliki instruktur.");
        } else {
          toast.success(`${result.assignedCount} sesi berhasil di-assign.`);
        }
        setAssignBlock("");
        setAssignInstructor("");
        setRecommendations([]);
        router.refresh();
      } else {
        toast.error(result.error ?? "Gagal meng-assign instruktur.");
      }
    });
  }

  return (
    <Card className="rounded-[24px]">
      <CardHeader className="border-b border-border/60">
        <CardTitle>Assign Instruktur</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <Select value={assignBlock} onValueChange={setAssignBlock}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih blok materi" />
              </SelectTrigger>
              <SelectContent>
                {sessionBlocks.map((blockName) => (
                  <SelectItem key={blockName} value={blockName}>
                    {blockName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select
              value={assignInstructor}
              onValueChange={setAssignInstructor}
              disabled={!!assignBlock && (loadingRecommendations || availableInstructors.length === 0)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !assignBlock
                      ? "Pilih blok materi terlebih dahulu"
                      : loadingRecommendations
                        ? "Memuat rekomendasi..."
                        : availableInstructors.length === 0
                          ? "Tidak ada instruktur dengan keahlian"
                          : "Pilih instruktur"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableInstructors.map((instructor) => (
                  <SelectItem key={instructor.id} value={instructor.id}>
                    {instructor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssign} disabled={pending}>
            <UserCheck className="h-4 w-4 mr-1" />
            Assign
          </Button>
        </div>

        {assignBlock ? (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="border-b border-border/60 px-4 py-2 bg-muted/30">
              <p className="text-sm font-medium">Rekomendasi Sistem</p>
              <p className="text-xs text-muted-foreground">
                Bobot: keahlian 50%, beban mingguan 25%, histori 15%, rotasi 10%.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Instruktur</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Skor</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Beban 7 Hari</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Kelas Aktif</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Histori Sejenis</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {loadingRecommendations ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-center text-muted-foreground">
                        Memuat rekomendasi...
                      </td>
                    </tr>
                  ) : recommendations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-4">
                        <EmptyState icon={UserCheck} title="Tidak ada rekomendasi" description="Belum ada instruktur yang cocok untuk blok materi ini berdasarkan bobot rekomendasi saat ini." className="min-h-32" />
                      </td>
                    </tr>
                  ) : (
                    recommendations.map((recommendation) => (
                      <tr
                        key={recommendation.instructorId}
                        className="border-b border-border/60 transition-colors hover:bg-muted/40"
                      >
                        <td className="px-4 py-2">
                          <p className="font-medium">{recommendation.instructorName}</p>
                          <p className="text-xs text-muted-foreground">
                            Level: {toExpertiseLabel(recommendation.expertiseLevel)}
                          </p>
                        </td>
                        <td className="px-4 py-2 tabular-nums">{recommendation.score}</td>
                        <td className="px-4 py-2 tabular-nums">{recommendation.weeklySessions} sesi</td>
                        <td className="px-4 py-2">
                          <p>{recommendation.activeClassCount} kelas</p>
                          <p className="text-xs text-muted-foreground">
                            {recommendation.activeClassNames.slice(0, 2).join(", ") || "-"}
                          </p>
                        </td>
                        <td className="px-4 py-2 tabular-nums">
                          {recommendation.similarExperienceCount} sesi
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline">Perlu Konfirmasi WA</Badge>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAssignInstructor(recommendation.instructorId)}
                          >
                            Pilih
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
