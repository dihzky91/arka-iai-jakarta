"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, ExternalLink, MoreHorizontal, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { formatTanggal } from "@/lib/utils";
import { exportRowsToCsv } from "@/lib/csv";
import {
  deleteSuratMou,
  generateQrSuratMou,
  type SuratMouRow,
} from "@/server/actions/suratMou";
import { SuratMouForm } from "./SuratMouForm";

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: SuratMouRow };

export function SuratMouManager({
  initialData,
  pejabatList,
  role,
}: {
  initialData: SuratMouRow[];
  pejabatList: Array<{ id: number; namaJabatan: string }>;
  role: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<SuratMouRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [qrLoadingId, setQrLoadingId] = useState<string | null>(null);
  const canManage = role === "admin" || role === "pejabat";
  const canDelete = role === "admin";

  const filteredData = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return initialData;

    return initialData.filter((row) =>
      [row.nomorMOU, row.perihal, row.pihakKedua, row.pejabatNama ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [initialData, query]);

  function handleDeleteConfirm() {
    if (!deleteTarget) return;

    startDeleteTransition(async () => {
      const result = await deleteSuratMou({ id: deleteTarget.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`Surat MOU ${deleteTarget.nomorMOU} dihapus.`);
      setDeleteTarget(null);
      router.refresh();
    });
  }

  async function handleGenerateQr(row: SuratMouRow) {
    setQrLoadingId(row.id);
    try {
      const result = await generateQrSuratMou({ id: row.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("QR verifikasi Surat MOU berhasil dibuat.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menggenerate QR verifikasi.",
      );
    } finally {
      setQrLoadingId(null);
    }
  }

  async function handleCopy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} berhasil disalin.`);
    } catch {
      toast.error(`Gagal menyalin ${label.toLowerCase()}.`);
    }
  }

  function handleExportCsv() {
    exportRowsToCsv(
      initialData.map((row) => ({
        nomor_mou: row.nomorMOU,
        perihal: row.perihal,
        pihak_kedua: row.pihakKedua,
        pihak_kedua_alamat: row.pihakKeduaAlamat ?? "",
        tanggal_mou: row.tanggalMOU,
        tanggal_berlaku: row.tanggalBerlaku ?? "",
        tanggal_berakhir: row.tanggalBerakhir ?? "",
        nilai_kerjasama: row.nilaiKerjasama ?? "",
        pejabat: row.pejabatNama ?? "",
        file_url: row.fileUrl ?? "",
        qr_verifikasi: row.qrCodeUrl ?? "",
        dibuat_oleh: row.dibuatOlehNama ?? "",
      })),
      "arsip-surat-mou.csv",
    );
    toast.success("CSV surat MOU berhasil diekspor.");
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total MOU" value={String(initialData.length)} hint="Data Memorandum of Understanding yang tercatat" />
        <SummaryCard label="QR Tersedia" value={String(initialData.filter((item) => item.qrCodeUrl).length)} hint="Siap diverifikasi publik" />
        <SummaryCard label="Dokumen Terlampir" value={String(initialData.filter((item) => item.fileUrl).length)} hint="Sudah memiliki file dokumen" />
      </section>

      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Surat MOU</CardTitle>
              <CardDescription>
                Kelola nomor MOU, pihak kedua, metadata kerjasama, file dokumen, dan QR verifikasi.
              </CardDescription>
            </div>
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleExportCsv}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button onClick={() => setFormState({ open: true, mode: "create" })}>
                  <Plus className="h-4 w-4" />
                  Tambah MOU
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={handleExportCsv}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            )}
          </div>
          <div className="pt-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nomor MOU, perihal, pihak kedua, atau pejabat..."
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          {filteredData.length ? (
            filteredData.map((row) => {
              const verificationUrl = `/verifikasi/surat-mou/${row.id}`;
              return (
                <Card key={row.id} className="rounded-[24px] border border-border shadow-none">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-medium text-primary">{row.nomorMOU}</p>
                        <p className="mt-2 font-medium text-foreground">{row.perihal}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{formatTanggal(row.tanggalMOU)}</p>
                      </div>
                      {canManage ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Aksi</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setFormState({ open: true, mode: "edit", row })}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Ubah
                            </DropdownMenuItem>
                            {canDelete ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Hapus
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{row.pejabatNama ?? "Tanpa pejabat"}</Badge>
                      <Badge variant={row.qrCodeUrl ? "secondary" : "outline"}>
                        {row.qrCodeUrl ? "QR Tersedia" : "QR Belum Ada"}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Pihak kedua: {row.pihakKedua}</p>
                      <p>Alamat pihak kedua: {row.pihakKeduaAlamat ?? "-"}</p>
                      <p>Nilai kerjasama: {row.nilaiKerjasama ?? "-"}</p>
                    </div>

                    {row.qrCodeUrl ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 p-3">
                        <img
                          src={row.qrCodeUrl}
                          alt={`QR ${row.nomorMOU}`}
                          className="h-16 w-16 rounded-md border bg-white p-1"
                        />
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => window.open(verificationUrl, "_blank", "noopener,noreferrer")}>
                              <ExternalLink className="h-4 w-4" />
                              Verifikasi
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleCopy(verificationUrl, "Link verifikasi")}>
                              <Copy className="h-4 w-4" />
                              Salin Link
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {canManage ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerateQr(row)}
                          disabled={qrLoadingId === row.id}
                        >
                          <QrCode className="h-4 w-4" />
                          {qrLoadingId === row.id
                            ? "Menggenerate..."
                            : row.qrCodeUrl
                              ? "Generate Ulang QR"
                              : "Generate QR"}
                        </Button>
                      ) : null}
                      {row.fileUrl ? (
                        <Button size="sm" variant="outline" onClick={() => window.open(row.fileUrl!, "_blank", "noopener,noreferrer")}>
                          <ExternalLink className="h-4 w-4" />
                          Buka File
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="md:col-span-2 rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center text-sm text-muted-foreground">
              Belum ada Surat MOU yang cocok dengan pencarian.
            </div>
          )}
        </CardContent>
      </Card>

      <SuratMouForm
        open={formState.open}
        onOpenChange={(open) => !open && setFormState({ open: false })}
        mode={formState.open ? formState.mode : "create"}
        initialData={formState.open && formState.mode === "edit" ? formState.row : null}
        pejabatList={pejabatList}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Surat MOU?</DialogTitle>
            <DialogDescription>
              Dokumen <span className="font-medium text-foreground">{deleteTarget?.nomorMOU}</span> akan dihapus dari sistem.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Batal
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="rounded-[24px] py-5">
      <CardContent className="space-y-2">
        <p className="text-xs font-normal tracking-[0.2em] text-muted-foreground uppercase">{label}</p>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
