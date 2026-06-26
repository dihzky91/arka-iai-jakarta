"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
  createClassType,
  updateClassType,
} from "@/server/actions/jadwal-otomatis/classTypes";
import { useRouter } from "next/navigation";
import type { ClassTypeRow } from "./MasterDataTypes";

interface MasterDataClassTypesTabProps {
  classTypes: ClassTypeRow[];
  canManage: boolean;
}

export function MasterDataClassTypesTab({ classTypes, canManage }: MasterDataClassTypesTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  return (
    <>
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
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
            <EmptyState icon={Plus} title="Belum ada tipe kelas" description="Konfigurasi tipe kelas akan tampil di sini setelah dibuat." />
          ) : (
            <div className="space-y-3">
              {classTypes.map((ct) => (
                <div
                  key={ct.id}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/35"
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
