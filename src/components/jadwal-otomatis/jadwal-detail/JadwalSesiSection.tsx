"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Download, FileCheck, Search, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bulkUpdateAssignmentAvailabilityStatus,
  bulkUpdateSessionStatus,
  updateAssignmentAvailabilityStatus,
  unassignInstructorFromSession,
  bulkUnassignInstructors,
} from "@/server/actions/jadwal-otomatis/assignments";
import { cn } from "@/lib/utils";
import type {
  KelasDetail,
  Session,
  Assignment,
  Instructor,
  AvailabilityStatus,
  BulkSessionStatus,
} from "./types";
import {
  availabilityStatusLabels,
  getDayName,
  toAvailabilityStatus,
} from "./types";

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

interface JadwalSesiSectionProps {
  kelas: KelasDetail;
  sessions: Session[];
  assignments: Assignment[];
  instructors: Instructor[];
  canManage: boolean;
}

export function JadwalSesiSection({
  kelas,
  sessions,
  assignments,
  instructors,
  canManage,
}: JadwalSesiSectionProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [exportPending, startExport] = useTransition();
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [unassignPending, startUnassign] = useTransition();
  const [bulkAvailabilityStatus, setBulkAvailabilityStatus] = useState<"" | AvailabilityStatus>("");
  const [bulkStatusPending, startBulkStatus] = useTransition();
  const [bulkSessionStatus, setBulkSessionStatus] = useState<"" | BulkSessionStatus>("");
  const [bulkSessionPending, startBulkSession] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
    [sessions],
  );

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sortedSessions;
    const q = searchQuery.trim().toLowerCase();
    return sortedSessions.filter((session) => {
      const materi = session.isExamDay
        ? session.examSubjects?.join(", ") ?? "Ujian"
        : session.materiName ?? "";
      return materi.toLowerCase().includes(q);
    });
  }, [sortedSessions, searchQuery]);

  const assignBySession = useMemo(() => {
    const mapping = new Map<string, Assignment>();
    for (const assignment of assignments) mapping.set(assignment.sessionId, assignment);
    return mapping;
  }, [assignments]);

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
    for (const session of filteredSessions) {
      const assignment = assignBySession.get(session.id);
      if (assignment) ids.push(assignment.assignmentId);
    }
    return ids;
  }, [filteredSessions, assignBySession]);

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
    <Card className="rounded-[24px]">
      <CardHeader className="border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Jadwal Kelas</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari materi..."
                className="pl-8 h-9 w-[200px]"
              />
            </div>
            <Button variant="outline" onClick={handleExportPdf} disabled={exportPending} size="sm">
              <Download className="h-4 w-4 mr-1" />
              {exportPending ? "Mengekspor..." : "Export PDF"}
            </Button>
          </div>
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
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8">
                    <EmptyState icon={BookOpen} title={searchQuery ? "Tidak ditemukan" : "Belum ada jadwal"} description={searchQuery ? `Tidak ada sesi dengan materi "${searchQuery}".` : "Sesi kelas akan tampil di sini setelah jadwal dibuat untuk kelas ini."} />
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session, index) => {
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
  );
}
