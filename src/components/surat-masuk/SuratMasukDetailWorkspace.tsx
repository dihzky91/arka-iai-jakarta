"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, FileText, MailPlus, Pencil } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createDisposisi,
  type DisposisiRecipientOption,
  type DisposisiTimelineRow,
} from "@/server/actions/disposisi";
import {
  type SuratMasukRow,
  updateStatusSuratMasuk,
} from "@/server/actions/suratMasuk";
import { cn, formatTanggal } from "@/lib/utils";
import { SuratMasukForm } from "./SuratMasukForm";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  diterima: {
    label: "Diterima",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
  },
  diproses: {
    label: "Diproses",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  },
  diarsip: {
    label: "Diarsip",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  dibatalkan: {
    label: "Dibatalkan",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
  },
  belum_dibaca: {
    label: "Belum Dibaca",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
  },
  dibaca: {
    label: "Dibaca",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
  },
  selesai: {
    label: "Selesai",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
};

export const JENIS_SURAT_LABEL: Record<string, string> = {
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

export function StatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  const config = STATUS_CONFIG[status ?? "diterima"] ?? {
    label: status ?? "Tidak diketahui",
    className: "bg-secondary text-secondary-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

export function SuratMasukDetailWorkspace({
  row,
  timeline,
  recipients,
  canManage,
  canCreateDisposisi,
  showPageLink = true,
}: {
  row: SuratMasukRow;
  timeline: DisposisiTimelineRow[];
  recipients: DisposisiRecipientOption[];
  canManage: boolean;
  canCreateDisposisi: boolean;
  showPageLink?: boolean;
}) {
  const router = useRouter();
  const [isStatusPending, startStatusTransition] = useTransition();
  const [isSubmitPending, startSubmitTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [localRow, setLocalRow] = useState(row);
  const [localTimeline, setLocalTimeline] = useState(timeline);
  const [kepadaUserId, setKepadaUserId] = useState<string>("");
  const [instruksi, setInstruksi] = useState("");
  const [catatan, setCatatan] = useState("");
  const [batasWaktu, setBatasWaktu] = useState("");
  const [parentDisposisiId, setParentDisposisiId] = useState<string>("");
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null);

  const timelineMap = useMemo(() => {
    return Object.fromEntries(localTimeline.map((item) => [item.id, item]));
  }, [localTimeline]);

  useEffect(() => {
    setLocalRow(row);
  }, [row]);

  useEffect(() => {
    setLocalTimeline(timeline);
  }, [timeline]);

  useEffect(() => {
    setKepadaUserId("");
    setInstruksi("");
    setCatatan("");
    setBatasWaktu("");
    setParentDisposisiId("");
    setSelectedTimelineId(null);
  }, [localRow.id]);

  function handleStatusChange(status: "diproses" | "diarsip" | "diterima") {
    startStatusTransition(async () => {
      const previousRow = localRow;
      setLocalRow((current) => ({
        ...current,
        status,
      }));

      const result = await updateStatusSuratMasuk({ id: localRow.id, status });
      if (!result.ok) {
        setLocalRow(previousRow);
        toast.error(result.error);
        return;
      }
      toast.success("Status surat masuk berhasil diperbarui.");
      router.refresh();
    });
  }

  function handleCreateDisposisi() {
    if (!kepadaUserId) {
      toast.error("Pilih penerima disposisi terlebih dahulu.");
      return;
    }

    startSubmitTransition(async () => {
      try {
        const now = new Date();
        const selectedRecipient =
          recipients.find((item) => item.id === kepadaUserId) ?? null;
        const optimisticId = `optimistic-${crypto.randomUUID()}`;
        const previousTimeline = localTimeline;

        setLocalTimeline((current) => [
          ...current,
          {
            id: optimisticId,
            suratMasukId: localRow.id,
            dariUserId: localRow.dicatatOleh ?? "current-user",
            dariNama: localRow.dicatatOlehNama ?? "Pengirim",
            kepadaUserId,
            kepadaNama: selectedRecipient?.namaLengkap ?? "Penerima",
            catatan: catatan || null,
            instruksi: instruksi || null,
            batasWaktu: batasWaktu || null,
            status: "belum_dibaca",
            tanggalDisposisi: now,
            tanggalDibaca: null,
            tanggalSelesai: null,
            parentDisposisiId: parentDisposisiId || null,
            suratPerihal: localRow.perihal,
            suratPengirim: localRow.pengirim,
          },
        ]);
        setLocalRow((current) =>
          current.status === "diterima"
            ? { ...current, status: "diproses" }
            : current,
        );

        const result = await createDisposisi({
          suratMasukId: localRow.id,
          kepadaUserId,
          instruksi: instruksi || undefined,
          catatan: catatan || undefined,
          batasWaktu: batasWaktu || undefined,
          parentDisposisiId: parentDisposisiId || undefined,
        });

        if (!result.ok) {
          setLocalTimeline(previousTimeline);
          setLocalRow(row);
          toast.error("Disposisi gagal dibuat.");
          return;
        }

        toast.success("Disposisi berhasil dibuat.");
        router.refresh();
        setKepadaUserId("");
        setInstruksi("");
        setCatatan("");
        setBatasWaktu("");
        setParentDisposisiId("");
        setSelectedTimelineId(null);
      } catch (error) {
        setLocalTimeline(timeline);
        setLocalRow(row);
        toast.error(
          error instanceof Error ? error.message : "Disposisi gagal dibuat.",
        );
      }
    });
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6">
        <div className="space-y-5 lg:space-y-6">
          <Card className="gap-4 rounded-[24px] py-4 sm:py-5">
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-medium text-foreground">
                    {localRow.perihal}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {localRow.pengirim}
                  </p>
                </div>
                <StatusBadge status={localRow.status} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem
                  label="Nomor Agenda"
                  value={localRow.nomorAgenda ?? "-"}
                />
                <DetailItem
                  label="Nomor Surat Asal"
                  value={localRow.nomorSuratAsal ?? "-"}
                />
                <DetailItem
                  label="Tanggal Surat"
                  value={formatTanggal(localRow.tanggalSurat)}
                />
                <DetailItem
                  label="Tanggal Diterima"
                  value={formatTanggal(localRow.tanggalDiterima)}
                />
                <DetailItem
                  label="Jenis Surat"
                  value={
                    JENIS_SURAT_LABEL[localRow.jenisSurat] ?? localRow.jenisSurat
                  }
                />
                <DetailItem
                  label="Dicatat Oleh"
                  value={localRow.dicatatOlehNama ?? "-"}
                />
              </div>

              <DetailItem
                label="Alamat Pengirim"
                value={localRow.pengirimAlamat ?? "-"}
                multiline
              />
              <DetailItem
                label="Isi Singkat"
                value={localRow.isiSingkat ?? "-"}
                multiline
              />

              <div className="grid gap-2 sm:flex sm:flex-wrap">
                {showPageLink ? (
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href={`/surat-masuk/${localRow.id}`}>
                      <Eye className="h-4 w-4" />
                      Buka Halaman Detail
                    </Link>
                  </Button>
                ) : null}
                {localRow.fileUrl ? (
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <a href={localRow.fileUrl} target="_blank" rel="noreferrer">
                      <FileText className="h-4 w-4" />
                      Buka File
                    </a>
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    variant="outline"
                    onClick={() => setFormOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <Pencil className="h-4 w-4" />
                    Ubah Surat
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("diproses")}
                  disabled={isStatusPending}
                  className="w-full sm:w-auto"
                >
                  Tandai Diproses
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("diarsip")}
                  disabled={isStatusPending}
                  className="w-full sm:w-auto"
                >
                  Tandai Diarsip
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4 rounded-[24px] py-4 sm:py-5">
            <CardHeader className="pb-0">
              <CardTitle>Timeline Disposisi</CardTitle>
              <CardDescription>
                Urutan disposisi yang sudah dibuat untuk surat ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {localTimeline.length ? (
                localTimeline.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border bg-muted/20 p-3 sm:p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-foreground">
                          {item.dariNama ?? "Pengirim"}{" "}
                          <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                          {item.kepadaNama ?? "Penerima"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.tanggalDisposisi
                            ? formatTanggal(item.tanggalDisposisi)
                            : "-"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={item.status} />
                        {canCreateDisposisi ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setParentDisposisiId(item.id);
                              setSelectedTimelineId(item.id);
                            }}
                            className="shrink-0"
                          >
                            <MailPlus className="h-4 w-4" />
                            Teruskan
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {item.parentDisposisiId ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Turunan dari disposisi ke{" "}
                        {timelineMap[item.parentDisposisiId]?.kepadaNama ??
                          "rantai sebelumnya"}
                        .
                      </p>
                    ) : null}

                    {item.instruksi ? (
                      <p className="mt-3 text-sm text-foreground">
                        Instruksi: {item.instruksi}
                      </p>
                    ) : null}
                    {item.catatan ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Catatan: {item.catatan}
                      </p>
                    ) : null}
                    {item.batasWaktu ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Batas waktu: {formatTanggal(item.batasWaktu)}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
                  Belum ada disposisi untuk surat ini.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="gap-4 rounded-[24px] py-4 sm:py-5">
          <CardHeader className="pb-0">
            <CardTitle>Buat Disposisi</CardTitle>
            <CardDescription>
              Kirim surat ini ke penerima berikutnya. Jika ingin membuat chain,
              pilih item timeline sebagai parent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canCreateDisposisi ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="kepada-user">Kepada</Label>
                  <Select value={kepadaUserId} onValueChange={setKepadaUserId}>
                    <SelectTrigger id="kepada-user" className="w-full">
                      <SelectValue placeholder="Pilih penerima disposisi" />
                    </SelectTrigger>
                    <SelectContent>
                      {recipients.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.namaLengkap}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent-disposisi">Parent Chain</Label>
                  <Select
                    value={parentDisposisiId || "__none__"}
                    onValueChange={(value) => {
                      const nextValue = value === "__none__" ? "" : value;
                      setParentDisposisiId(nextValue);
                      setSelectedTimelineId(nextValue || null);
                    }}
                  >
                    <SelectTrigger id="parent-disposisi" className="w-full">
                      <SelectValue placeholder="Opsional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Tanpa parent</SelectItem>
                      {localTimeline.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.dariNama ?? "Pengirim"} {"->"}{" "}
                          {item.kepadaNama ?? "Penerima"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTimelineId ? (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 sm:p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
                      Parent Terpilih
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {timelineMap[selectedTimelineId]?.dariNama ?? "Pengirim"}{" "}
                      <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                      {timelineMap[selectedTimelineId]?.kepadaNama ?? "Penerima"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {timelineMap[selectedTimelineId]?.instruksi ??
                        "Tidak ada instruksi pada parent ini."}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="instruksi">Instruksi</Label>
                  <Textarea
                    id="instruksi"
                    rows={4}
                    value={instruksi}
                    onChange={(event) => setInstruksi(event.target.value)}
                    placeholder="Instruksi utama untuk penerima"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="catatan">Catatan</Label>
                  <Textarea
                    id="catatan"
                    rows={3}
                    value={catatan}
                    onChange={(event) => setCatatan(event.target.value)}
                    placeholder="Catatan tambahan"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batas-waktu">Batas Waktu</Label>
                  <Input
                    id="batas-waktu"
                    type="date"
                    value={batasWaktu}
                    onChange={(event) => setBatasWaktu(event.target.value)}
                  />
                </div>

                <Button
                  onClick={handleCreateDisposisi}
                  disabled={isSubmitPending}
                  className="w-full sm:w-auto"
                >
                  <MailPlus className="h-4 w-4" />
                  {isSubmitPending ? "Mengirim..." : "Kirim Disposisi"}
                </Button>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-sm text-muted-foreground">
                Hanya `admin` atau `pejabat` yang dapat membuat disposisi baru.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SuratMasukForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="edit"
        initialData={localRow}
        onSuccess={(nextRow) => setLocalRow(nextRow)}
      />
    </>
  );
}

function DetailItem({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-normal uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm text-foreground",
          multiline && "whitespace-pre-wrap leading-6",
        )}
      >
        {value}
      </p>
    </div>
  );
}
