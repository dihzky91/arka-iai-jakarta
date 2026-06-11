"use client";

import { useMemo, useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  CalendarDays,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  RotateCcw,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  deleteKelasOtomatis,
  updateKelasOtomatisStartDate,
  updateKelasOtomatisStatus,
  updateKelasOtomatisMetadata,
  updateKelasFinanceContactOverride,
  listExcludedDatesByKelas,
  addExcludedDateToKelas,
  removeExcludedDateFromKelas,
  forceRegenerateSchedule,
  type KelasOtomatisRow,
} from "@/server/actions/jadwal-otomatis/kelasOtomatis";

const STATUS_COLORS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  completed: "secondary",
  cancelled: "destructive",
};

interface KelasOtomatisTableProps {
  initialData: KelasOtomatisRow[];
  canManage: boolean;
}

export function KelasOtomatisTable({
  initialData,
  canManage,
}: KelasOtomatisTableProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<KelasOtomatisRow | null>(
    null,
  );
  const [isDeleting, startDeleteTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<KelasOtomatisRow | null>(null);
  const [isSavingEdit, startEditTransition] = useTransition();

  // Start date tab state
  const [editStartDate, setEditStartDate] = useState("");
  const [editExclusionStrategy, setEditExclusionStrategy] = useState<
    "keep" | "shift" | "clear"
  >("keep");

  // Metadata tab state
  const [editNamaKelas, setEditNamaKelas] = useState("");
  const [editMode, setEditMode] = useState<"offline" | "online">("offline");
  const [editAngkatan, setEditAngkatan] = useState("");
  const [editCertCode, setEditCertCode] = useState("");
  const [editLokasi, setEditLokasi] = useState("");

  // Finance tab state
  const [editFinanceName, setEditFinanceName] = useState("");
  const [editFinanceWa, setEditFinanceWa] = useState("");

  // Excluded dates tab state
  const [excludedDates, setExcludedDates] = useState<Array<{ id: string; date: string; reason: string | null }>>([]);
  const [loadingExcludedDates, setLoadingExcludedDates] = useState(false);
  const [newExcludeDate, setNewExcludeDate] = useState("");
  const [newExcludeReason, setNewExcludeReason] = useState("");
  const [isExcludedDatePending, startExcludedDateTransition] = useTransition();

  // Status transition state
  const [statusTarget, setStatusTarget] = useState<KelasOtomatisRow | null>(
    null,
  );
  const [statusAction, setStatusAction] = useState<
    "completed" | "cancelled" | "active" | null
  >(null);
  const [statusReason, setStatusReason] = useState("");
  const [isStatusPending, startStatusTransition] = useTransition();

  function openEditDialog(kelas: KelasOtomatisRow) {
    setEditTarget(kelas);
    setEditStartDate(kelas.startDate);
    setEditExclusionStrategy("keep");
    setEditNamaKelas(kelas.namaKelas);
    setEditMode(kelas.mode as "offline" | "online");
    setEditAngkatan(kelas.angkatan?.toString() ?? "");
    setEditCertCode(kelas.certificateClassCode ?? "");
    setEditLokasi(kelas.lokasi ?? "");
    setEditFinanceName(kelas.financeContactNameOverride ?? "");
    setEditFinanceWa(kelas.financeWhatsappNumberOverride ?? "");
    setNewExcludeDate("");
    setNewExcludeReason("");
    setLoadingExcludedDates(true);
    listExcludedDatesByKelas(kelas.id).then((dates) => {
      setExcludedDates(dates);
      setLoadingExcludedDates(false);
    });
  }

  function closeEditDialog() {
    setEditTarget(null);
    setEditStartDate("");
    setEditExclusionStrategy("keep");
    setEditNamaKelas("");
    setEditMode("offline");
    setEditAngkatan("");
    setEditCertCode("");
    setEditLokasi("");
    setEditFinanceName("");
    setEditFinanceWa("");
    setExcludedDates([]);
    setNewExcludeDate("");
    setNewExcludeReason("");
  }

  function handleForceRegenerate(kelasId: string, namaKelas: string) {
    if (!confirm(`Regenerasi jadwal untuk "${namaKelas}"?\n\nSemua sesi, assignment instruktur, dan data honorarium terkait kelas ini akan dihapus dan jadwal di-generate ulang dari kurikulum terbaru.`)) return;
    startDeleteTransition(async () => {
      const result = await forceRegenerateSchedule(kelasId);
      if (!result.ok) {
        toast.error(result.error ?? "Gagal regenerasi jadwal.");
        return;
      }
      toast.success(`Jadwal "${namaKelas}" berhasil di-regenerasi.`);
      router.refresh();
    });
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const res = await deleteKelasOtomatis(deleteTarget.id);
      if (!res.ok) {
        toast.error(res.error ?? "Gagal menghapus kelas.");
        return;
      }
      toast.success(`Kelas "${deleteTarget.namaKelas}" dihapus.`);
      setDeleteTarget(null);
      router.refresh();
    });
  }

  function handleMetadataSave() {
    if (!editTarget) return;
    startEditTransition(async () => {
      const angkatanValue = editAngkatan.trim()
        ? Number.parseInt(editAngkatan, 10)
        : null;
      const result = await updateKelasOtomatisMetadata({
        id: editTarget.id,
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
      closeEditDialog();
      router.refresh();
    });
  }

  function handleStartDateSave() {
    if (!editTarget) return;
    if (!editStartDate) {
      toast.error("Tanggal mulai wajib diisi.");
      return;
    }
    startEditTransition(async () => {
      const result = await updateKelasOtomatisStartDate({
        id: editTarget.id,
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
      closeEditDialog();
      router.refresh();
    });
  }

  function handleFinanceSave() {
    if (!editTarget) return;
    startEditTransition(async () => {
      const result = await updateKelasFinanceContactOverride({
        id: editTarget.id,
        financeContactNameOverride: editFinanceName.trim(),
        financeWhatsappNumberOverride: editFinanceWa.trim(),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal memperbarui kontak keuangan.");
        return;
      }
      toast.success("Kontak keuangan diperbarui.");
      closeEditDialog();
      router.refresh();
    });
  }

  function handleAddExcludedDate() {
    if (!editTarget || !newExcludeDate) return;
    startExcludedDateTransition(async () => {
      const result = await addExcludedDateToKelas({
        kelasId: editTarget.id,
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
      const dates = await listExcludedDatesByKelas(editTarget.id);
      setExcludedDates(dates);
      router.refresh();
    });
  }

  function handleRemoveExcludedDate(date: string) {
    if (!editTarget) return;
    startExcludedDateTransition(async () => {
      const result = await removeExcludedDateFromKelas({
        kelasId: editTarget.id,
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

  function handleStatusChange() {
    if (!statusTarget || !statusAction) return;
    startStatusTransition(async () => {
      const result = await updateKelasOtomatisStatus({
        id: statusTarget.id,
        status: statusAction,
        reason: statusReason.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal mengubah status.");
        return;
      }
      if ("unchanged" in result && result.unchanged) {
        toast.info("Status tidak berubah.");
      } else {
        toast.success(`Status kelas diubah ke "${statusAction}".`);
      }
      setStatusTarget(null);
      setStatusAction(null);
      setStatusReason("");
      router.refresh();
    });
  }

  const statusActionLabel = statusAction === "completed"
    ? "Tandai Selesai"
    : statusAction === "cancelled"
      ? "Batalkan Kelas"
      : "Aktifkan Ulang";

  const columns = useMemo<ColumnDef<KelasOtomatisRow>[]>(() => {
    const base: ColumnDef<KelasOtomatisRow>[] = [
      {
        accessorKey: "namaKelas",
        header: "Nama Kelas",
        cell: ({ row }) => (
          <button
            onClick={() =>
              router.push(`/jadwal-otomatis/${row.original.id}`)
            }
            className="font-medium text-left hover:underline cursor-pointer"
          >
            {row.original.namaKelas}
          </button>
        ),
      },
      {
        accessorKey: "programName",
        header: "Program",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.programName}</Badge>
        ),
      },
      {
        accessorKey: "classTypeName",
        header: "Tipe Kelas",
      },
      {
        accessorKey: "mode",
        header: "Metode",
        cell: ({ row }) => (
          <Badge
            variant={row.original.mode === "online" ? "secondary" : "default"}
          >
            {row.original.mode === "online" ? "Online" : "Offline"}
          </Badge>
        ),
      },
      {
        accessorKey: "startDate",
        header: "Tanggal Mulai",
      },
      {
        accessorKey: "endDate",
        header: "Tanggal Selesai",
        cell: ({ row }) =>
          row.original.endDate ?? (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        accessorKey: "totalSessions",
        header: "Total Sesi",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.totalSessions}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={STATUS_COLORS[row.original.status] ?? "outline"}>
            {row.original.status}
          </Badge>
        ),
      },
    ];

    if (canManage) {
      base.push({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const kelas = row.original;
          const isActive = kelas.status === "active";
          const isCompleted = kelas.status === "completed";
          const isCancelled = kelas.status === "cancelled";

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Aksi</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/jadwal-otomatis/${kelas.id}`)
                    }
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Lihat Jadwal
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openEditDialog(kelas)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Kelas
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleForceRegenerate(kelas.id, kelas.namaKelas)}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerasi Jadwal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isActive && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setStatusTarget(kelas);
                          setStatusAction("completed");
                          setStatusReason("");
                        }}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Tandai Selesai
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          setStatusTarget(kelas);
                          setStatusAction("cancelled");
                          setStatusReason("");
                        }}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Batalkan Kelas
                      </DropdownMenuItem>
                    </>
                  )}
                  {(isCompleted || isCancelled) && (
                    <DropdownMenuItem
                      onClick={() => {
                        setStatusTarget(kelas);
                        setStatusAction("active");
                        setStatusReason("");
                      }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Aktifkan Ulang
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteTarget(kelas)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      });
    }

    return base;
  }, [canManage, router]);

  return (
    <>
      <Card className="rounded-[24px]">
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={initialData}
            searchColumnId="namaKelas"
            searchPlaceholder="Cari kelas..."
            emptyMessage="Belum ada kelas. Klik 'Buat Kelas Baru' untuk memulai."
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Kelas?</DialogTitle>
            <DialogDescription>
              Kelas{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.namaKelas}
              </span>{" "}
              akan dihapus permanen beserta seluruh jadwalnya. Aksi ini tidak
              dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Kelas Dialog with Tabs */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open && !isSavingEdit) closeEditDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Kelas</DialogTitle>
            <DialogDescription>
              Ubah informasi kelas{" "}
              <span className="font-medium text-foreground">
                {editTarget?.namaKelas}
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
                <label className="text-sm font-medium" htmlFor="edit-nama">
                  Nama Kelas
                </label>
                <Input
                  id="edit-nama"
                  value={editNamaKelas}
                  onChange={(e) => setEditNamaKelas(e.target.value)}
                  disabled={isSavingEdit}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Metode</label>
                <Select
                  value={editMode}
                  onValueChange={(v) =>
                    setEditMode(v as "offline" | "online")
                  }
                  disabled={isSavingEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="edit-angkatan">
                  Angkatan
                </label>
                <Input
                  id="edit-angkatan"
                  type="number"
                  min={1}
                  max={999}
                  value={editAngkatan}
                  onChange={(e) => setEditAngkatan(e.target.value)}
                  disabled={isSavingEdit}
                  placeholder="Opsional"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="edit-cert">
                  Kode Sertifikat (01-02)
                </label>
                <Input
                  id="edit-cert"
                  maxLength={2}
                  value={editCertCode}
                  onChange={(e) => setEditCertCode(e.target.value)}
                  disabled={isSavingEdit}
                  placeholder="Opsional, misal: 01"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="edit-lokasi">
                  Lokasi
                </label>
                <Input
                  id="edit-lokasi"
                  value={editLokasi}
                  onChange={(e) => setEditLokasi(e.target.value)}
                  disabled={isSavingEdit}
                  placeholder="Opsional"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={closeEditDialog}
                  disabled={isSavingEdit}
                >
                  Batal
                </Button>
                <Button onClick={handleMetadataSave} disabled={isSavingEdit}>
                  {isSavingEdit ? "Menyimpan..." : "Simpan Metadata"}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Start Date Tab */}
            <TabsContent value="tanggal" className="space-y-3 pt-2">
              <div className="space-y-1">
                <label
                  className="text-sm font-medium"
                  htmlFor="edit-start-date"
                >
                  Tanggal Mulai Baru
                </label>
                <Input
                  id="edit-start-date"
                  type="date"
                  value={editStartDate}
                  onChange={(event) => setEditStartDate(event.target.value)}
                  disabled={isSavingEdit}
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-medium"
                  htmlFor="edit-exclusion-strategy"
                >
                  Perlakuan Tanggal Eksklusi
                </label>
                <Select
                  value={editExclusionStrategy}
                  onValueChange={(value) =>
                    setEditExclusionStrategy(
                      value as "keep" | "shift" | "clear",
                    )
                  }
                  disabled={isSavingEdit}
                >
                  <SelectTrigger id="edit-exclusion-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Tetap (absolut)</SelectItem>
                    <SelectItem value="shift">
                      Geser mengikuti selisih tanggal mulai
                    </SelectItem>
                    <SelectItem value="clear">
                      Kosongkan eksklusi manual
                    </SelectItem>
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
              <p className="text-xs text-muted-foreground">
                Catatan: jadwal lama dan assignment instruktur akan disusun
                ulang sesuai tanggal baru.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={closeEditDialog}
                  disabled={isSavingEdit}
                >
                  Batal
                </Button>
                <Button onClick={handleStartDateSave} disabled={isSavingEdit}>
                  {isSavingEdit ? "Menyimpan..." : "Simpan Tanggal"}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Finance Contact Tab */}
            <TabsContent value="keuangan" className="space-y-3 pt-2">
              <div className="space-y-1">
                <label
                  className="text-sm font-medium"
                  htmlFor="edit-finance-name"
                >
                  Nama Kontak Keuangan
                </label>
                <Input
                  id="edit-finance-name"
                  value={editFinanceName}
                  onChange={(e) => setEditFinanceName(e.target.value)}
                  disabled={isSavingEdit}
                  placeholder="Override nama kontak (opsional)"
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-medium"
                  htmlFor="edit-finance-wa"
                >
                  Nomor WhatsApp Keuangan
                </label>
                <Input
                  id="edit-finance-wa"
                  value={editFinanceWa}
                  onChange={(e) => setEditFinanceWa(e.target.value)}
                  disabled={isSavingEdit}
                  placeholder="Override nomor WA (opsional)"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Kosongkan untuk menggunakan default global.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={closeEditDialog}
                  disabled={isSavingEdit}
                >
                  Batal
                </Button>
                <Button onClick={handleFinanceSave} disabled={isSavingEdit}>
                  {isSavingEdit ? "Menyimpan..." : "Simpan Kontak"}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Excluded Dates Tab */}
            <TabsContent value="eksklusi" className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Tanggal Eksklusi
                </label>
                <p className="text-xs text-muted-foreground">
                  Tanggal yang dilewati saat generate jadwal. Jadwal akan di-generate ulang otomatis.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newExcludeDate}
                  onChange={(e) => setNewExcludeDate(e.target.value)}
                  disabled={isExcludedDatePending}
                  className="w-44"
                />
                <Input
                  type="text"
                  value={newExcludeReason}
                  onChange={(e) => setNewExcludeReason(e.target.value)}
                  placeholder="Keterangan (opsional)"
                  disabled={isExcludedDatePending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddExcludedDate();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddExcludedDate}
                  disabled={isExcludedDatePending || !newExcludeDate}
                >
                  Tambah
                </Button>
              </div>
              {loadingExcludedDates ? (
                <p className="text-sm text-muted-foreground">Memuat...</p>
              ) : excludedDates.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {excludedDates.map(({ date, reason }) => (
                    <Badge key={date} variant="secondary" className="gap-1">
                      <Calendar className="h-3 w-3" /> {date}
                      {reason && (
                        <span className="text-muted-foreground">· {reason}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveExcludedDate(date)}
                        disabled={isExcludedDatePending}
                        className="ml-1 hover:text-destructive"
                      >
                        &times;
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Calendar} title="Belum ada tanggal eksklusi" description="Tanggal libur atau pengecualian kelas akan tampil setelah ditambahkan." className="min-h-32" />
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={closeEditDialog}
                  disabled={isExcludedDatePending}
                >
                  Tutup
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Status Transition Confirmation Dialog */}
      <Dialog
        open={!!statusTarget && !!statusAction}
        onOpenChange={(open) => {
          if (!open && !isStatusPending) {
            setStatusTarget(null);
            setStatusAction(null);
            setStatusReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statusActionLabel}</DialogTitle>
            <DialogDescription>
              {statusAction === "completed"
                ? `Tandai kelas "${statusTarget?.namaKelas}" sebagai selesai?`
                : statusAction === "cancelled"
                  ? `Batalkan kelas "${statusTarget?.namaKelas}"? Peserta dan jadwal tetap tersimpan.`
                  : `Aktifkan kembali kelas "${statusTarget?.namaKelas}"?`}
            </DialogDescription>
          </DialogHeader>
          {(statusAction === "cancelled" || statusAction === "active") && (
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="status-reason"
              >
                Alasan{" "}
                {statusAction === "cancelled" ? "(wajib)" : "(opsional)"}
              </label>
              <Textarea
                id="status-reason"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                disabled={isStatusPending}
                placeholder={
                  statusAction === "cancelled"
                    ? "Jelaskan alasan pembatalan..."
                    : "Jelaskan alasan aktivasi ulang..."
                }
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStatusTarget(null);
                setStatusAction(null);
                setStatusReason("");
              }}
              disabled={isStatusPending}
            >
              Batal
            </Button>
            <Button
              variant={
                statusAction === "cancelled" ? "destructive" : "default"
              }
              onClick={handleStatusChange}
              disabled={isStatusPending}
            >
              {isStatusPending
                ? "Memproses..."
                : statusActionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
