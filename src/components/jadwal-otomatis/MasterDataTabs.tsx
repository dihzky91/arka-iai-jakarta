"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore, Save, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  createClassType,
  updateClassType,
} from "@/server/actions/jadwal-otomatis/classTypes";
import {
  getCurriculumByProgram,
  upsertCurriculumTemplate,
  upsertCurriculumExamPoints,
} from "@/server/actions/jadwal-otomatis/curriculum";
import { useRouter } from "next/navigation";

type ProgramRow = {
  id: string;
  code: string;
  name: string;
  financeContactName: string | null;
  financeWhatsappNumber: string | null;
  totalSessions: number;
  totalMeetings: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ClassTypeRow = {
  id: string;
  code: string;
  name: string;
  activeDays: string;
  slot1Start: string;
  slot1End: string;
  slot2Start: string;
  slot2End: string;
  createdAt: Date;
};

type TemplateItem = {
  id: string;
  programId: string;
  sessionNumber: number;
  materiBlock: string;
  materiName: string;
  slot: number;
};

type ExamPointItem = {
  id: string;
  programId: string;
  afterSessionNumber: number;
  isMixedDay: boolean;
  examSlotCount: number;
  examSubjects: string[];
  hasExam: boolean;
};

interface MasterDataTabsProps {
  programs: ProgramRow[];
  classTypes: ClassTypeRow[];
  canManage: boolean;
}

export function MasterDataTabs({ programs, classTypes, canManage }: MasterDataTabsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Program dialog state
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramRow | null>(null);
  const [programForm, setProgramForm] = useState({
    code: "",
    name: "",
    totalSessions: "",
    totalMeetings: "",
  });

  // Class type dialog state
  const [classTypeDialogOpen, setClassTypeDialogOpen] = useState(false);
  const [editingClassType, setEditingClassType] = useState<ClassTypeRow | null>(null);
  const [classTypeForm, setClassTypeForm] = useState({
    code: "",
    name: "",
    activeDays: "",
    slot1Start: "",
    slot1End: "",
    slot2Start: "",
    slot2End: "",
  });

  // Curriculum state
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [examPointItems, setExamPointItems] = useState<ExamPointItem[]>([]);

  // --- Program handlers ---
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

  // --- Class type handlers ---
  function openCreateClassType() {
    setEditingClassType(null);
    setClassTypeForm({
      code: "",
      name: "",
      activeDays: "",
      slot1Start: "",
      slot1End: "",
      slot2Start: "",
      slot2End: "",
    });
    setClassTypeDialogOpen(true);
  }

  function openEditClassType(ct: ClassTypeRow) {
    setEditingClassType(ct);
    setClassTypeForm({
      code: ct.code,
      name: ct.name,
      activeDays: ct.activeDays,
      slot1Start: ct.slot1Start,
      slot1End: ct.slot1End,
      slot2Start: ct.slot2Start,
      slot2End: ct.slot2End,
    });
    setClassTypeDialogOpen(true);
  }

  function handleSaveClassType() {
    startTransition(async () => {
      const payload = {
        code: classTypeForm.code.trim(),
        name: classTypeForm.name.trim(),
        activeDays: classTypeForm.activeDays.trim(),
        slot1Start: classTypeForm.slot1Start.trim(),
        slot1End: classTypeForm.slot1End.trim(),
        slot2Start: classTypeForm.slot2Start.trim(),
        slot2End: classTypeForm.slot2End.trim(),
      };

      const result = editingClassType
        ? await updateClassType({ ...payload, id: editingClassType.id })
        : await createClassType(payload);

      if (!result.ok) {
        toast.error(result.error ?? "Gagal menyimpan tipe kelas.");
        return;
      }

      toast.success(editingClassType ? "Tipe kelas diperbarui." : "Tipe kelas dibuat.");
      setClassTypeDialogOpen(false);
      router.refresh();
    });
  }

  // --- Curriculum handlers ---
  function handleLoadCurriculum(programId: string) {
    setSelectedProgramId(programId);
    setLoadingCurriculum(true);
    getCurriculumByProgram(programId).then((data) => {
      setTemplateItems(data.template);
      setExamPointItems(data.examPoints);
      setLoadingCurriculum(false);
    });
  }

  function handleAddTemplateRow() {
    const nextSession = templateItems.length > 0
      ? Math.max(...templateItems.map((t) => t.sessionNumber)) + 1
      : 1;
    setTemplateItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, programId: selectedProgramId, sessionNumber: nextSession, materiBlock: "", materiName: "", slot: 1 },
    ]);
  }

  function handleUpdateTemplateRow(index: number, field: string, value: string | number) {
    setTemplateItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function handleRemoveTemplateRow(index: number) {
    setTemplateItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSaveTemplate() {
    if (!selectedProgramId) return;
    startTransition(async () => {
      const invalid = templateItems.find((t) => !t.materiBlock.trim() || !t.materiName.trim());
      if (invalid) {
        toast.error("Semua baris template wajib diisi materi block dan nama materi.");
        return;
      }

      const result = await upsertCurriculumTemplate({
        programId: selectedProgramId,
        items: templateItems.map((t) => ({
          sessionNumber: t.sessionNumber,
          materiBlock: t.materiBlock.trim(),
          materiName: t.materiName.trim(),
          slot: t.slot,
        })),
      });

      if (!result.ok) {
        toast.error(result.error ?? "Gagal menyimpan template kurikulum.");
        return;
      }

      toast.success("Template kurikulum disimpan.");
      router.refresh();
    });
  }

  function handleAddExamPointRow() {
    const nextAfter = examPointItems.length > 0
      ? Math.max(...examPointItems.map((e) => e.afterSessionNumber)) + 1
      : 1;
    setExamPointItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, programId: selectedProgramId, afterSessionNumber: nextAfter, isMixedDay: false, examSlotCount: 1, examSubjects: [""], hasExam: true },
    ]);
  }

  function handleUpdateExamPointRow(index: number, field: string, value: unknown) {
    setExamPointItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function handleRemoveExamPointRow(index: number) {
    setExamPointItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSaveExamPoints() {
    if (!selectedProgramId) return;
    startTransition(async () => {
      const invalid = examPointItems.find((e) => e.examSubjects.some((s) => !s.trim()));
      if (invalid) {
        toast.error("Semua mata ujian wajib diisi.");
        return;
      }

      const result = await upsertCurriculumExamPoints({
        programId: selectedProgramId,
        items: examPointItems.map((e) => ({
          afterSessionNumber: e.afterSessionNumber,
          isMixedDay: e.isMixedDay,
          examSlotCount: e.examSlotCount,
          examSubjects: e.examSubjects.map((s) => s.trim()),
          hasExam: e.hasExam,
        })),
      });

      if (!result.ok) {
        toast.error(result.error ?? "Gagal menyimpan titik ujian.");
        return;
      }

      toast.success("Titik ujian disimpan.");
      router.refresh();
    });
  }

  return (
    <>
      <Tabs defaultValue="programs" className="w-full">
        <TabsList>
          <TabsTrigger value="programs">Program</TabsTrigger>
          <TabsTrigger value="class-types">Tipe Kelas</TabsTrigger>
          <TabsTrigger value="curriculum">Kurikulum</TabsTrigger>
        </TabsList>

        {/* Programs Tab */}
        <TabsContent value="programs" className="space-y-4">
          <Card className="rounded-[28px]">
            <CardHeader className="border-b border-border">
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
                <p className="text-sm text-muted-foreground">Belum ada program.</p>
              ) : (
                <div className="space-y-3">
                  {programs.map((program) => (
                    <div
                      key={program.id}
                      className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 p-4"
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
        </TabsContent>

        {/* Class Types Tab */}
        <TabsContent value="class-types" className="space-y-4">
          <Card className="rounded-[28px]">
            <CardHeader className="border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Tipe Kelas</CardTitle>
                  <CardDescription className="mt-1">
                    Konfigurasi jadwal per tipe kelas (hari aktif, jam sesi).
                  </CardDescription>
                </div>
                {canManage && (
                  <Button size="sm" onClick={openCreateClassType}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Tipe Kelas
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {classTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada tipe kelas.</p>
              ) : (
                <div className="space-y-3">
                  {classTypes.map((ct) => (
                    <div
                      key={ct.id}
                      className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{ct.name}</p>
                          <Badge variant="secondary">{ct.code}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {ct.activeDays} · Slot 1: {ct.slot1Start}-{ct.slot1End} · Slot 2: {ct.slot2Start}-{ct.slot2End}
                        </p>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditClassType(ct)}
                          className="ml-4"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Curriculum Tab */}
        <TabsContent value="curriculum" className="space-y-4">
          <Card className="rounded-[28px]">
            <CardHeader className="border-b border-border">
              <CardTitle>Kurikulum per Program</CardTitle>
              <CardDescription className="mt-1">
                Pilih program untuk melihat dan mengedit template kurikulum serta titik ujian.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2 flex-wrap">
                {programs.filter((p) => p.isActive).map((program) => (
                  <Button
                    key={program.id}
                    variant={selectedProgramId === program.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleLoadCurriculum(program.id)}
                  >
                    {program.name}
                  </Button>
                ))}
              </div>

              {selectedProgramId && (
                loadingCurriculum ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat kurikulum...
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Template Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Template Sesi</h3>
                        {canManage && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={handleAddTemplateRow}>
                              <Plus className="mr-1 h-3 w-3" /> Tambah Baris
                            </Button>
                            <Button size="sm" onClick={handleSaveTemplate} disabled={isPending}>
                              {isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                              Simpan Template
                            </Button>
                          </div>
                        )}
                      </div>
                      {templateItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada template.</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-[60px_1fr_1fr_60px_40px] gap-2 text-xs font-medium text-muted-foreground">
                            <span>Sesi</span>
                            <span>Block</span>
                            <span>Materi</span>
                            <span>Slot</span>
                            <span></span>
                          </div>
                          {templateItems.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-[60px_1fr_1fr_60px_40px] gap-2 items-center">
                              <Input
                                type="number"
                                min={1}
                                value={item.sessionNumber}
                                onChange={(e) => handleUpdateTemplateRow(index, "sessionNumber", Number.parseInt(e.target.value, 10) || 1)}
                                disabled={!canManage}
                                className="h-8 text-sm"
                              />
                              <Input
                                value={item.materiBlock}
                                onChange={(e) => handleUpdateTemplateRow(index, "materiBlock", e.target.value)}
                                disabled={!canManage}
                                placeholder="Block materi"
                                className="h-8 text-sm"
                              />
                              <Input
                                value={item.materiName}
                                onChange={(e) => handleUpdateTemplateRow(index, "materiName", e.target.value)}
                                disabled={!canManage}
                                placeholder="Nama materi"
                                className="h-8 text-sm"
                              />
                              <Input
                                type="number"
                                min={1}
                                max={2}
                                value={item.slot}
                                onChange={(e) => handleUpdateTemplateRow(index, "slot", Number.parseInt(e.target.value, 10) || 1)}
                                disabled={!canManage}
                                className="h-8 text-sm"
                              />
                              {canManage && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleRemoveTemplateRow(index)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Exam Points Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Titik Ujian</h3>
                        {canManage && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={handleAddExamPointRow}>
                              <Plus className="mr-1 h-3 w-3" /> Tambah Baris
                            </Button>
                            <Button size="sm" onClick={handleSaveExamPoints} disabled={isPending}>
                              {isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                              Simpan Titik Ujian
                            </Button>
                          </div>
                        )}
                      </div>
                      {examPointItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada titik ujian.</p>
                      ) : (
                        <div className="space-y-2">
                          {examPointItems.map((item, index) => (
                            <div key={item.id} className="rounded-xl border border-border p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground w-24">
                                  Setelah Sesi
                                </span>
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.afterSessionNumber}
                                  onChange={(e) => handleUpdateExamPointRow(index, "afterSessionNumber", Number.parseInt(e.target.value, 10) || 1)}
                                  disabled={!canManage}
                                  className="h-8 text-sm w-20"
                                />
                                <span className="text-xs font-medium text-muted-foreground ml-2 w-20">
                                  Slot Ujian
                                </span>
                                <Input
                                  type="number"
                                  min={1}
                                  max={2}
                                  value={item.examSlotCount}
                                  onChange={(e) => handleUpdateExamPointRow(index, "examSlotCount", Number.parseInt(e.target.value, 10) || 1)}
                                  disabled={!canManage}
                                  className="h-8 text-sm w-20"
                                />
                                {canManage && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => handleRemoveExamPointRow(index)}
                                    className="ml-auto"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-muted-foreground w-24 pt-2">
                                  Mata Ujian
                                </span>
                                <div className="flex-1 flex flex-wrap gap-1">
                                  {item.examSubjects.map((subject, sIndex) => (
                                    <div key={sIndex} className="flex items-center gap-1">
                                      <Input
                                        value={subject}
                                        onChange={(e) => {
                                          const newSubjects = [...item.examSubjects];
                                          newSubjects[sIndex] = e.target.value;
                                          handleUpdateExamPointRow(index, "examSubjects", newSubjects);
                                        }}
                                        disabled={!canManage}
                                        placeholder={`Ujian ${sIndex + 1}`}
                                        className="h-7 text-xs w-32"
                                      />
                                      {canManage && item.examSubjects.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newSubjects = item.examSubjects.filter((_, i) => i !== sIndex);
                                            handleUpdateExamPointRow(index, "examSubjects", newSubjects);
                                          }}
                                          className="text-muted-foreground hover:text-destructive"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {canManage && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => {
                                        handleUpdateExamPointRow(index, "examSubjects", [...item.examSubjects, ""]);
                                      }}
                                    >
                                      <Plus className="h-3 w-3 mr-1" /> Tambah
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

      {/* Class Type Dialog */}
      <Dialog open={classTypeDialogOpen} onOpenChange={setClassTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClassType ? "Edit Tipe Kelas" : "Tambah Tipe Kelas"}</DialogTitle>
            <DialogDescription>
              {editingClassType ? "Ubah konfigurasi tipe kelas." : "Buat tipe kelas baru."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Kode</label>
                <Input
                  value={classTypeForm.code}
                  onChange={(e) => setClassTypeForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="Misal: weekend_pagi"
                  maxLength={30}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Nama</label>
                <Input
                  value={classTypeForm.name}
                  onChange={(e) => setClassTypeForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Misal: Weekend Pagi"
                  maxLength={100}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Hari Aktif</label>
              <Input
                value={classTypeForm.activeDays}
                onChange={(e) => setClassTypeForm((f) => ({ ...f, activeDays: e.target.value }))}
                placeholder="Misal: Sat,Sun"
                maxLength={100}
                disabled={isPending}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Slot 1 Mulai</label>
                <Input
                  value={classTypeForm.slot1Start}
                  onChange={(e) => setClassTypeForm((f) => ({ ...f, slot1Start: e.target.value }))}
                  placeholder="08:00"
                  maxLength={5}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Slot 1 Selesai</label>
                <Input
                  value={classTypeForm.slot1End}
                  onChange={(e) => setClassTypeForm((f) => ({ ...f, slot1End: e.target.value }))}
                  placeholder="10:00"
                  maxLength={5}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Slot 2 Mulai</label>
                <Input
                  value={classTypeForm.slot2Start}
                  onChange={(e) => setClassTypeForm((f) => ({ ...f, slot2Start: e.target.value }))}
                  placeholder="10:15"
                  maxLength={5}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Slot 2 Selesai</label>
                <Input
                  value={classTypeForm.slot2End}
                  onChange={(e) => setClassTypeForm((f) => ({ ...f, slot2End: e.target.value }))}
                  placeholder="12:15"
                  maxLength={5}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassTypeDialogOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button onClick={handleSaveClassType} disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
