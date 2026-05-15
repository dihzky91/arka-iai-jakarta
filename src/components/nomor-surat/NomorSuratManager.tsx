"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Files, Hash, Pencil, RotateCw } from "lucide-react";
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
  generateBulkNomorSurat,
  generateNomorSurat,
  type NomorSuratCounterRow,
  updateNomorSuratCounterPrefix,
} from "@/server/actions/nomor";
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
  role,
}: {
  initialData: NomorSuratCounterRow[];
  role: string | null;
}) {
  const [jenisSurat, setJenisSurat] = useState<string>("undangan");
  const [bulan, setBulan] = useState(currentMonthValue());
  const [tahun, setTahun] = useState(currentYearValue());
  const [jumlahBulk, setJumlahBulk] = useState("10");
  const [prefixOverride, setPrefixOverride] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPrefix, setEditingPrefix] = useState("");
  const [lastGenerated, setLastGenerated] = useState<{
    nomor: string;
    prefix: string;
    counter: number;
  } | null>(null);
  const [lastBulkGenerated, setLastBulkGenerated] = useState<{
    nomorList: string[];
    prefix: string;
    startCounter: number;
    endCounter: number;
  } | null>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isBulkPending, startBulkTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();

  const canGenerate = role === "admin" || role === "pejabat";
  const canManagePrefix = role === "admin";

  const filteredData = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return initialData;

    return initialData.filter((row) =>
      [
        row.tahun,
        row.bulan,
        row.jenisSurat,
        row.prefix ?? "",
        JENIS_SURAT_LABEL[row.jenisSurat] ?? row.jenisSurat,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [initialData, query]);

  const totalCounter = initialData.reduce((sum, row) => sum + row.counter, 0);

  function handleGenerate() {
    startTransition(async () => {
      try {
        const result = await generateNomorSurat({
          jenisSurat,
          bulan: Number(bulan),
          tahun: Number(tahun),
          prefixOverride: prefixOverride || undefined,
        });

        setLastGenerated({
          nomor: result.nomor,
          prefix: result.prefix,
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
          prefixOverride: prefixOverride || undefined,
        });

        setLastGenerated({
          nomor: result.nomorList[result.nomorList.length - 1]!,
          prefix: result.prefix,
          counter: result.endCounter,
        });
        setLastBulkGenerated({
          nomorList: result.nomorList,
          prefix: result.prefix,
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

  function handleEditPrefix(row: NomorSuratCounterRow) {
    setEditingId(row.id);
    setEditingPrefix(row.prefix ?? "");
  }

  function handleSavePrefix(id: number) {
    startSaveTransition(async () => {
      const result = await updateNomorSuratCounterPrefix({
        id,
        prefix: editingPrefix,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Prefix nomor surat diperbarui.");
      setEditingId(null);
      setEditingPrefix("");
      router.refresh();
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

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Periode Tercatat"
          value={String(initialData.length)}
          hint="Counter per jenis surat dan periode"
        />
        <SummaryCard
          label="Nomor Terbit"
          value={String(totalCounter)}
          hint="Akumulasi counter yang sudah tergenerate"
        />
        <SummaryCard
          label="Prefix Aktif"
          value={String(new Set(initialData.map((item) => item.prefix ?? "-")).size)}
          hint="Variasi prefix yang tersimpan di riwayat"
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
                <label className="text-sm font-medium text-foreground">Prefix Override</label>
                <Input
                  value={prefixOverride}
                  onChange={(event) => setPrefixOverride(event.target.value)}
                  placeholder="Mis. DE/IAI-DKIJKT"
                />
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
                  <Badge variant="outline">Prefix: {lastGenerated.prefix}</Badge>
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
                        Prefix: {lastBulkGenerated.prefix}
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

        <Card className="rounded-[24px]">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Riwayat Counter</CardTitle>
                <CardDescription>
                  Pantau prefix, counter, dan periode yang sudah pernah dipakai.
                </CardDescription>
              </div>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari jenis surat, bulan, tahun, atau prefix..."
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
                          {JENIS_SURAT_LABEL[row.jenisSurat] ?? row.jenisSurat}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatBulanRomawi(row.bulan)} {row.tahun}
                        </p>
                      </div>
                      <Badge variant={row.counter > 0 ? "secondary" : "outline"}>
                        Counter {row.counter}
                      </Badge>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/25 px-4 py-3">
                      <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                        Prefix
                      </p>
                      {editingId === row.id ? (
                        <div className="mt-2 flex gap-2">
                          <Input
                            value={editingPrefix}
                            onChange={(event) => setEditingPrefix(event.target.value)}
                            disabled={!canManagePrefix || isSavePending}
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSavePrefix(row.id)}
                            disabled={!canManagePrefix || isSavePending || !editingPrefix.trim()}
                          >
                            <RotateCw className="h-4 w-4" />
                            Simpan
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="font-mono text-sm text-foreground">
                            {row.prefix ?? "IAI-DKIJKT"}
                          </p>
                          {canManagePrefix ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditPrefix(row)}
                            >
                              <Pencil className="h-4 w-4" />
                              Ubah
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      Format berikutnya akan mengikuti pola:
                      <p className="mt-2 font-mono text-foreground">
                        {row.counter + 1}/{row.prefix ?? "IAI-DKIJKT"}/{formatBulanRomawi(row.bulan)}/{row.tahun}
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
