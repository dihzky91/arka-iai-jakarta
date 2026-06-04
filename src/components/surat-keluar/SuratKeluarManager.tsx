"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Hash,
  Download,
  Files,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { SuratKeluarForm } from "./SuratKeluarForm";
import {
  SuratKeluarStepper,
  STATUS_CONFIG,
  JENIS_SURAT_LABEL,
} from "./SuratKeluarStepper";
import {
  bulkAssignNomorSuratKeluar,
  deleteSuratKeluar,
} from "@/server/actions/suratKeluar";
import type {
  SuratKeluarRow,
  PejabatOption,
  DivisiOption,
} from "@/server/actions/suratKeluar";
import {
  cn,
  formatTanggalPendek,
  formatTanggalWaktuJakarta,
  parseIsoDateInJakarta,
} from "@/lib/utils";
import { exportRowsToCsv } from "@/lib/csv";

interface SuratKeluarManagerProps {
  initialData: SuratKeluarRow[];
  pejabatList: PejabatOption[];
  divisiList: DivisiOption[];
  role: string | null;
  defaultJenisFilter?: string;
}

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: SuratKeluarRow };

type DetailState = { open: false } | { open: true; row: SuratKeluarRow };

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-secondary text-secondary-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}

function NomorSuratCell({
  row,
  canGenerate,
  onOpenDetail,
}: {
  row: SuratKeluarRow;
  canGenerate: boolean;
  onOpenDetail: () => void;
}) {
  if (row.nomorSurat) {
    return (
      <span className="font-mono text-xs font-medium text-primary">
        {row.nomorSurat}
      </span>
    );
  }

  if (canGenerate && row.status === "pengarsipan") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-6 gap-1 px-2 text-xs"
        onClick={onOpenDetail}
      >
        <Hash className="h-3 w-3" />
        Generate No.
      </Button>
    );
  }

  return <span className="text-muted-foreground text-xs">-</span>;
}

function OptionalText({ value }: { value: string | null | undefined }) {
  return value ? (
    <span className="text-sm text-foreground">{value}</span>
  ) : (
    <span className="text-muted-foreground text-xs">-</span>
  );
}

export function SuratKeluarManager({
  initialData,
  pejabatList,
  divisiList,
  role,
  defaultJenisFilter,
}: SuratKeluarManagerProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [detailState, setDetailState] = useState<DetailState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<SuratKeluarRow | null>(null);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isBulkAssigning, startBulkAssignTransition] = useTransition();
  const [jenisFilter, setJenisFilter] = useState<string | null>(
    defaultJenisFilter === "keputusan" || defaultJenisFilter === "mou"
      ? defaultJenisFilter
      : null,
  );
  const filteredData = useMemo(
    () => (jenisFilter ? initialData.filter((row) => row.jenisSurat === jenisFilter) : initialData),
    [initialData, jenisFilter],
  );

  const canCreate = role === "admin" || role === "pejabat" || role === "staff";
  const canDelete = role === "admin";
  const canGenerate = role === "admin" || role === "pejabat";
  const bulkAssignableRows = useMemo(
    () =>
      initialData
        .filter((row) => !row.nomorSurat && row.status !== "selesai" && row.status !== "dibatalkan")
        .sort((a, b) => {
          const tanggalCompare =
            parseIsoDateInJakarta(a.tanggalSurat).getTime() -
            parseIsoDateInJakarta(b.tanggalSurat).getTime();
          if (tanggalCompare !== 0) return tanggalCompare;

          const createdCompare =
            (a.createdAt ? new Date(a.createdAt).getTime() : 0) -
            (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          if (createdCompare !== 0) return createdCompare;

          return a.id.localeCompare(b.id);
        }),
    [initialData],
  );

  const columns = useMemo<ColumnDef<SuratKeluarRow>[]>(() => {
    return [
      {
        id: "index",
        header: "No.",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {row.index + 1}
          </span>
        ),
        size: 48,
      },
      {
        id: "perihal",
        header: "Perihal / Tujuan",
        accessorKey: "perihal",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium leading-tight">{row.original.perihal}</p>
            <p className="text-xs leading-tight text-muted-foreground">
              {row.original.tujuan}
            </p>
            {row.original.prosesViaSimpeg ? (
              <Badge variant="outline" className="mt-1 gap-1 text-[11px]">
                <Building2 className="h-3 w-3" />
                SIMPEG
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "tujuanAlamat",
        header: "Alamat Tujuan",
        accessorKey: "tujuanAlamat",
        cell: ({ row }) => (
          <div className="max-w-[220px]">
            <OptionalText value={row.original.tujuanAlamat} />
          </div>
        ),
      },
      {
        id: "isiSingkat",
        header: "Isi Singkat",
        accessorKey: "isiSingkat",
        cell: ({ row }) => (
          <div className="max-w-[240px]">
            <OptionalText value={row.original.isiSingkat} />
          </div>
        ),
      },
      {
        id: "nomorSurat",
        header: "No. Surat",
        cell: ({ row }) => (
          <NomorSuratCell
            row={row.original}
            canGenerate={canGenerate}
            onOpenDetail={() =>
              setDetailState({ open: true, row: row.original })
            }
          />
        ),
      },
      {
        id: "tanggalSurat",
        header: "Tanggal",
        accessorKey: "tanggalSurat",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatTanggalPendek(row.original.tanggalSurat)}
          </span>
        ),
      },
      {
        id: "jenisSurat",
        header: "Jenis",
        accessorKey: "jenisSurat",
        cell: ({ row }) => (
          <Badge variant="secondary" className="whitespace-nowrap text-xs">
            {JENIS_SURAT_LABEL[row.original.jenisSurat] ??
              row.original.jenisSurat}
          </Badge>
        ),
      },
      {
        id: "divisi",
        header: "Divisi",
        accessorKey: "divisiNama",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.divisiNama ?? "-"}
          </span>
        ),
      },
      {
        id: "pembuat",
        header: "Pembuat",
        accessorKey: "dibuatOlehNama",
        cell: ({ row }) => <OptionalText value={row.original.dibuatOlehNama} />,
      },
      {
        id: "draft",
        header: "Draft",
        accessorKey: "fileDraftUrl",
        cell: ({ row }) =>
          row.original.fileDraftUrl ? (
            <a
              href={row.original.fileDraftUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary underline underline-offset-2"
            >
              Buka Draft
            </a>
          ) : (
            <span className="text-muted-foreground text-xs">Belum ada</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status ?? "draft"} />
        ),
      },
      {
        id: "catatanReviu",
        header: "Catatan Reviu",
        accessorKey: "catatanReviu",
        cell: ({ row }) => (
          <div className="max-w-[220px]">
            {row.original.catatanReviu ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <p className="whitespace-pre-wrap">{row.original.catatanReviu}</p>
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                  {formatTanggalWaktuJakarta(row.original.catatanReviuAt)}
                </p>
              </div>
            ) : (
              <OptionalText value={row.original.catatanReviu} />
            )}
          </div>
        ),
      },
      {
        id: "timestamps",
        header: "Dibuat / Diubah",
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p className="text-foreground">
              {row.original.createdAt
                ? formatTanggalPendek(row.original.createdAt)
                : "-"}
            </p>
            <p className="text-muted-foreground">
              Update:{" "}
              {row.original.updatedAt
                ? formatTanggalPendek(row.original.updatedAt)
                : "-"}
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const r = row.original;
          const isDraft = r.status === "draft";
          const isDraftOrCancelled =
            r.status === "draft" || r.status === "dibatalkan";

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
                    onClick={() => setDetailState({ open: true, row: r })}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Lihat Detail
                  </DropdownMenuItem>

                  {isDraft ? (
                    <DropdownMenuItem
                      onClick={() =>
                        setFormState({ open: true, mode: "edit", row: r })
                      }
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  ) : null}

                  {canDelete && isDraftOrCancelled ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Hapus
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ];
  }, [canDelete, canGenerate]);

  function handleDeleteConfirm() {
    if (!deleteTarget) return;

    startDeleteTransition(async () => {
      const res = await deleteSuratKeluar({ id: deleteTarget.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success("Surat keluar berhasil dihapus.");
      setDeleteTarget(null);
    });
  }

  function handleExportCsv() {
    exportRowsToCsv(
      initialData.map((row) => ({
        nomor_surat: row.nomorSurat ?? "",
        perihal: row.perihal,
        tujuan: row.tujuan,
        tujuan_alamat: row.tujuanAlamat ?? "",
        tanggal_surat: row.tanggalSurat,
        jenis_surat: JENIS_SURAT_LABEL[row.jenisSurat] ?? row.jenisSurat,
        isi_singkat: row.isiSingkat ?? "",
        status: STATUS_CONFIG[row.status ?? "draft"]?.label ?? (row.status ?? "draft"),
        proses: row.prosesViaSimpeg ? "SIMPEG IAI" : "Arka",
        divisi: row.divisiNama ?? "",
        pembuat: row.dibuatOlehNama ?? "",
        pejabat: row.pejabatNama ?? "",
        file_draft: row.fileDraftUrl ?? "",
        file_final: row.fileFinalUrl ?? "",
        lampiran: row.lampiranUrl ?? "",
        qr_verifikasi: row.qrCodeUrl ?? "",
        catatan_reviu: row.catatanReviu ?? "",
        tentang: row.tentang ?? "",
        tanggal_berlaku: row.tanggalBerlaku ?? "",
        tanggal_berakhir: row.tanggalBerakhir ?? "",
        pihak_kedua: row.pihakKedua ?? "",
        pihak_kedua_alamat: row.pihakKeduaAlamat ?? "",
        nilai_kerjasama: row.nilaiKerjasama ?? "",
      })),
      "arsip-surat-keluar.csv",
    );
    toast.success("CSV surat keluar berhasil diekspor.");
  }

  function handleBulkAssignNomor() {
    if (!bulkAssignableRows.length) return;

    startBulkAssignTransition(async () => {
      const result = await bulkAssignNomorSuratKeluar({
        ids: bulkAssignableRows.map((row) => row.id),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const nomorAwal = result.assigned[0]?.nomorSurat;
      const nomorAkhir = result.assigned[result.assigned.length - 1]?.nomorSurat;
      toast.success(
        result.assigned.length === 1
          ? `Nomor surat ${nomorAwal} berhasil digenerate.`
          : `${result.assigned.length} nomor surat berhasil digenerate${nomorAwal && nomorAkhir ? ` (${nomorAwal} s.d. ${nomorAkhir})` : "."}`,
      );
      setBulkAssignOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Card className="rounded-[24px]">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-end">
            {canCreate ? (
              <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
                <Button variant="outline" onClick={handleExportCsv} className="w-full sm:w-auto">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                {canGenerate && bulkAssignableRows.length ? (
                  <Button
                    variant="outline"
                    onClick={() => setBulkAssignOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <Files className="h-4 w-4" />
                    Generate Nomor Massal ({bulkAssignableRows.length})
                  </Button>
                ) : null}
                <Button
                  onClick={() => setFormState({ open: true, mode: "create" })}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Buat Surat Keluar
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={handleExportCsv} className="w-full sm:w-auto">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            )}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              variant={jenisFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setJenisFilter(null)}
              className="rounded-full"
            >
              Semua
            </Button>
            <Button
              variant={jenisFilter === "keputusan" ? "default" : "outline"}
              size="sm"
              onClick={() => setJenisFilter("keputusan")}
              className="rounded-full"
            >
              SK
            </Button>
            <Button
              variant={jenisFilter === "mou" ? "default" : "outline"}
              size="sm"
              onClick={() => setJenisFilter("mou")}
              className="rounded-full"
            >
              MOU
            </Button>
          </div>
          <DataTable
            columns={columns}
            data={filteredData}
            searchColumnId="perihal"
            searchPlaceholder="Cari perihal surat..."
            emptyMessage="Belum ada surat keluar. Klik 'Buat Surat Keluar' untuk memulai."
          />
        </CardContent>
      </Card>

      <SuratKeluarForm
        open={formState.open}
        onOpenChange={(open) => {
          if (!open) setFormState({ open: false });
        }}
        mode={formState.open ? formState.mode : "create"}
        initialData={
          formState.open && formState.mode === "edit" ? formState.row : null
        }
        pejabatList={pejabatList}
        divisiList={divisiList}
      />

      {detailState.open ? (
        <SuratKeluarStepper
          open={detailState.open}
          onOpenChange={(open) => {
            if (!open) setDetailState({ open: false });
          }}
          row={detailState.row}
          role={role}
          onEditClick={() => {
            if (detailState.open) {
              setFormState({
                open: true,
                mode: "edit",
                row: detailState.row,
              });
            }
          }}
        />
      ) : null}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Surat Keluar?</DialogTitle>
            <DialogDescription>
              Surat{" "}
              <span className="font-medium text-foreground">
                &ldquo;{deleteTarget?.perihal}&rdquo;
              </span>{" "}
              akan dihapus permanen. Aksi ini tidak dapat dibatalkan.
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

      <Dialog
        open={bulkAssignOpen}
        onOpenChange={(open) => {
          if (!isBulkAssigning) setBulkAssignOpen(open);
        }}
      >
        <DialogContent className="max-w-[calc(100vw-1rem)] p-4 sm:max-w-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Generate Nomor Surat Massal?</DialogTitle>
            <DialogDescription>
              Sistem akan memproses {bulkAssignableRows.length} surat yang belum
              memiliki nomor surat. Urutan
              generate mengikuti tanggal surat tertua lebih dulu.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-border bg-muted/20 p-3">
            {bulkAssignableRows.map((row, index) => (
              <div
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {row.perihal}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.tujuan} · {formatTanggalPendek(row.tanggalSurat)} ·{" "}
                    {JENIS_SURAT_LABEL[row.jenisSurat] ?? row.jenisSurat}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  Pengarsipan
                </Badge>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkAssignOpen(false)}
              disabled={isBulkAssigning}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              onClick={handleBulkAssignNomor}
              disabled={isBulkAssigning}
              className="w-full sm:w-auto"
            >
              <Hash className="h-4 w-4" />
              {isBulkAssigning ? "Memproses..." : "Generate Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
