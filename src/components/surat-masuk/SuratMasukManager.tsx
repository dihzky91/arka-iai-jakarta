"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Download, Eye, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteSuratMasuk,
  type SuratMasukRow,
} from "@/server/actions/suratMasuk";
import { formatTanggalPendek } from "@/lib/utils";
import { exportRowsToCsv } from "@/lib/csv";
import { SuratMasukDetailWorkspace, JENIS_SURAT_LABEL, StatusBadge } from "./SuratMasukDetailWorkspace";
import { SuratMasukForm } from "./SuratMasukForm";
import type {
  DisposisiRecipientOption,
  DisposisiTimelineRow,
} from "@/server/actions/disposisi";

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: SuratMasukRow };

type DetailState = { open: false } | { open: true; row: SuratMasukRow };

interface SuratMasukManagerProps {
  initialData: SuratMasukRow[];
  timeline: DisposisiTimelineRow[];
  recipients: DisposisiRecipientOption[];
  role: string | null;
}

export function SuratMasukManager({
  initialData,
  timeline,
  recipients,
  role,
}: SuratMasukManagerProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [detailState, setDetailState] = useState<DetailState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<SuratMasukRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const canManage = role === "admin" || role === "staff";
  const canDelete = role === "admin";
  const canCreateDisposisi = role === "admin" || role === "pejabat";

  const timelineBySuratId = useMemo(() => {
    return timeline.reduce<Record<string, DisposisiTimelineRow[]>>((acc, item) => {
      if (!acc[item.suratMasukId]) acc[item.suratMasukId] = [];
      acc[item.suratMasukId]!.push(item);
      return acc;
    }, {});
  }, [timeline]);

  const columns = useMemo<ColumnDef<SuratMasukRow>[]>(() => {
    return [
      {
        id: "index",
        header: "No.",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.index + 1}
          </span>
        ),
      },
      {
        id: "perihal",
        header: "Perihal / Pengirim",
        accessorKey: "perihal",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium leading-tight">{row.original.perihal}</p>
            <p className="text-xs leading-tight text-muted-foreground">
              {row.original.pengirim}
            </p>
          </div>
        ),
      },
      {
        id: "nomor",
        header: "Agenda / Surat Asal",
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p className="font-medium text-foreground">
              {row.original.nomorAgenda ?? "-"}
            </p>
            <p className="text-muted-foreground">
              {row.original.nomorSuratAsal ?? "-"}
            </p>
          </div>
        ),
      },
      {
        id: "tanggal",
        header: "Tanggal",
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p className="text-foreground">
              Surat: {formatTanggalPendek(row.original.tanggalSurat)}
            </p>
            <p className="text-muted-foreground">
              Terima: {formatTanggalPendek(row.original.tanggalDiterima)}
            </p>
          </div>
        ),
      },
      {
        id: "jenis",
        header: "Jenis",
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-xs">
            {JENIS_SURAT_LABEL[row.original.jenisSurat] ?? row.original.jenisSurat}
          </Badge>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "disposisi",
        header: "Disposisi",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {timelineBySuratId[row.original.id]?.length ?? 0} item
          </span>
        ),
      },
      {
        id: "file",
        header: "File",
        cell: ({ row }) =>
          row.original.fileUrl ? (
            <a
              href={row.original.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary underline underline-offset-2"
            >
              Buka File
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Belum ada</span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
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
                  onClick={() => setDetailState({ open: true, row: row.original })}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Lihat Detail
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/surat-masuk/${row.original.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Buka Halaman Detail
                  </Link>
                </DropdownMenuItem>
                {canManage ? (
                  <DropdownMenuItem
                    onClick={() =>
                      setFormState({ open: true, mode: "edit", row: row.original })
                    }
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Ubah
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteTarget(row.original)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Hapus
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ];
  }, [canDelete, canManage, timelineBySuratId]);

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const result = await deleteSuratMasuk({ id: deleteTarget.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Surat masuk berhasil dihapus.");
      router.refresh();
      setDeleteTarget(null);
    });
  }

  function handleExportCsv() {
    exportRowsToCsv(
      initialData.map((row) => ({
        nomor_agenda: row.nomorAgenda ?? "",
        nomor_surat_asal: row.nomorSuratAsal ?? "",
        perihal: row.perihal,
        pengirim: row.pengirim,
        pengirim_alamat: row.pengirimAlamat ?? "",
        tanggal_surat: row.tanggalSurat,
        tanggal_diterima: row.tanggalDiterima,
        jenis_surat: JENIS_SURAT_LABEL[row.jenisSurat] ?? row.jenisSurat,
        status: row.status ?? "",
        isi_singkat: row.isiSingkat ?? "",
        file_url: row.fileUrl ?? "",
        dicatat_oleh: row.dicatatOlehNama ?? "",
        jumlah_disposisi: timelineBySuratId[row.id]?.length ?? 0,
      })),
      "arsip-surat-masuk.csv",
    );
    toast.success("CSV surat masuk berhasil diekspor.");
  }

  const processedCount = initialData.filter((item) => item.status === "diproses").length;
  const archivedCount = initialData.filter((item) => item.status === "diarsip").length;

  return (
    <>
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Surat Masuk"
            value={String(initialData.length)}
            hint="Arsip masuk yang sudah dicatat"
          />
          <SummaryCard
            label="Perlu Tindak Lanjut"
            value={String(
              initialData.filter((item) => item.status === "diterima").length,
            )}
            hint="Belum ada tindak lanjut"
          />
          <SummaryCard
            label="Sedang Diproses"
            value={String(processedCount)}
            hint="Sudah masuk alur disposisi"
          />
          <SummaryCard
            label="Diarsipkan"
            value={String(archivedCount)}
            hint="Sudah selesai dan ditutup"
          />
        </section>

        <Card className="rounded-[24px]">
          <CardContent className="pt-6">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-end">
              {canManage ? (
                <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
                  <Button
                    variant="outline"
                    onClick={handleExportCsv}
                    className="w-full sm:w-auto"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    onClick={() => setFormState({ open: true, mode: "create" })}
                    className="w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Input Surat Masuk
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={handleExportCsv} className="w-full sm:w-auto">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </div>
            <DataTable
              columns={columns}
              data={initialData}
              searchColumnId="perihal"
              searchPlaceholder="Cari perihal surat masuk..."
              emptyMessage="Belum ada surat masuk yang tercatat."
            />
          </CardContent>
        </Card>
      </div>

      <SuratMasukForm
        open={formState.open}
        onOpenChange={(open) => !open && setFormState({ open: false })}
        mode={formState.open ? formState.mode : "create"}
        initialData={
          formState.open && formState.mode === "edit" ? formState.row : null
        }
        onSuccess={(nextRow) => {
          if (detailState.open && detailState.row.id === nextRow.id) {
            setDetailState({ open: true, row: nextRow });
          }
          if (formState.open && formState.mode === "edit") {
            setFormState({ open: true, mode: "edit", row: nextRow });
          }
        }}
      />

      {detailState.open ? (
        <Dialog
          open={detailState.open}
          onOpenChange={(open) => !open && setDetailState({ open: false })}
        >
          <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-5xl sm:p-6">
            <DialogHeader>
              <DialogTitle>Detail Surat Masuk</DialogTitle>
              <DialogDescription>
                Tinjau data surat, pantau chain disposisi, dan teruskan ke penerima
                berikutnya bila diperlukan.
              </DialogDescription>
            </DialogHeader>
            <SuratMasukDetailWorkspace
              row={detailState.row}
              timeline={timelineBySuratId[detailState.row.id] ?? []}
              recipients={recipients}
              canManage={canManage}
              canCreateDisposisi={canCreateDisposisi}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Surat Masuk?</DialogTitle>
            <DialogDescription>
              Arsip{" "}
              <span className="font-medium text-foreground">{deleteTarget?.perihal}</span>{" "}
              akan dihapus permanen.
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
    </>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="gap-4 rounded-[24px] py-4 sm:py-5">
      <CardContent className="space-y-2">
        <p className="text-xs font-normal uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-semibold text-foreground sm:text-3xl">{value}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
