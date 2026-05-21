"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { setujuiSurat, tolakSurat } from "@/server/actions/suratKeluar";
import type { SuratKeluarReviewRow } from "@/server/actions/suratKeluar";
import { formatTanggal } from "@/lib/utils";
import {
  JENIS_SURAT_LABEL,
  STATUS_CONFIG,
} from "@/components/surat-keluar/SuratKeluarStepper";

type Props = {
  surat: SuratKeluarReviewRow;
  reviewerName: string;
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-secondary text-secondary-foreground",
  };

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export function SuratKeluarReviewPage({ surat, reviewerName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [catatan, setCatatan] = useState("");
  const status = surat.status ?? "draft";
  const canReview = status === "permohonan_persetujuan" || status === "reviu";
  const isPdf = surat.fileDraftUrl?.toLowerCase().includes(".pdf") ?? false;

  function afterSuccess(message: string) {
    toast.success(message);
    router.push("/surat-keluar");
    router.refresh();
  }

  function handleApprove() {
    startTransition(async () => {
      const result = await setujuiSurat({ id: surat.id });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal menyetujui surat.");
        return;
      }
      afterSuccess("Surat disetujui dan masuk tahap pengarsipan.");
    });
  }

  function handleRevision() {
    if (!catatan.trim()) {
      toast.error("Catatan revisi wajib diisi.");
      return;
    }

    startTransition(async () => {
      const result = await tolakSurat({
        id: surat.id,
        catatanReviu: catatan.trim(),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal mengirim revisi.");
        return;
      }
      afterSuccess("Catatan revisi dikirim ke pembuat surat.");
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/surat-keluar")}
            className="mb-2 px-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Approval Surat Keluar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Yth. {reviewerName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {surat.prosesViaSimpeg ? (
            <Badge variant="outline">SIMPEG IAI</Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
        <section className="space-y-4 rounded-lg border bg-background p-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Perihal
            </p>
            <p className="mt-1 text-lg font-semibold leading-snug">
              {surat.perihal}
            </p>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Pembuat</p>
              <p className="font-medium">{surat.dibuatOlehNama ?? "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tujuan</p>
              <p className="font-medium">{surat.tujuan}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tanggal</p>
              <p className="font-medium">{formatTanggal(surat.tanggalSurat)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Jenis</p>
              <p className="font-medium">
                {JENIS_SURAT_LABEL[surat.jenisSurat] ?? surat.jenisSurat}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Divisi</p>
              <p className="font-medium">{surat.divisiNama ?? "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pejabat</p>
              <p className="font-medium">{surat.pejabatNama ?? "-"}</p>
            </div>
          </div>

          {surat.tujuanAlamat ? (
            <div>
              <p className="text-sm text-muted-foreground">Alamat Tujuan</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{surat.tujuanAlamat}</p>
            </div>
          ) : null}

          {surat.isiSingkat ? (
            <div>
              <p className="text-sm text-muted-foreground">Isi Singkat</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{surat.isiSingkat}</p>
            </div>
          ) : null}

          {!canReview ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              Surat ini sudah diproses. Status terkini:{" "}
              <span className="font-medium text-foreground">
                {STATUS_CONFIG[status]?.label ?? status}
              </span>
              .
            </div>
          ) : (
            <div className="space-y-3 border-t border-border pt-4">
              <Button
                onClick={handleApprove}
                disabled={isPending}
                className="w-full bg-green-600 hover:bg-green-700 sm:w-auto"
              >
                <CheckCircle2 className="h-4 w-4" />
                Setujui
              </Button>
              <div className="space-y-2">
                <p className="text-sm font-medium">Minta Revisi</p>
                <Textarea
                  rows={4}
                  value={catatan}
                  onChange={(event) => setCatatan(event.target.value)}
                  placeholder="Tulis catatan revisi untuk pembuat surat."
                />
                <Button
                  variant="destructive"
                  onClick={handleRevision}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  Kirim Revisi
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="min-h-[520px] rounded-lg border bg-muted/20 p-3">
          {surat.fileDraftUrl ? (
            isPdf ? (
              <iframe
                src={surat.fileDraftUrl}
                title={`Draft surat keluar ${surat.perihal}`}
                className="h-[70vh] min-h-[500px] w-full rounded-md border bg-background"
              />
            ) : (
              <div className="flex h-full min-h-[500px] flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-background text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">Preview hanya tersedia untuk PDF.</p>
                <Button asChild variant="outline">
                  <a href={surat.fileDraftUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Buka Draft
                  </a>
                </Button>
              </div>
            )
          ) : (
            <div className="flex h-full min-h-[500px] flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-background text-center text-muted-foreground">
              <FileText className="h-10 w-10" />
              <p className="text-sm">Draft surat belum dilampirkan.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
