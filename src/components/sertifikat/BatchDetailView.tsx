"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Ban,
  Download,
  Hash,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cancelBatch, exportBatchToCsv, type BatchDetailRow } from "@/server/actions/sertifikat/nomor/batches";
import { BatchQuantityEditor } from "./BatchQuantityEditor";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTanggal(d: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function StatusBadge({ status }: { status: BatchDetailRow["status"] }) {
  const map: Record<BatchDetailRow["status"], { label: string; className: string }> = {
    active:    { label: "Aktif",      className: "border-green-200 bg-green-50 text-green-700" },
    revised:   { label: "Direvisi",   className: "border-amber-200 bg-amber-50 text-amber-700" },
    cancelled: { label: "Dibatalkan", className: "border-red-200 bg-red-50 text-red-700" },
  };
  const { label, className } = map[status];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function ItemStatusBadge({ status }: { status: "active" | "cancelled" }) {
  return status === "active" ? (
    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 text-xs">Aktif</Badge>
  ) : (
    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-xs">Dibatalkan</Badge>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

// ─── CSV Download ─────────────────────────────────────────────────────────────

function downloadCsv(rows: { "No.": number; "Nomor Sertifikat": string; "Serial Number": number; Status: string }[], filename: string) {
  const headers = ["No.", "Nomor Sertifikat", "Serial Number", "Status"];
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      [row["No."], row["Nomor Sertifikat"], row["Serial Number"], row.Status].join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BatchDetailViewProps {
  batch: BatchDetailRow;
  role: string;
}

// ─── Komponen ─────────────────────────────────────────────────────────────────

export function BatchDetailView({ batch, role }: BatchDetailViewProps) {
  const [batchData, setBatchData]    = useState<BatchDetailRow>(batch);
  const [editorOpen, setEditorOpen]  = useState(false);
  const [isPending, startTransition] = useTransition();

  const isAdmin = role === "admin";
  const activeCount = batchData.items.filter((i) => i.status === "active").length;

  function handleExportCsv() {
    startTransition(async () => {
      const result = await exportBatchToCsv(batchData.id);
      if (result.ok) {
        downloadCsv(result.data, result.filename);
        toast.success(`${result.data.length} nomor berhasil diekspor.`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCancel() {
    const confirmed = window.confirm(
      `Batalkan batch ini? Semua ${activeCount} nomor sertifikat aktif akan ditandai dibatalkan. Tindakan ini tidak dapat diurungkan.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await cancelBatch(batchData.id);
      if (result.ok) {
        toast.success("Batch berhasil dibatalkan.");
        // Refresh halaman untuk data terbaru
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Hash className="h-5 w-5 text-primary" />
                {batchData.programName} — Angkatan {batchData.angkatan}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {batchData.classTypeName}{" "}
                <span className="font-mono">({batchData.classTypeCode})</span>
                {batchData.kelasName ? ` - ${batchData.kelasName}` : ""}
              </p>
            </div>
            <StatusBadge status={batchData.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Info grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCard label="Nomor Pertama" value={batchData.firstCertificateNumber} />
            <InfoCard label="Nomor Terakhir" value={batchData.lastCertificateNumber} />
            <InfoCard label="Jumlah Diminta" value={String(batchData.quantityRequested)} />
            <InfoCard label="Aktif" value={String(activeCount)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard label="Dibuat Oleh" value={batchData.createdByName ?? "—"} />
            <InfoCard label="Tanggal Dibuat" value={formatTanggal(batchData.createdAt)} />
            {batchData.kelasMode ? (
              <InfoCard label="Metode Kelas" value={batchData.kelasMode} />
            ) : null}
          </div>
          {batchData.notes && (
            <div className="rounded-lg border border-border bg-muted/25 px-4 py-3">
              <p className="text-xs text-muted-foreground">Catatan</p>
              <p className="mt-1 text-sm">{batchData.notes}</p>
            </div>
          )}

          {/* Tombol aksi */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleExportCsv}
              disabled={isPending || batchData.status === "cancelled"}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            {isAdmin && batchData.status !== "cancelled" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setEditorOpen(true)}
                  disabled={isPending}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Jumlah
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Batalkan Batch
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabel Nomor Sertifikat */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">
            Daftar Nomor Sertifikat{" "}
            <span className="text-muted-foreground font-normal">
              ({batchData.items.length} nomor)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">No.</TableHead>
                  <TableHead>Nomor Sertifikat</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchData.items.map((item, idx) => (
                  <TableRow
                    key={item.id}
                    className={item.status === "cancelled" ? "opacity-50" : ""}
                  >
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">{item.fullNumber}</span>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {item.serialNumber}
                    </TableCell>
                    <TableCell>
                      <ItemStatusBadge status={item.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog edit jumlah */}
      <BatchQuantityEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        batchId={batchData.id}
        currentQuantity={batchData.quantityRequested}
        angkatan={batchData.angkatan}
        classTypeCode={batchData.classTypeCode}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
}
