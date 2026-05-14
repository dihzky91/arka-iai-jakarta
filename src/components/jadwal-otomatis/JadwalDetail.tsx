"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Download, FileCheck, Trash2, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  bulkUpdateAssignmentAvailabilityStatus,
  bulkUpdateSessionStatus,
  getInstructorRecommendationsForBlock,
  updateAssignmentAvailabilityStatus,
  unassignInstructorFromSession,
  bulkUnassignInstructors,
  type InstructorRecommendation,
} from "@/server/actions/jadwal-otomatis/assignments";
import { WhatsAppClassActions } from "@/components/jadwal-otomatis/WhatsAppClassActions";
import { cn } from "@/lib/utils";
import type {
  KelasDetail,
  Session,
  Assignment,
  Instructor,
  JadwalDetailProps,
  AvailabilityStatus,
  BulkSessionStatus,
} from "./jadwal-detail/types";
import {
  STATUS_COLORS,
  availabilityStatusLabels,
  formatDate,
  getDayName,
  toAvailabilityStatus,
  toExpertiseLabel,
} from "./jadwal-detail/types";

const availabilityStatusClass: Record<AvailabilityStatus, string> = {
  pending_wa_confirmation:
    "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 focus:ring-amber-200 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300",
  accepted:
    "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 focus:ring-emerald-200 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300",
  rejected:
    "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 focus:ring-rose-200 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300",
  no_response:
    "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
};

const sessionStatusLabels: Record<string, string> = {
  scheduled: "Terjadwal",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  makeup: "Pengganti",
};

const sessionStatusClass: Record<string, string> = {
  scheduled: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/70 dark:bg-blue-950/30 dark:text-blue-300",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300",
  cancelled: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-300",
  makeup: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800/70 dark:bg-violet-950/30 dark:text-violet-300",
};

export function JadwalDetail({
  kelas,
  sessions,
  assignments,
  instructors,
  materiBlocks,
  canManage,
  honorariumSnapshot,
  whatsappTemplates,
  whatsappLogs,
  whatsappBotEnabled,
  mode = "full",
}: JadwalDetailProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [exportPending, startExport] = useTransition();
  const [assignBlock, setAssignBlock] = useState("");
  const [assignInstructor, setAssignInstructor] = useState("");
  const [recommendations, setRecommendations] = useState<InstructorRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [unassignPending, startUnassign] = useTransition();
  const [bulkAvailabilityStatus, setBulkAvailabilityStatus] = useState<"" | AvailabilityStatus>("");
  const [bulkStatusPending, startBulkStatus] = useTransition();
  const [bulkSessionStatus, setBulkSessionStatus] = useState<"" | BulkSessionStatus>("");
  const [bulkSessionPending, startBulkSession] = useTransition();

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
    [sessions],
  );

  const sessionCount = sortedSessions.filter((session) => !session.isExamDay).length;
  const examCount = sortedSessions.filter((session) => session.isExamDay).length;

  const assignBySession = useMemo(() => {
    const mapping = new Map<string, Assignment>();
    for (const assignment of assignments) mapping.set(assignment.sessionId, assignment);
    return mapping;
  }, [assignments]);

  const sessionBlocks = useMemo(() => {
    const blocks = new Set<string>(materiBlocks);
    for (const session of sortedSessions) {
      if (session.materiName && !session.isExamDay) blocks.add(session.materiName);
    }
    return [...blocks];
  }, [sortedSessions, materiBlocks]);

  useEffect(() => {
    if (!assignBlock) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;
    setLoadingRecommendations(true);
    setRecommendations([]);

    void getInstructorRecommendationsForBlock({
      kelasId: kelas.id,
      programId: kelas.programId,
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
  }, [assignBlock, assignInstructor, kelas.id, kelas.programId]);

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

    start(async () => {
      const result = await assignInstructorToBlock(kelas.id, assignInstructor, assignBlock);
      if (result.ok) {
        toast.success(`${result.assignedCount} sesi di-assign ke instruktur.`);
        setAssignBlock("");
        setAssignInstructor("");
        setRecommendations([]);
        router.refresh();
      } else {
        toast.error(result.error ?? "Gagal meng-assign instruktur.");
      }
    });
  }

  function handleAvailabilityStatusUpdate(
    assignmentId: string,
    availabilityStatus: AvailabilityStatus,
  ) {
    start(async () => {
      const result = await updateAssignmentAvailabilityStatus({
        assignmentId,
        availabilityStatus,
      });
      if (!result.ok) {
        toast.error("Gagal memperbarui status WA.");
        return;
      }
      toast.success("Status WA instruktur diperbarui.");
      router.refresh();
    });
  }

  function handleUnassign(assignmentId: string) {
    if (!confirm("Hapus penugasan instruktur dari sesi ini?")) return;

    startUnassign(async () => {
      const result = await unassignInstructorFromSession(assignmentId);
      if (!result.ok) {
        toast.error(result.error ?? "Gagal menghapus penugasan.");
        return;
      }
      toast.success("Penugasan dihapus.");
      setSelectedAssignments((prev) => {
        const next = new Set(prev);
        next.delete(assignmentId);
        return next;
      });
      router.refresh();
    });
  }

  function handleBulkUnassign() {
    if (selectedAssignments.size === 0) {
      toast.error("Pilih sesi yang ingin dihapus penugasannya.");
      return;
    }

    if (!confirm(`Hapus ${selectedAssignments.size} penugasan instruktur?`)) return;

    startUnassign(async () => {
      try {
        const result = await bulkUnassignInstructors({
          assignmentIds: Array.from(selectedAssignments),
        });
        if (result.blockedCount > 0) {
          toast.info(
            `${result.deletedCount} penugasan dihapus, ${result.blockedCount} tidak bisa dihapus karena sudah masuk honorarium.`,
          );
        } else {
          toast.success(`${result.deletedCount} penugasan dihapus.`);
        }
        setSelectedAssignments(new Set());
        router.refresh();
      } catch {
        toast.error("Gagal menghapus penugasan.");
      }
    });
  }

  function handleBulkAvailabilityUpdate() {
    if (selectedAssignments.size === 0) {
      toast.error("Pilih sesi yang ingin diubah status WA-nya.");
      return;
    }
    if (!bulkAvailabilityStatus) {
      toast.error("Pilih status WA tujuan terlebih dahulu.");
      return;
    }

    startBulkStatus(async () => {
      const result = await bulkUpdateAssignmentAvailabilityStatus({
        assignmentIds: Array.from(selectedAssignments),
        availabilityStatus: bulkAvailabilityStatus,
      });

      if (!result.ok) {
        toast.error("Gagal memperbarui status WA secara bulk.");
        return;
      }

      toast.success(`${result.updatedCount} status WA berhasil diperbarui.`);
      setBulkAvailabilityStatus("");
      router.refresh();
    });
  }

  function handleBulkSessionStatusUpdate() {
    if (selectedAssignments.size === 0) {
      toast.error("Pilih sesi yang ingin diubah status sesinya.");
      return;
    }
    if (!bulkSessionStatus) {
      toast.error("Pilih status sesi tujuan terlebih dahulu.");
      return;
    }

    startBulkSession(async () => {
      const result = await bulkUpdateSessionStatus({
        assignmentIds: Array.from(selectedAssignments),
        sessionStatus: bulkSessionStatus,
      });

      if (!result.ok) {
        toast.error("Gagal memperbarui status sesi secara bulk.");
        return;
      }

      toast.success(`${result.updatedCount} status sesi berhasil diperbarui.`);
      setBulkSessionStatus("");
      router.refresh();
    });
  }

  function toggleSelectAssignment(assignmentId: string) {
    setSelectedAssignments((prev) => {
      const next = new Set(prev);
      if (next.has(assignmentId)) {
        next.delete(assignmentId);
      } else {
        next.add(assignmentId);
      }
      return next;
    });
  }

  const allSelectableIds = useMemo(() => {
    const ids: string[] = [];
    for (const session of sortedSessions) {
      const assignment = assignBySession.get(session.id);
      if (assignment) ids.push(assignment.assignmentId);
    }
    return ids;
  }, [sortedSessions, assignBySession]);

  const allSelected = useMemo(
    () =>
      allSelectableIds.length > 0 &&
      allSelectableIds.every((id) => selectedAssignments.has(id)),
    [allSelectableIds, selectedAssignments],
  );

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedAssignments(new Set());
    } else {
      setSelectedAssignments(new Set(allSelectableIds));
    }
  }

  function handleExportPdf() {
    startExport(async () => {
      if (sortedSessions.length === 0) {
        toast.info("Belum ada jadwal untuk diekspor.");
        return;
      }

      try {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");

        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        doc.setFontSize(14);
        doc.text(`JADWAL KELAS - ${kelas.namaKelas}`, 14, 14);
        doc.setFontSize(9);
        doc.text(`Program: ${kelas.programName} | Tipe: ${kelas.classTypeName}`, 14, 20);
        doc.text(`Periode: ${kelas.startDate} s.d. ${kelas.endDate ?? "-"}`, 14, 25);

        autoTable(doc, {
          startY: 30,
          head: [
            [
              "Tanggal",
              "Hari",
              "Jam",
              "Tipe",
              "Materi/Ujian",
              "Instruktur",
              "Status WA",
              "Status Sesi",
            ],
          ],
          body: sortedSessions.map((session) => {
            const assignment = assignBySession.get(session.id);
            const instructorName = assignment?.actualInstructorId
              ? instructors.find((instructor) => instructor.id === assignment.actualInstructorId)?.name ??
                assignment.plannedInstructorName
              : assignment?.plannedInstructorName;

            return [
              session.scheduledDate,
              getDayName(session.scheduledDate),
              `${session.timeSlotStart} - ${session.timeSlotEnd}`,
              session.isExamDay ? "Ujian" : `Sesi ${session.sessionNumber}`,
              session.isExamDay
                ? session.examSubjects?.join(", ") ?? "Ujian"
                : session.materiName ?? `Sesi ${session.sessionNumber}`,
              instructorName ?? "-",
              assignment
                ? availabilityStatusLabels[toAvailabilityStatus(assignment.availabilityStatus)]
                : "-",
              session.status,
            ];
          }),
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
          columnStyles: {
            0: { cellWidth: 23 },
            1: { cellWidth: 20 },
            2: { cellWidth: 22 },
            3: { cellWidth: 22 },
            4: { cellWidth: 64 },
            5: { cellWidth: 40 },
            6: { cellWidth: 28 },
            7: { cellWidth: 20 },
          },
        });

        const safeName = kelas.namaKelas.replace(/[\\/:*?"<>|]/g, "-").toLowerCase();
        doc.save(`jadwal-${safeName}.pdf`);
        toast.success("Jadwal berhasil diekspor ke PDF.");
      } catch {
        toast.error("Gagal mengekspor jadwal ke PDF.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {(mode === "full" || mode === "informasi") && (
        <>
          <Card className="rounded-[28px]">
            <CardHeader className="border-b border-border/60">
              <CardTitle>Informasi Kelas</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Program</p>
                  <p className="font-medium">{kelas.programName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipe Kelas</p>
                  <p className="font-medium">{kelas.classTypeName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal Mulai</p>
                  <p className="font-medium">{formatDate(kelas.startDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal Selesai</p>
                  <p className="font-medium">{kelas.endDate ? formatDate(kelas.endDate) : "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Metode</p>
                  <Badge variant={kelas.mode === "online" ? "secondary" : "default"}>
                    {kelas.mode === "online" ? "Online" : "Offline"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lokasi</p>
                  <p className="font-medium">{kelas.lokasi ?? "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={STATUS_COLORS[kelas.status] ?? "outline"}>{kelas.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sesi</p>
                  <p className="font-medium">{sessionCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Ujian</p>
                  <p className="font-medium">{examCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <WhatsAppClassActions
            kelas={kelas}
            sessions={sessions}
            assignments={assignments}
            instructors={instructors}
            honorariumSnapshot={honorariumSnapshot}
            canManage={canManage}
            templates={whatsappTemplates}
            logs={whatsappLogs}
            whatsappBotEnabled={whatsappBotEnabled}
          />
        </>
      )}

      {(mode === "full" || mode === "instruktur") && canManage ? (
        <Card className="rounded-[28px]">
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
      ) : null}

      {(mode === "full" || mode === "jadwal") && (
        <Card className="rounded-[28px]">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between">
              <CardTitle>Jadwal Kelas</CardTitle>
              <Button variant="outline" onClick={handleExportPdf} disabled={exportPending} size="sm">
                <Download className="h-4 w-4 mr-1" />
                {exportPending ? "Mengekspor..." : "Export PDF"}
              </Button>
            </div>
          </CardHeader>
        <CardContent className="pt-6 p-0">
          <div className="overflow-x-auto">
              <div className="flex items-center gap-2 px-6 py-2 border-b border-border/60">
                {allSelectableIds.length > 0 && canManage ? (
                  <>
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Pilih semua"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedAssignments.size > 0
                        ? `${selectedAssignments.size} terpilih`
                        : "Pilih sesi"}
                    </span>
                    {selectedAssignments.size > 0 ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={bulkAvailabilityStatus}
                          onValueChange={(value) => setBulkAvailabilityStatus(value as AvailabilityStatus)}
                          disabled={bulkStatusPending}
                        >
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue placeholder="Ubah Status WA..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending_wa_confirmation">Menunggu WA</SelectItem>
                            <SelectItem value="accepted">Diterima</SelectItem>
                            <SelectItem value="rejected">Ditolak</SelectItem>
                            <SelectItem value="no_response">No Response</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={handleBulkAvailabilityUpdate}
                          disabled={bulkStatusPending}
                        >
                          {bulkStatusPending ? "Menyimpan..." : "Simpan Status"}
                        </Button>
                        <Select
                          value={bulkSessionStatus}
                          onValueChange={(value) => setBulkSessionStatus(value as BulkSessionStatus)}
                          disabled={bulkSessionPending}
                        >
                          <SelectTrigger className="h-8 w-[170px]">
                            <SelectValue placeholder="Ubah Status Sesi..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">scheduled</SelectItem>
                            <SelectItem value="completed">completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleBulkSessionStatusUpdate}
                          disabled={bulkSessionPending}
                        >
                          {bulkSessionPending ? "Menyimpan..." : "Simpan Sesi"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBulkUnassign}
                          disabled={unassignPending}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Hapus Terpilih
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground w-10">
                      {allSelectableIds.length > 0 && canManage ? (
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Pilih semua"
                        />
                      ) : null}
                    </th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Tanggal</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Hari</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Jam</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Tipe</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Materi / Ujian</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Instruktur</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status WA</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status Sesi</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground w-16">Aksi</th>
                  </tr>
                </thead>
              <tbody>
                {sortedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-8">
                      <EmptyState icon={BookOpen} title="Belum ada jadwal" description="Sesi kelas akan tampil di sini setelah jadwal dibuat untuk kelas ini." />
                    </td>
                  </tr>
                ) : (
                  sortedSessions.map((session, index) => {
                    const assignment = assignBySession.get(session.id);
                    const instructorName = assignment?.actualInstructorId
                      ? instructors.find((instructor) => instructor.id === assignment.actualInstructorId)
                          ?.name ?? assignment.plannedInstructorName
                      : assignment?.plannedInstructorName;

                    return (
                      <tr
                        key={session.id}
                        className="border-b border-border/60 transition-colors hover:bg-muted/40"
                      >
                        <td className="px-6 py-3">
                          {assignment && canManage ? (
                            <Checkbox
                              checked={selectedAssignments.has(assignment.assignmentId)}
                              onCheckedChange={() => toggleSelectAssignment(assignment.assignmentId)}
                              aria-label="Pilih sesi"
                            />
                          ) : null}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground tabular-nums">{index + 1}</td>
                        <td className="px-6 py-3 tabular-nums">{session.scheduledDate}</td>
                        <td className="px-6 py-3 text-muted-foreground">{getDayName(session.scheduledDate)}</td>
                        <td className="px-6 py-3 tabular-nums">
                          {session.timeSlotStart} - {session.timeSlotEnd}
                        </td>
                        <td className="px-6 py-3">
                          {session.isExamDay ? (
                            <Badge variant="outline" className="border-amber-300 text-amber-700">
                              <FileCheck className="h-3 w-3 mr-1" />
                              Ujian
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <BookOpen className="h-3 w-3 mr-1" />
                              Sesi {session.sessionNumber}
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {session.isExamDay
                            ? session.examSubjects?.join(", ") ?? "Ujian"
                            : session.materiName ?? `Sesi ${session.sessionNumber}`}
                        </td>
                        <td className="px-6 py-3">
                          {instructorName ? (
                            <span className="text-sm">{instructorName}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {assignment ? (
                            canManage ? (
                              <Select
                                value={toAvailabilityStatus(assignment.availabilityStatus)}
                                onValueChange={(value) =>
                                  handleAvailabilityStatusUpdate(
                                    assignment.assignmentId,
                                    value as AvailabilityStatus,
                                  )
                                }
                              >
                                <SelectTrigger
                                  className={cn(
                                    "h-8 w-[170px] font-medium shadow-none [&>span]:truncate",
                                    availabilityStatusClass[
                                      toAvailabilityStatus(assignment.availabilityStatus)
                                    ],
                                  )}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending_wa_confirmation">Menunggu WA</SelectItem>
                                  <SelectItem value="accepted">Diterima</SelectItem>
                                  <SelectItem value="rejected">Ditolak</SelectItem>
                                  <SelectItem value="no_response">No Response</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-medium",
                                  availabilityStatusClass[
                                    toAvailabilityStatus(assignment.availabilityStatus)
                                  ],
                                )}
                              >
                                {
                                  availabilityStatusLabels[
                                    toAvailabilityStatus(assignment.availabilityStatus)
                                  ]
                                }
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-medium",
                              sessionStatusClass[session.status] ??
                                "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
                            )}
                          >
                            {sessionStatusLabels[session.status] ?? session.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-3">
                          {assignment && canManage ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleUnassign(assignment.assignmentId)}
                              disabled={unassignPending}
                              title="Hapus penugasan"
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

    </div>
  );
}
