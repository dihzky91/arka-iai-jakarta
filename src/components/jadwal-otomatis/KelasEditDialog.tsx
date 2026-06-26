"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  updateKelasOtomatisStartDate,
  updateKelasOtomatisMetadata,
  updateKelasFinanceContactOverride,
  listExcludedDatesByKelas,
  addExcludedDateToKelas,
  removeExcludedDateFromKelas,
  type KelasOtomatisRow,
} from "@/server/actions/jadwal-otomatis/kelasOtomatis";

interface KelasEditDialogProps {
  kelas: KelasOtomatisRow | null;
  onClose: () => void;
}

export function KelasEditDialog({ kelas, onClose }: KelasEditDialogProps) {
  const router = useRouter();
  const [isSavingEdit, startEditTransition] = useTransition();
  const [isExcludedDatePending, startExcludedDateTransition] = useTransition();

  // Start date tab state
  const [editStartDate, setEditStartDate] = useState(kelas?.startDate ?? "");
  const [editExclusionStrategy, setEditExclusionStrategy] = useState<"keep" | "shift" | "clear">("keep");

  // Metadata tab state
  const [editNamaKelas, setEditNamaKelas] = useState(kelas?.namaKelas ?? "");
  const [editMode, setEditMode] = useState<"offline" | "online">((kelas?.mode as "offline" | "online") ?? "offline");
  const [editAngkatan, setEditAngkatan] = useState(kelas?.angkatan?.toString() ?? "");
  const [editCertCode, setEditCertCode] = useState(kelas?.certificateClassCode ?? "");
  const [editLokasi, setEditLokasi] = useState(kelas?.lokasi ?? "");

  // Finance tab state
  const [editFinanceName, setEditFinanceName] = useState(kelas?.financeContactNameOverride ?? "");
  const [editFinanceWa, setEditFinanceWa] = useState(kelas?.financeWhatsappNumberOverride ?? "");

  // Excluded dates tab state
  const [excludedDates, setExcludedDates] = useState<Array<{ id: string; date: string; reason: string | null }>>([]);
  const [loadingExcludedDates, setLoadingExcludedDates] = useState(true);
  const [newExcludeDate, setNewExcludeDate] = useState("");
  const [newExcludeReason, setNewExcludeReason] = useState("");

  // Load excluded dates on mount
  useState(() => {
    if (kelas) {
      listExcludedDatesByKelas(kelas.id).then((dates) => {
        setExcludedDates(dates);
        setLoadingExcludedDates(false);
      });
    }
  });

  function handleMetadataSave() {
    if (!kelas) return;
    startEditTransition(async () => {
      const angkatanValue = editAngkatan.trim()
        ? Number.parseInt(editAngkatan, 10)
        : null;
      const result = await updateKelasOtomatisMetadata({
        id: kelas.id,
        namaKelas: editNamaKelas.trim(),
        mode: editMode,
        angkatan: angkatanValue && !Number.isNaN(angkatanValue) ? angkatanValue : null,
        certificateClassCode: editCertCode.trim() || null,
        lokasi: editLokasi.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal memperbarui metadata.");
        return;
      }
      toast.success("Metadata kelas diperbarui.");
      onClose();
      router.refresh();
    });
  }

  function handleStartDateSave() {
    if (!kelas) return;
    if (!editStartDate) {
      toast.error("Tanggal mulai wajib diisi.");
      return;
    }
    startEditTransition(async () => {
      const result = await updateKelasOtomatisStartDate({
        id: kelas.id,
        startDate: editStartDate,
        exclusionStrategy: editExclusionStrategy,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal memperbarui tanggal mulai.");
        return;
      }
      if ("unchanged" in result && result.unchanged) {
        toast.info("Tanggal mulai tidak berubah.");
      } else {
        const strategyLabel =
          editExclusionStrategy === "shift"
            ? "Eksklusi digeser mengikuti tanggal mulai baru."
            : editExclusionStrategy === "clear"
              ? "Eksklusi manual dikosongkan."
              : "Eksklusi tetap pada tanggal aslinya.";
        toast.success(`Tanggal mulai diperbarui. ${strategyLabel}`);
      }
      onClose();
      router.refresh();
    });
  }

  function handleFinanceSave() {
    if (!kelas) return;
    startEditTransition(async () => {
      const result = await updateKelasFinanceContactOverride({
        id: kelas.id,
        financeContactNameOverride: editFinanceName.trim(),
        financeWhatsappNumberOverride: editFinanceWa.trim(),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal memperbarui kontak keuangan.");
        return;
      }
      toast.success("Kontak keuangan diperbarui.");
      onClose();
      router.refresh();
    });
  }

  function handleAddExcludedDate() {
    if (!kelas || !newExcludeDate) return;
    startExcludedDateTransition(async () => {
      const result = await addExcludedDateToKelas({
        kelasId: kelas.id,
        date: newExcludeDate,
        reason: newExcludeReason.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal menambahkan tanggal eksklusi.");
        return;
      }
      toast.success("Tanggal eksklusi ditambahkan dan jadwal diperbarui.");
      setNewExcludeDate("");
      setNewExcludeReason("");
      const dates = await listExcludedDatesByKelas(kelas.id);
      setExcludedDates(dates);
      router.refresh();
    });
  }

  function handleRemoveExcludedDate(date: string) {
    if (!kelas) return;
    startExcludedDateTransition(async () => {
      const result = await removeExcludedDateFromKelas({
        kelasId: kelas.id,
        date,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal menghapus tanggal eksklusi.");
        return;
      }
      toast.success("Tanggal eksklusi dihapus dan jadwal diperbarui.");
      setExcludedDates((prev) => prev.filter((d) => d.date !== date));
      router.refresh();
    });
  }

  return (
    <Dialog
      open={!!kelas}
      onOpenChange={(open) => {
        if (!open && !isSavingEdit) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Kelas</DialogTitle>
          <DialogDescription>
            Ubah informasi kelas{" "}
            <span className="font-medium text-foreground">
              {kelas?.namaKelas}
            </span>
            .
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="metadata" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            <TabsTrigger value="tanggal">Tanggal Mulai</TabsTrigger>
            <TabsTrigger value="keuangan">Kontak Keuangan</TabsTrigger>
            <TabsTrigger value="eksklusi">Eksklusi</TabsTrigger>
          </TabsList>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="edit-nama">Nama Kelas</label>
              <Input id="edit-nama" value={editNamaKelas} onChange={(e) => setEditNamaKelas(e.target.value)} disabled={isSavingEdit} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Metode</label>
              <Select value={editMode} onValueChange={(v) => setEditMode(v as "offline" | "online")} disabled={isSavingEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="edit-angkatan">Angkatan</label>
              <Input id="edit-angkatan" type="number" min={1} max={999} value={editAngkatan} onChange={(e) => setEditAngkatan(e.target.value)} disabled={isSavingEdit} placeholder="Opsional" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="edit-cert">Kode Sertifikat (01-02)</label>
              <Input id="edit-cert" maxLength={2} value={editCertCode} onChange={(e) => setEditCertCode(e.target.value)} disabled={isSavingEdit} placeholder="Opsional, misal: 01" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="edit-lokasi">Lokasi</label>
              <Input id="edit-lokasi" value={editLokasi} onChange={(e) => setEditLokasi(e.target.value)} disabled={isSavingEdit} placeholder="Opsional" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isSavingEdit}>Batal</Button>
              <Button onClick={handleMetadataSave} disabled={isSavingEdit}>{isSavingEdit ? "Menyimpan..." : "Simpan Metadata"}</Button>
            </DialogFooter>
          </TabsContent>

          {/* Start Date Tab */}
          <TabsContent value="tanggal" className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="edit-start-date">Tanggal Mulai Baru</label>
              <Input id="edit-start-date" type="date" value={editStartDate} onChange={(event) => setEditStartDate(event.target.value)} disabled={isSavingEdit} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="edit-exclusion-strategy">Perlakuan Tanggal Eksklusi</label>
              <Select value={editExclusionStrategy} onValueChange={(value) => setEditExclusionStrategy(value as "keep" | "shift" | "clear")} disabled={isSavingEdit}>
                <SelectTrigger id="edit-exclusion-strategy"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Tetap (absolut)</SelectItem>
                  <SelectItem value="shift">Geser mengikuti selisih tanggal mulai</SelectItem>
                  <SelectItem value="clear">Kosongkan eksklusi manual</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {editExclusionStrategy === "keep"
                  ? "Cocok jika eksklusi berupa tanggal tetap (misalnya event/agenda di tanggal tertentu)."
                  : editExclusionStrategy === "shift"
                    ? "Cocok jika eksklusi bersifat relatif terhadap timeline kelas."
                    : "Semua eksklusi manual dihapus, lalu jadwal disusun ulang dari tanggal mulai baru."}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Catatan: jadwal lama dan assignment instruktur akan disusun ulang sesuai tanggal baru.</p>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isSavingEdit}>Batal</Button>
              <Button onClick={handleStartDateSave} disabled={isSavingEdit}>{isSavingEdit ? "Menyimpan..." : "Simpan Tanggal"}</Button>
            </DialogFooter>
          </TabsContent>

          {/* Finance Contact Tab */}
          <TabsContent value="keuangan" className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="edit-finance-name">Nama Kontak Keuangan</label>
              <Input id="edit-finance-name" value={editFinanceName} onChange={(e) => setEditFinanceName(e.target.value)} disabled={isSavingEdit} placeholder="Override nama kontak (opsional)" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="edit-finance-wa">Nomor WhatsApp Keuangan</label>
              <Input id="edit-finance-wa" value={editFinanceWa} onChange={(e) => setEditFinanceWa(e.target.value)} disabled={isSavingEdit} placeholder="Override nomor WA (opsional)" />
            </div>
            <p className="text-xs text-muted-foreground">Kosongkan untuk menggunakan default global.</p>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isSavingEdit}>Batal</Button>
              <Button onClick={handleFinanceSave} disabled={isSavingEdit}>{isSavingEdit ? "Menyimpan..." : "Simpan Kontak"}</Button>
            </DialogFooter>
          </TabsContent>

          {/* Excluded Dates Tab */}
          <TabsContent value="eksklusi" className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tanggal Eksklusi</label>
              <p className="text-xs text-muted-foreground">Tanggal yang dilewati saat generate jadwal. Jadwal akan di-generate ulang otomatis.</p>
            </div>
            <div className="flex gap-2">
              <Input type="date" value={newExcludeDate} onChange={(e) => setNewExcludeDate(e.target.value)} disabled={isExcludedDatePending} className="w-44" />
              <Input
                type="text"
                value={newExcludeReason}
                onChange={(e) => setNewExcludeReason(e.target.value)}
                placeholder="Keterangan (opsional)"
                disabled={isExcludedDatePending}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddExcludedDate(); } }}
              />
              <Button type="button" variant="outline" onClick={handleAddExcludedDate} disabled={isExcludedDatePending || !newExcludeDate}>Tambah</Button>
            </div>
            {loadingExcludedDates ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : excludedDates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {excludedDates.map(({ date, reason }) => (
                  <Badge key={date} variant="secondary" className="gap-1">
                    <Calendar className="h-3 w-3" /> {date}
                    {reason && <span className="text-muted-foreground">· {reason}</span>}
                    <button type="button" onClick={() => handleRemoveExcludedDate(date)} disabled={isExcludedDatePending} className="ml-1 hover:text-destructive">&times;</button>
                  </Badge>
                ))}
              </div>
            ) : (
              <EmptyState icon={Calendar} title="Belum ada tanggal eksklusi" description="Tanggal libur atau pengecualian kelas akan tampil setelah ditambahkan." className="min-h-32" />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isExcludedDatePending}>Tutup</Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
