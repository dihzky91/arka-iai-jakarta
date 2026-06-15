"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Files, Hash, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  generateBulkNomorSurat,
  generateNomorSurat,
  type NomorSuratCounterRow,
} from "@/server/actions/nomor";
import {
  listKodeJenisSurat,
  createKodeJenisSurat,
  updateKodeJenisSurat,
  deleteKodeJenisSurat,
  type KodeJenisSuratRow,
} from "@/server/actions/kodeJenisSurat";
import { jenisSuratValues } from "@/lib/jenis-surat";
import {
  formatBulanRomawi,
  getCurrentMonthInJakarta,
  getCurrentYearInJakarta,
} from "@/lib/utils";

const JENIS_SURAT_LABEL: Record<string, string> = {
  undangan: "Undangan",
  pemberitahuan: "Pemberitahuan",
  permohonan: "Permohonan",
  keputusan: "Keputusan",
  mou: "MOU",
  balasan: "Balasan",
  edaran: "Edaran",
  keterangan: "Keterangan",
  tugas: "Tugas",
  invoice: "Invoice",
  lainnya: "Lainnya",
};

function currentMonthValue() {
  return String(getCurrentMonthInJakarta());
}

function currentYearValue() {
  return String(getCurrentYearInJakarta());
}

export function NomorSuratManager({
  initialData,
  initialKodeJenis,
  role,
}: {
  initialData: NomorSuratCounterRow[];
  initialKodeJenis: KodeJenisSuratRow[];
  role: string | null;
}) {
  const [jenisSurat, setJenisSurat] = useState<string>("undangan");
  const [bulan, setBulan] = useState(currentMonthValue());
  const [tahun, setTahun] = useState(currentYearValue());
  const [jumlahBulk, setJumlahBulk] = useState("10");
  const [query, setQuery] = useState("");
  const [lastGenerated, setLastGenerated] = useState<{
    nomor: string;
    kodeJenis: string | null;
    prefixOrganisasi: string;
    counter: number;
  } | null>(null);
  const [lastBulkGenerated, setLastBulkGenerated] = useState<{
    nomorList: string[];
    kodeJenis: string | null;
    prefixOrganisasi: string;
    startCounter: number;
    endCounter: number;
  } | null>(null);

  // Kode Jenis CRUD state
  const [kodeJenisList, setKodeJenisList] = useState(initialKodeJenis);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKode, setEditingKode] = useState<KodeJenisSuratRow | null>(null);
  const [formJenisSurat, setFormJenisSurat] = useState("");
  const [formKode, setFormKode] = useState("");
  const [formKeterangan, setFormKeterangan] = useState("");

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isBulkPending, startBulkTransition] = useTransition();
  const [isKodePending, startKodeTransition] = useTransition();

  const canGenerate = role === "admin" || role === "pejabat";
  const canManageKode = role === "admin";

  const filteredData = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return initialData;

    return initialData.filter((row) =>
      [row.tahun, row.bulan, formatBulanRomawi(row.bulan)]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [initialData, query]);

  const totalCounter = initialData.reduce((sum, row) => sum + row.counter, 0);

  // Available jenis surat that don't have a kode yet
  const usedJenisSurat = new Set(kodeJenisList.map((k) => k.jenisSurat));
  const availableJenisSurat = jenisSuratValues.filter((j) => !usedJenisSurat.has(j));

  function handleGenerate() {
    startTransition(async () => {
      try {
        const result = await generateNomorSurat({
          jenisSurat,
          bulan: Number(bulan),
          tahun: Number(tahun),
        });

        setLastGenerated({
          nomor: result.nomor,
          kodeJenis: result.kodeJenis,
          prefixOrganisasi: result.prefixOrganisasi,
          counter: result.counter,
        });
        setLastBulkGenerated(null);
        router.refresh();
        toast.success("Nomor surat berhasil digenerate.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal menggenerate nomor surat.",
        );
      }
    });
  }

  function handleGenerateBulk() {
    startBulkTransition(async () => {
      try {
        const result = await generateBulkNomorSurat({
          jenisSurat,
          bulan: Number(bulan),
          tahun: Number(tahun),
          jumlah: Number(jumlahBulk),
        });

        setLastGenerated({
          nomor: result.nomorList[result.nomorList.length - 1]!,
          kodeJenis: result.kodeJenis,
          prefixOrganisasi: result.prefixOrganisasi,
          counter: result.endCounter,
        });
        setLastBulkGenerated({
          nomorList: result.nomorList,
          kodeJenis: result.kodeJenis,
          prefixOrganisasi: result.prefixOrganisasi,
          startCounter: result.startCounter,
          endCounter: result.endCounter,
        });
        router.refresh();
        toast.success(`Bulk ${result.jumlah} nomor surat berhasil digenerate.`);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal menggenerate bulk nomor surat.",
        );
      }
    });
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Nomor surat berhasil disalin.");
    } catch {
      toast.error("Gagal menyalin nomor surat.");
    }
  }

  async function handleCopyBulk() {
    if (!lastBulkGenerated?.nomorList.length) return;

    try {
      await navigator.clipboard.writeText(lastBulkGenerated.nomorList.join("\n"));
      toast.success("Daftar bulk nomor surat berhasil disalin.");
    } catch {
      toast.error("Gagal menyalin daftar bulk nomor surat.");
    }
  }

  // ─── Kode Jenis CRUD handlers ────────────────────────────────────────────

  function openCreateDialog() {
    setEditingKode(null);
    setFormJenisSurat(availableJenisSurat[0] ?? "");
    setFormKode("");
    setFormKeterangan("");
    setDialogOpen(true);
  }

  function openEditDialog(row: KodeJenisSuratRow) {
    setEditingKode(row);
    setFormJenisSurat(row.jenisSurat);
    setFormKode(row.kode);
    setFormKeterangan(row.keterangan ?? "");
    setDialogOpen(true);
  }

  function handleSaveKode() {
    startKodeTransition(async () => {
      try {
        if (editingKode) {
          const result = await updateKodeJenisSurat({
            id: editingKode.id,
            kode: formKode,
            keterangan: formKeterangan,
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Kode jenis surat diperbarui.");
        } else {
          const result = await createKodeJenisSurat({
            jenisSurat: formJenisSurat,
            kode: formKode,
            keterangan: formKeterangan,
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Kode jenis surat ditambahkan.");
        }
        setDialogOpen(false);
        const updated = await listKodeJenisSurat();
        setKodeJenisList(updated);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal menyimpan kode jenis surat.",
        );
      }
    });
  }

  function handleDeleteKode(row: KodeJenisSuratRow) {
    startKodeTransition(async () => {
      try {
        const result = await deleteKodeJenisSurat({ id: row.id });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(`Kode untuk "${JENIS_SURAT_LABEL[row.jenisSurat] ?? row.jenisSurat}" dihapus.`);
        const updated = await listKodeJenisSurat();
        setKodeJenisList(updated);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal menghapus kode jenis surat.",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Periode Tercatat"
          value={String(initialData.length)}
          hint="Counter per bulan (unified)"
        />
        <SummaryCard
          label="Nomor Terbit"
          value={String(totalCounter)}
          hint="Akumulasi counter yang sudah tergenerate"
        />
        <SummaryCard
          label="Kode Jenis Aktif"
          value={String(kodeJenisList.length)}
          hint="Jenis surat yang sudah punya kode"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-[24px]">
          <CardHeader className="border-b border-border">
            <CardTitle>Generator Nomor Surat</CardTitle>
            <CardDescription>
              Digunakan untuk kebutuhan operasional manual dan pengecekan format per periode.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Jenis Surat</label>
                <Select value={jenisSurat} onValueChange={setJenisSurat}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {jenisSuratValues.map((value) => (
                      <SelectItem key={value} value={value}>
                        {JENIS_SURAT_LABEL[value] ?? value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Bulan</label>
                <Select value={bulan} onValueChange={setBulan}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, idx) => idx + 1).map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value} ({formatBulanRomawi(value)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Tahun</label>
                <Input
                  type="number"
                  min={2020}
                  max={2100}
                  value={tahun}
                  onChange={(event) => setTahun(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Jumlah Bulk</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={jumlahBulk}
                  onChange={(event) => setJumlahBulk(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGenerate} disabled={!canGenerate || isPending || isBulkPending}>
                <Hash className="h-4 w-4" />
                {isPending ? "Menggenerate..." : "Generate Nomor Surat"}
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerateBulk}
                disabled={!canGenerate || isPending || isBulkPending}
              >
                <Files className="h-4 w-4" />
                {isBulkPending ? "Menggenerate Bulk..." : "Generate Bulk"}
              </Button>
            </div>

            {!canGenerate ? (
              <p className="text-sm text-muted-foreground">
                Hanya admin atau pejabat yang dapat menggenerate nomor surat dari modul ini.
              </p>
            ) : null}

            {lastGenerated ? (
              <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
                <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                  Nomor Terakhir Digenerate
                </p>
                <p className="mt-3 font-mono text-lg font-semibold text-foreground">
                  {lastGenerated.nomor}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline">Counter: {lastGenerated.counter}</Badge>
                  <Badge variant="outline">Kode: {lastGenerated.kodeJenis ?? "-"}</Badge>
                  <Badge variant="outline">Prefix: {lastGenerated.prefixOrganisasi}</Badge>
                </div>
                <div className="mt-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(lastGenerated.nomor)}
                  >
                    <Copy className="h-4 w-4" />
                    Salin Nomor
                  </Button>
                </div>
              </div>
            ) : null}

            {lastBulkGenerated ? (
              <div className="rounded-3xl border border-border bg-muted/25 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                      Hasil Bulk Terakhir
                    </p>
                    <p className="mt-3 text-sm text-foreground">
                      Counter {lastBulkGenerated.startCounter} sampai {lastBulkGenerated.endCounter}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">
                        Total: {lastBulkGenerated.nomorList.length}
                      </Badge>
                      <Badge variant="outline">
                        Kode: {lastBulkGenerated.kodeJenis ?? "-"}
                      </Badge>
                      <Badge variant="outline">
                        Prefix: {lastBulkGenerated.prefixOrganisasi}
                      </Badge>
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={handleCopyBulk}>
                    <Copy className="h-4 w-4" />
                    Salin Semua
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={lastBulkGenerated.nomorList.join("\n")}
                  className="mt-4 min-h-48 font-mono text-sm"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Kode Jenis Surat CRUD */}
          <Card className="rounded-[24px]">
            <CardHeader className="border-b border-border">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Kode Jenis Surat</CardTitle>
                  <CardDescription>
                    Mapping jenis surat ke kode singkat yang muncul di nomor surat.
                  </CardDescription>
                </div>
                {canManageKode ? (
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={openCreateDialog}>
                        <Plus className="h-4 w-4" />
                        Tambah Kode
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingKode ? "Edit Kode Jenis Surat" : "Tambah Kode Jenis Surat"}
                        </DialogTitle>
                        <DialogDescription>
                          {editingKode
                            ? "Ubah kode singkat untuk jenis surat ini."
                            : "Pilih jenis surat dan tentukan kode singkatnya."}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Jenis Surat</label>
                          {editingKode ? (
                            <Input
                              value={JENIS_SURAT_LABEL[editingKode.jenisSurat] ?? editingKode.jenisSurat}
                              disabled
                            />
                          ) : (
                            <Select value={formJenisSurat} onValueChange={setFormJenisSurat}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableJenisSurat.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {JENIS_SURAT_LABEL[value] ?? value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Kode</label>
                          <Input
                            value={formKode}
                            onChange={(e) => setFormKode(e.target.value)}
                            placeholder="Mis. U, K, INV"
                            maxLength={20}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Keterangan{" "}
                            <span className="text-xs font-normal text-muted-foreground">(opsional)</span>
                          </label>
                          <Input
                            value={formKeterangan}
                            onChange={(e) => setFormKeterangan(e.target.value)}
                            placeholder="Mis. Undangan"
                            maxLength={200}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setDialogOpen(false)}
                        >
                          Batal
                        </Button>
                        <Button
                          onClick={handleSaveKode}
                          disabled={isKodePending || !formKode.trim()}
                        >
                          {isKodePending ? "Menyimpan..." : "Simpan"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {kodeJenisList.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {kodeJenisList.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between rounded-2xl border border-border bg-muted/25 px-4 py-3"
                    >
                      <div>
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {row.kode}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {JENIS_SURAT_LABEL[row.jenisSurat] ?? row.jenisSurat}
                        </p>
                      </div>
                      {canManageKode ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteKode(row)}
                            disabled={isKodePending}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center text-sm text-muted-foreground">
                  Belum ada kode jenis surat yang dikonfigurasi. Tambahkan terlebih dahulu.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Riwayat Counter */}
          <Card className="rounded-[24px]">
            <CardHeader className="border-b border-border">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Riwayat Counter</CardTitle>
                  <CardDescription>
                    Pantau counter dan periode yang sudah pernah dipakai.
                  </CardDescription>
                </div>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari bulan, tahun..."
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              {filteredData.length ? (
                filteredData.map((row) => (
                  <Card key={row.id} className="rounded-[24px] border border-border shadow-none">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {formatBulanRomawi(row.bulan)} {row.tahun}
                          </p>
                        </div>
                        <Badge variant={row.counter > 0 ? "secondary" : "outline"}>
                          Counter {row.counter}
                        </Badge>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Format berikutnya akan mengikuti pola:
                        <p className="mt-2 font-mono text-foreground">
                          {row.counter + 1}/&lt;kode&gt;/&lt;prefix&gt;/{formatBulanRomawi(row.bulan)}/{row.tahun}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="md:col-span-2 rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center text-sm text-muted-foreground">
                  Belum ada riwayat counter yang cocok dengan pencarian.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
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
    <Card className="rounded-[24px] py-5">
      <CardContent className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
