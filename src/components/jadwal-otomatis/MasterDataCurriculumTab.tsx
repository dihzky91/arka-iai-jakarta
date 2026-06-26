"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Save, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getCurriculumByProgram,
  upsertCurriculumTemplate,
  upsertCurriculumExamPoints,
} from "@/server/actions/jadwal-otomatis/curriculum";
import { useRouter } from "next/navigation";
import type { ProgramRow, TemplateItem, ExamPointItem } from "./MasterDataTypes";

interface MasterDataCurriculumTabProps {
  programs: ProgramRow[];
  canManage: boolean;
}

export function MasterDataCurriculumTab({ programs, canManage }: MasterDataCurriculumTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [examPointItems, setExamPointItems] = useState<ExamPointItem[]>([]);

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
    <Card className="rounded-[24px]">
      <CardHeader className="border-b border-border/60">
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
                  <h3 className="text-sm font-medium">Template Sesi</h3>
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
                  <EmptyState icon={Plus} title="Belum ada template sesi" description="Template sesi akan tampil setelah baris kurikulum ditambahkan untuk program ini." />
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
                  <h3 className="text-sm font-medium">Titik Ujian</h3>
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
                  <EmptyState icon={Plus} title="Belum ada titik ujian" description="Titik ujian akan tampil setelah aturan ujian ditambahkan untuk kurikulum program ini." />
                ) : (
                  <div className="space-y-2">
                    {examPointItems.map((item, index) => (
                      <div key={item.id} className="rounded-xl border border-border/60 p-3 space-y-2 transition-colors hover:bg-muted/25">
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
  );
}
