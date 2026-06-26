"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createProgram,
  updateProgram,
  archiveProgram,
} from "@/server/actions/jadwal-otomatis/programs";
import { useRouter } from "next/navigation";
import type { ProgramRow } from "./MasterDataTypes";

interface MasterDataProgramsTabProps {
  programs: ProgramRow[];
  canManage: boolean;
}

export function MasterDataProgramsTab({ programs, canManage }: MasterDataProgramsTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramRow | null>(null);
  const [programForm, setProgramForm] = useState({
    code: "",
    name: "",
    totalSessions: "",
    totalMeetings: "",
  });

  function openCreateProgram() {
    setEditingProgram(null);
    setProgramForm({ code: "", name: "", totalSessions: "", totalMeetings: "" });
    setProgramDialogOpen(true);
  }

  function openEditProgram(program: ProgramRow) {
    setEditingProgram(program);
    setProgramForm({
      code: program.code,
      name: program.name,
      totalSessions: program.totalSessions.toString(),
      totalMeetings: program.totalMeetings.toString(),
    });
    setProgramDialogOpen(true);
  }

  function handleSaveProgram() {
    startTransition(async () => {
      const totalSessions = Number.parseInt(programForm.totalSessions, 10);
      const totalMeetings = Number.parseInt(programForm.totalMeetings, 10);

      if (Number.isNaN(totalSessions) || totalSessions < 1) {
        toast.error("Total sesi harus angka positif.");
        return;
      }
      if (Number.isNaN(totalMeetings) || totalMeetings < 1) {
        toast.error("Total pertemuan harus angka positif.");
        return;
      }

      const payload = {
        code: programForm.code.trim(),
        name: programForm.name.trim(),
        totalSessions,
        totalMeetings,
      };

      const result = editingProgram
        ? await updateProgram({ ...payload, id: editingProgram.id })
        : await createProgram(payload);

      if (!result.ok) {
        toast.error(result.error ?? "Gagal menyimpan program.");
        return;
      }

      toast.success(editingProgram ? "Program diperbarui." : "Program dibuat.");
      setProgramDialogOpen(false);
      router.refresh();
    });
  }

  function handleArchiveProgram(program: ProgramRow) {
    startTransition(async () => {
      const result = await archiveProgram(program.id);
      if (!result.ok) {
        toast.error(result.error ?? "Gagal mengarsipkan program.");
        return;
      }
      toast.success(
        result.isActive
          ? `Program "${program.name}" diaktifkan kembali.`
          : `Program "${program.name}" diarsipkan.`,
      );
      router.refresh();
    });
  }

  return (
    <>
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Program Pelatihan</CardTitle>
              <CardDescription className="mt-1">
                Daftar program brevet yang tersedia.
              </CardDescription>
            </div>
            {canManage && (
              <Button size="sm" onClick={openCreateProgram}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Program
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {programs.length === 0 ? (
            <EmptyState icon={Plus} title="Belum ada program" description="Program pelatihan akan tampil di sini setelah dibuat." />
          ) : (
            <div className="space-y-3">
              {programs.map((program) => (
                <div
                  key={program.id}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/35"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{program.name}</p>
                      <Badge variant="secondary">{program.code}</Badge>
                      {!program.isActive && (
                        <Badge variant="outline">Arsip</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {program.totalSessions} sesi · {program.totalMeetings} pertemuan
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditProgram(program)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleArchiveProgram(program)}
                        disabled={isPending}
                      >
                        {program.isActive ? (
                          <Archive className="h-4 w-4" />
                        ) : (
                          <ArchiveRestore className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Program Dialog */}
      <Dialog open={programDialogOpen} onOpenChange={setProgramDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProgram ? "Edit Program" : "Tambah Program"}</DialogTitle>
            <DialogDescription>
              {editingProgram ? "Ubah informasi program." : "Buat program pelatihan baru."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Kode Program</label>
              <Input
                value={programForm.code}
                onChange={(e) => setProgramForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="Misal: B1, B2"
                maxLength={20}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Nama Program</label>
              <Input
                value={programForm.name}
                onChange={(e) => setProgramForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Misal: Brevet A+B"
                maxLength={100}
                disabled={isPending}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Total Sesi</label>
                <Input
                  type="number"
                  min={1}
                  value={programForm.totalSessions}
                  onChange={(e) => setProgramForm((f) => ({ ...f, totalSessions: e.target.value }))}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Total Pertemuan</label>
                <Input
                  type="number"
                  min={1}
                  value={programForm.totalMeetings}
                  onChange={(e) => setProgramForm((f) => ({ ...f, totalMeetings: e.target.value }))}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProgramDialogOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button onClick={handleSaveProgram} disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
