"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, CheckCircle, Download, Eye, FileSpreadsheet, FileText, FileUp, Loader2, Mail, Pencil, Plus, QrCode, RefreshCw, Trash2, Users } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTanggal } from "@/lib/utils";
import { getEventQuickStats, type EventRow, type EventQuickStats } from "@/server/actions/sertifikat/events";
import {
  bulkImportParticipants,
  bulkDeleteParticipants,
  bulkRevokeParticipants,
  createParticipant,
  deleteParticipant,
  listByEvent,
  reactivateParticipant,
  reissueParticipant,
  revokeParticipant,
  updateParticipant,
  type ParticipantFilters,
  type ParticipantListResult,
  type ParticipantRow,
  type StatusPeserta,
} from "@/server/actions/sertifikat/participants";
import {
  generateBulkCertificatesZip,
  generateCertificatePdf,
  sendBulkCertificateEmails,
  sendCertificateEmail,
} from "@/server/actions/sertifikat/certificates";
import { exportEventReport } from "@/server/actions/sertifikat/reports";
import { ParticipantRevisionsTimeline } from "./ParticipantRevisionsTimeline";

const participantSchema = z.object({
  noSertifikat: z.string().trim().max(100).optional(),
  nama: z.string().trim().min(1, "Nama peserta wajib diisi."),
  role: z.string().trim().min(1, "Role wajib diisi."),
  email: z.string().trim().email("Format email tidak valid.").optional().or(z.literal("")),
});

type ParticipantFormValues = z.infer<typeof participantSchema>;

function toFormValues(participant?: ParticipantRow): ParticipantFormValues {
  return {
    noSertifikat: participant?.noSertifikat ?? "",
    nama: participant?.nama ?? "",
    role: participant?.role ?? "Peserta",
    email: participant?.email ?? "",
  };
}

function buildVerificationUrl(noSertifikat: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${baseUrl}/verifikasi/${encodeURIComponent(noSertifikat)}`;
}

async function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadBase64(base64: string, fileName: string, mimeType: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function writeUint16(buffer: number[], value: number) {
  buffer.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(buffer: number[], value: number) {
  buffer.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

function asBlobPart(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function createZip(files: { name: string; bytes: Uint8Array }[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = textBytes(file.name);
    const crc = crc32(file.bytes);
    const local: number[] = [];
    writeUint32(local, 0x04034b50);
    writeUint16(local, 20);
    writeUint16(local, 0);
    writeUint16(local, 0);
    writeUint16(local, 0);
    writeUint16(local, 0);
    writeUint32(local, crc);
    writeUint32(local, file.bytes.length);
    writeUint32(local, file.bytes.length);
    writeUint16(local, nameBytes.length);
    writeUint16(local, 0);
    const localHeader = new Uint8Array([...local, ...nameBytes, ...file.bytes]);
    localParts.push(localHeader);

    const central: number[] = [];
    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, crc);
    writeUint32(central, file.bytes.length);
    writeUint32(central, file.bytes.length);
    writeUint16(central, nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, offset);
    centralParts.push(new Uint8Array([...central, ...nameBytes]));
    offset += localHeader.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end: number[] = [];
  writeUint32(end, 0x06054b50);
  writeUint16(end, 0);
  writeUint16(end, 0);
  writeUint16(end, files.length);
  writeUint16(end, files.length);
  writeUint32(end, centralSize);
  writeUint32(end, offset);
  writeUint16(end, 0);

  return new Blob(
    [...localParts, ...centralParts, new Uint8Array(end)].map(asBlobPart),
    {
    type: "application/zip",
    },
  );
}

async function dataUrlToBytes(dataUrl: string) {
  const response = await fetch(dataUrl);
  return new Uint8Array(await response.arrayBuffer());
}

export function ParticipantManager({
  event,
  initialParticipants,
  initialStats,
}: {
  event: EventRow;
  initialParticipants: ParticipantListResult;
  initialStats: EventQuickStats;
}) {
  const [data, setData] = useState<ParticipantListResult>(initialParticipants);
  const [stats, setStats] = useState<EventQuickStats>(initialStats);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusPeserta | "all">("aktif");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ParticipantRow | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [bulkRevokeOpen, setBulkRevokeOpen] = useState(false);
  const [bulkRevokeReason, setBulkRevokeReason] = useState("");
  const [reissueTarget, setReissueTarget] = useState<ParticipantRow | null>(null);
  const [reissueForm, setReissueForm] = useState({ nama: "", role: "Peserta", email: "", reason: "" });
  const [previewPdf, setPreviewPdf] = useState<{ url: string; fileName: string; participantName: string } | null>(null);
  const [qrParticipant, setQrParticipant] = useState<ParticipantRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [editingParticipant, setEditingParticipant] = useState<ParticipantRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const form = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema),
    defaultValues: toFormValues(),
  });

  const fetchData = useCallback(
    (overrides: Partial<ParticipantFilters> = {}) => {
      startTransition(async () => {
        const [result, freshStats] = await Promise.all([
          listByEvent(event.id, {
            search: (overrides.search as string) ?? search,
            status: (overrides.status as StatusPeserta | "all") ?? statusFilter,
            page: (overrides.page as number) ?? page,
            pageSize,
          }),
          getEventQuickStats(event.id),
        ]);
        setData(result);
        setStats(freshStats);
      });
    },
    [event.id, search, statusFilter, page, pageSize],
  );

  const allChecked = data.rows.length > 0 && data.rows.every((row) => selectedIds.has(row.id));
  const someChecked = data.rows.some((row) => selectedIds.has(row.id)) && !allChecked;

  function toggleAll() {
    if (allChecked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.rows.map((row) => row.id)));
    }
  }

  function toggleOne(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function handleSearch() {
    setPage(1);
    setSelectedIds(new Set());
    fetchData({ search, page: 1 });
  }

  function handleStatusChange(value: string) {
    const status = value as StatusPeserta | "all";
    setStatusFilter(status);
    setPage(1);
    setSelectedIds(new Set());
    fetchData({ status, page: 1 });
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    setSelectedIds(new Set());
    fetchData({ page: newPage });
  }

  function openCreateDialog() {
    setEditingParticipant(null);
    form.reset(toFormValues());
    setDialogOpen(true);
  }

  function openEditDialog(participant: ParticipantRow) {
    setEditingParticipant(participant);
    form.reset(toFormValues(participant));
    setDialogOpen(true);
  }

  function submitParticipant(values: ParticipantFormValues) {
    startTransition(async () => {
      const result = editingParticipant
        ? await updateParticipant(editingParticipant.id, values)
        : await createParticipant({ ...values, eventId: event.id });

      if (result.ok) {
        toast.success(editingParticipant ? "Peserta berhasil diperbarui." : "Peserta berhasil ditambahkan.");
        setDialogOpen(false);
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function removeParticipant(participant: ParticipantRow) {
    if (!window.confirm(`Hapus peserta "${participant.nama}"?`)) return;
    startTransition(async () => {
      const result = await deleteParticipant(participant.id);
      if (result.ok) {
        toast.success("Peserta berhasil dihapus.");
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRevoke(participant: ParticipantRow) {
    setRevokeTarget(participant);
    setRevokeReason("");
    setRevokeOpen(true);
  }

  function confirmRevoke() {
    if (!revokeTarget) return;
    startTransition(async () => {
      const result = await revokeParticipant(revokeTarget.id, revokeReason || undefined);
      if (result.ok) {
        toast.success("Sertifikat berhasil dicabut.");
        setRevokeOpen(false);
        setRevokeTarget(null);
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleReissue(participant: ParticipantRow) {
    setReissueTarget(participant);
    setReissueForm({
      nama: participant.nama,
      role: participant.role,
      email: participant.email ?? "",
      reason: "",
    });
  }

  function confirmReissue() {
    if (!reissueTarget) return;
    if (!reissueForm.nama.trim()) {
      toast.error("Nama wajib diisi.");
      return;
    }
    startTransition(async () => {
      const result = await reissueParticipant(reissueTarget.id, {
        nama: reissueForm.nama.trim(),
        role: reissueForm.role.trim() || undefined,
        email: reissueForm.email.trim() || null,
        reason: reissueForm.reason.trim() || undefined,
      });
      if (result.ok) {
        toast.success(`Sertifikat baru terbit: ${result.data.noSertifikat}`);
        setReissueTarget(null);
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleReactivate(participant: ParticipantRow) {
    if (!window.confirm(`Aktifkan kembali sertifikat "${participant.nama}"?`)) return;
    startTransition(async () => {
      const result = await reactivateParticipant(participant.id);
      if (result.ok) {
        toast.success("Sertifikat berhasil diaktifkan kembali.");
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const idsToDelete = [...selectedIds];
    if (!window.confirm(`Hapus ${idsToDelete.length} peserta terpilih?`)) return;

    // Optimistic: remove rows immediately
    const targetSet = new Set(idsToDelete);
    setData((prev) => ({
      ...prev,
      rows: prev.rows.filter((row) => !targetSet.has(row.id)),
      total: Math.max(0, prev.total - idsToDelete.length),
    }));
    setStats((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - idsToDelete.length),
      aktif: Math.max(0, prev.aktif - idsToDelete.length),
    }));
    setSelectedIds(new Set());

    startTransition(async () => {
      const result = await bulkDeleteParticipants(idsToDelete);
      if (result.ok) {
        toast.success(`${result.data.deleted} peserta berhasil dihapus.`);
        fetchData(); // Sync with truth
      } else {
        toast.error(result.error);
        fetchData(); // Rollback
      }
    });
  }

  function handleBulkRevoke() {
    if (selectedIds.size === 0) return;
    setBulkRevokeReason("");
    setBulkRevokeOpen(true);
  }

  function confirmBulkRevoke() {
    const idsToRevoke = [...selectedIds];
    if (idsToRevoke.length === 0) return;

    // Optimistic: mark as dicabut, or remove from view if filter is "aktif"
    const targetSet = new Set(idsToRevoke);
    setData((prev) => ({
      ...prev,
      rows:
        statusFilter === "aktif"
          ? prev.rows.filter((row) => !targetSet.has(row.id))
          : prev.rows.map((row) => (targetSet.has(row.id) ? { ...row, statusPeserta: "dicabut" as StatusPeserta } : row)),
      total: statusFilter === "aktif" ? Math.max(0, prev.total - idsToRevoke.length) : prev.total,
    }));
    setStats((prev) => ({
      ...prev,
      aktif: Math.max(0, prev.aktif - idsToRevoke.length),
      dicabut: prev.dicabut + idsToRevoke.length,
    }));
    setBulkRevokeOpen(false);
    setSelectedIds(new Set());

    startTransition(async () => {
      const result = await bulkRevokeParticipants(idsToRevoke, bulkRevokeReason || undefined);
      if (result.ok) {
        toast.success(`${result.data.revoked} sertifikat berhasil dicabut.`);
        fetchData();
      } else {
        toast.error(result.error);
        fetchData(); // Rollback
      }
    });
  }

  async function openQr(participant: ParticipantRow) {
    setQrParticipant(participant);
    const dataUrl = await QRCode.toDataURL(buildVerificationUrl(participant.noSertifikat), {
      width: 320,
      margin: 2,
    });
    setQrDataUrl(dataUrl);
  }

  async function downloadQr(participant: ParticipantRow) {
    const dataUrl = await QRCode.toDataURL(buildVerificationUrl(participant.noSertifikat), {
      width: 512,
      margin: 2,
    });
    await downloadDataUrl(dataUrl, `QR-${participant.noSertifikat}.png`);
  }

  async function exportAllQr() {
    if (data.total === 0) return;
    toast.info("Menyiapkan file QR...");
    const { listAllByEvent } = await import("@/server/actions/sertifikat/participants");
    const allParticipants = await listAllByEvent(event.id);
    const files = await Promise.all(
      allParticipants.map(async (participant) => {
        const dataUrl = await QRCode.toDataURL(buildVerificationUrl(participant.noSertifikat), {
          width: 512,
          margin: 2,
        });
        return {
          name: `QR-${participant.noSertifikat.replace(/[\\/:*?"<>|]/g, "-")}.png`,
          bytes: await dataUrlToBytes(dataUrl),
        };
      }),
    );
    const zip = createZip(files);
    const url = URL.createObjectURL(zip);
    await downloadDataUrl(url, `QR-${event.id}-${event.namaKegiatan}.zip`);
    URL.revokeObjectURL(url);
  }

  function downloadPdf(participant: ParticipantRow) {
    const toastId = toast.loading("Menyiapkan sertifikat...");
    startTransition(async () => {
      const result = await generateCertificatePdf(participant.id);
      toast.dismiss(toastId);
      if (result.ok) {
        downloadBase64(result.data.pdfBase64, result.data.fileName, "application/pdf");
        toast.success("Sertifikat berhasil disiapkan.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function previewPdfFor(participant: ParticipantRow) {
    const toastId = toast.loading("Menyiapkan preview...");
    startTransition(async () => {
      const result = await generateCertificatePdf(participant.id);
      toast.dismiss(toastId);
      if (result.ok) {
        const byteChars = atob(result.data.pdfBase64);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        // Revoke previous URL if any
        if (previewPdf?.url) URL.revokeObjectURL(previewPdf.url);
        setPreviewPdf({ url, fileName: result.data.fileName, participantName: participant.nama });
      } else {
        toast.error(result.error);
      }
    });
  }

  function closePreview() {
    if (previewPdf?.url) URL.revokeObjectURL(previewPdf.url);
    setPreviewPdf(null);
  }

  function downloadReport() {
    const toastId = toast.loading("Menyiapkan laporan...");
    startTransition(async () => {
      const result = await exportEventReport(event.id);
      toast.dismiss(toastId);
      if (result.ok) {
        downloadBase64(
          result.data.xlsxBase64,
          result.data.fileName,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        toast.success("Laporan berhasil diekspor.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function downloadAllPdf() {
    if (data.total === 0) return;
    const toastId = toast.loading("Menyiapkan semua sertifikat...");
    startTransition(async () => {
      const result = await generateBulkCertificatesZip(event.id);
      toast.dismiss(toastId);
      if (result.ok) {
        downloadBase64(result.data.zipBase64, result.data.fileName, "application/zip");
        toast.success("ZIP sertifikat berhasil disiapkan.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function sendEmail(participant: ParticipantRow) {
    const toastId = toast.loading("Mengirim email sertifikat...");
    startTransition(async () => {
      const result = await sendCertificateEmail(participant.id);
      toast.dismiss(toastId);
      if (result.ok) {
        toast.success("Email sertifikat berhasil dikirim.");
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function sendAllEmails() {
    if (data.total === 0) {
      toast.error("Tidak ada peserta aktif.");
      return;
    }
    if (!window.confirm("Kirim email sertifikat ke semua peserta aktif?")) return;

    const toastId = toast.loading("Mengirim email sertifikat...");
    startTransition(async () => {
      const result = await sendBulkCertificateEmails(event.id);
      toast.dismiss(toastId);
      if (result.ok) {
        const { sent, skipped, failed } = result.data;
        toast.success(`Bulk email selesai: ${sent} terkirim`, {
          description: `${skipped} dilewati (tanpa email) · ${failed} gagal`,
        });
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function submitImport() {
    if (!file) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await bulkImportParticipants(event.id, formData);
      if (result.ok) {
        toast.success(`Import selesai: ${result.data.successCount}/${result.data.totalRows} baris berhasil`, {
          description: result.data.errors.length > 0 ? `${result.data.errors.length} baris gagal — cek console untuk detail.` : "Semua data berhasil diimpor.",
        });
        if (result.data.errors.length > 0) {
          console.error("Import peserta gagal:", result.data.errors);
        }
        setImportOpen(false);
        setFile(null);
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }

  const pctDownload = stats.aktif > 0 ? Math.round((stats.sudahDownload / stats.aktif) * 100) : 0;
  const pctEmail = stats.punyaEmail > 0 ? Math.round((stats.emailTerkirim / stats.punyaEmail) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Aktif" value={stats.aktif} className="text-emerald-600" />
        <StatCard label="Dicabut" value={stats.dicabut} className="text-red-600" />
        <StatCard label="Punya Email" value={stats.punyaEmail} />
        <StatCard label="Email Terkirim" value={`${stats.emailTerkirim} (${pctEmail}%)`} />
        <StatCard label="Sudah Download" value={`${stats.sudahDownload} (${pctDownload}%)`} />
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-xl">{event.namaKegiatan}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatTanggal(event.tanggalMulai)} - {formatTanggal(event.tanggalSelesai)}
              </p>
            </div>
            <Badge variant="secondary">{event.kategori}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-4">
          <Info label="Lokasi" value={event.lokasi ?? "-"} />
          <Info label="SKP" value={event.skp ?? "-"} />
          <Info label="Peserta Aktif" value={String(data.total)} />
          <Info label="Penandatangan" value={String(event.signatories.length)} />
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Peserta</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Daftar peserta dan QR verifikasi sertifikat.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                Tambah Peserta
              </Button>
              <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
                <FileUp className="h-4 w-4" />
                Import Excel/CSV
              </Button>
              <Button type="button" variant="outline" onClick={exportAllQr} disabled={data.total === 0}>
                <Download className="h-4 w-4" />
                Export QR All
              </Button>
              <Button type="button" variant="outline" onClick={downloadAllPdf} disabled={data.total === 0}>
                <FileText className="h-4 w-4" />
                Download Semua Sertifikat (ZIP)
              </Button>
              <Button type="button" variant="outline" onClick={sendAllEmails} disabled={data.total === 0}>
                <Mail className="h-4 w-4" />
                Kirim Email ke Semua
              </Button>
              <Button type="button" variant="outline" onClick={downloadReport}>
                <FileSpreadsheet className="h-4 w-4" />
                Export Laporan (Excel)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="Cari nama atau nomor sertifikat"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-64"
              />
              <Button type="button" variant="outline" onClick={handleSearch}>
                Cari
              </Button>
            </div>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="dicabut">Dicabut</SelectItem>
                <SelectItem value="all">Semua</SelectItem>
              </SelectContent>
            </Select>
            {selectedIds.size > 0 ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleBulkDelete}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Hapus ({selectedIds.size})
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleBulkRevoke}>
                  <Ban className="mr-1 h-4 w-4" />
                  Cabut Sertifikat ({selectedIds.size})
                </Button>
              </div>
            ) : null}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.dataset.state = someChecked ? "indeterminate" : allChecked ? "checked" : "unchecked";
                    }}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>No. Sertifikat</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((participant) => (
                <TableRow key={participant.id} className={participant.statusPeserta === "dicabut" ? "opacity-60" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(participant.id)}
                      onCheckedChange={() => toggleOne(participant.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{participant.noSertifikat}</TableCell>
                  <TableCell className="font-medium">{participant.nama}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{participant.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{participant.email ?? "-"}</span>
                      {participant.emailSentAt ? (
                        <Badge variant="outline" className="w-fit border-green-200 bg-green-50 text-green-700">
                          Sent
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {participant.statusPeserta === "dicabut" ? (
                      <Badge variant="destructive" className="gap-1">
                        <Ban className="h-3 w-3" />
                        DICABUT
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                        Aktif
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="icon-sm" onClick={() => previewPdfFor(participant)} title="Preview Sertifikat">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon-sm" onClick={() => downloadPdf(participant)} title="Download PDF">
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        disabled={!participant.email || participant.statusPeserta === "dicabut"}
                        title={!participant.email ? "Peserta belum punya email" : "Kirim email sertifikat"}
                        onClick={() => sendEmail(participant)}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon-sm" onClick={() => openQr(participant)} title="QR Code">
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon-sm" onClick={() => openEditDialog(participant)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {participant.statusPeserta === "aktif" ? (
                        <>
                          <Button variant="outline" size="icon-sm" onClick={() => handleReissue(participant)} title="Terbitkan Ulang" className="text-purple-600 hover:text-purple-700">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon-sm" onClick={() => handleRevoke(participant)} title="Cabut Sertifikat" className="text-orange-600 hover:text-orange-700">
                            <Ban className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" size="icon-sm" onClick={() => handleReactivate(participant)} title="Aktifkan Kembali" className="text-green-600 hover:text-green-700">
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="destructive" size="icon-sm" onClick={() => removeParticipant(participant)} title="Hapus">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {data.rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={statusFilter === "dicabut" ? "Tidak ada sertifikat dicabut" : "Belum ada peserta"}
              description={
                statusFilter === "dicabut"
                  ? "Sertifikat yang dicabut akan muncul di daftar ini."
                  : "Tambahkan peserta untuk mulai menerbitkan, mengirim, dan memverifikasi sertifikat."
              }
              action={
                statusFilter === "dicabut" ? null : (
                  <Button type="button" size="sm" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4" />
                    Tambah Peserta
                  </Button>
                )
              }
            />
          ) : null}

          {data.totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Halaman {data.page} dari {data.totalPages} ({data.total} total)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => handlePageChange(data.page - 1)}>
                  Sebelumnya
                </Button>
                <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => handlePageChange(data.page + 1)}>
                  Berikutnya
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingParticipant ? "Edit Peserta" : "Tambah Peserta"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(submitParticipant)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nomor Sertifikat</Label>
              <Input placeholder="Kosongkan untuk auto-generate" {...form.register("noSertifikat")} />
              <p className="text-xs text-muted-foreground">
                Format otomatis: {event.kodeEvent}-001/{event.tanggalMulai.slice(0, 4)}.
              </p>
              <FormError message={form.formState.errors.noSertifikat?.message} />
            </div>
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input {...form.register("nama")} />
              <FormError message={form.formState.errors.nama?.message} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="nama@email.com" {...form.register("email")} />
              <FormError message={form.formState.errors.email?.message} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.watch("role")} onValueChange={(value) => form.setValue("role", value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Peserta">Peserta</SelectItem>
                  <SelectItem value="Pembicara">Pembicara</SelectItem>
                  <SelectItem value="Panitia">Panitia</SelectItem>
                  <SelectItem value="Moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan
              </Button>
            </DialogFooter>
          </form>
          {editingParticipant ? (
            <div className="mt-4 border-t border-border pt-4">
              <h4 className="mb-3 text-sm font-semibold">Riwayat Perubahan</h4>
              <ParticipantRevisionsTimeline participantId={editingParticipant.id} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Peserta</DialogTitle>
            <DialogDescription>
              Kolom wajib: Nama. Kolom No Sertifikat, Role, dan Email bersifat opsional. Nomor sertifikat kosong akan dibuat otomatis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                Batal
              </Button>
              <Button type="button" onClick={submitImport} disabled={!file || isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Import
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cabut Sertifikat</DialogTitle>
            <DialogDescription>
              Sertifikat <strong>{revokeTarget?.noSertifikat}</strong> atas nama <strong>{revokeTarget?.nama}</strong> akan dicabut. Sertifikat yang dicabut tidak akan muncul di verifikasi publik.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Alasan Pencabutan (opsional)</Label>
              <Textarea
                placeholder="Masukkan alasan pencabutan..."
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRevokeOpen(false)}>
                Batal
              </Button>
              <Button type="button" variant="destructive" onClick={confirmRevoke} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cabut Sertifikat
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reissueTarget} onOpenChange={(open) => !open && setReissueTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terbitkan Ulang Sertifikat</DialogTitle>
            <DialogDescription>
              Sertifikat lama <strong>{reissueTarget?.noSertifikat}</strong> akan dicabut, lalu sertifikat baru diterbitkan dengan nomor baru otomatis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Penerima</Label>
              <Input
                value={reissueForm.nama}
                onChange={(e) => setReissueForm((prev) => ({ ...prev, nama: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={reissueForm.role} onValueChange={(value) => setReissueForm((prev) => ({ ...prev, role: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Peserta">Peserta</SelectItem>
                    <SelectItem value="Pembicara">Pembicara</SelectItem>
                    <SelectItem value="Panitia">Panitia</SelectItem>
                    <SelectItem value="Moderator">Moderator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={reissueForm.email}
                  onChange={(e) => setReissueForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Alasan Re-issue (opsional)</Label>
              <Textarea
                placeholder="Contoh: koreksi nama, perbaikan ejaan, dll."
                value={reissueForm.reason}
                onChange={(e) => setReissueForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReissueTarget(null)}>
                Batal
              </Button>
              <Button type="button" onClick={confirmReissue} disabled={isPending} className="bg-purple-600 hover:bg-purple-700">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Terbitkan Ulang
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewPdf} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-h-[95vh] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Preview Sertifikat</DialogTitle>
            <DialogDescription>{previewPdf?.participantName}</DialogDescription>
          </DialogHeader>
          {previewPdf ? (
            <iframe
              src={previewPdf.url}
              title="Preview Sertifikat"
              className="h-[70vh] w-full rounded-md border border-border"
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closePreview}>
              Tutup
            </Button>
            {previewPdf ? (
              <a
                href={previewPdf.url}
                download={previewPdf.fileName}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <FileText className="h-4 w-4" />
                Download
              </a>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRevokeOpen} onOpenChange={setBulkRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cabut Sertifikat Terpilih</DialogTitle>
            <DialogDescription>
              {selectedIds.size} sertifikat akan dicabut. Sertifikat yang dicabut tidak akan muncul di verifikasi publik.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Alasan Pencabutan (opsional)</Label>
              <Textarea
                placeholder="Masukkan alasan pencabutan..."
                value={bulkRevokeReason}
                onChange={(e) => setBulkRevokeReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkRevokeOpen(false)}>
                Batal
              </Button>
              <Button type="button" variant="destructive" onClick={confirmBulkRevoke} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cabut {selectedIds.size} Sertifikat
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrParticipant} onOpenChange={(open) => !open && setQrParticipant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Verifikasi</DialogTitle>
            <DialogDescription>{qrParticipant?.noSertifikat}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR verifikasi" className="h-64 w-64" />
            ) : null}
            {qrParticipant ? (
              <Button type="button" onClick={() => downloadQr(qrParticipant)}>
                <Download className="h-4 w-4" />
                Download PNG
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${className ?? ""}`}>{value}</p>
    </div>
  );
}
