import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getSuratKeluarVerificationById } from "@/server/actions/suratKeluar";
import { formatTanggal } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Verifikasi Surat Keluar | ARKA",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function getVerificationStatus(
  status: string | null,
  qrCodeUrl: string | null,
) {
  if (status === "dibatalkan") {
    return {
      label: "Tidak valid",
      tone: "destructive" as const,
      description: "Surat ini sudah dibatalkan di sistem.",
      accent: "from-red-500/18 via-red-500/8 to-transparent",
      panelClass: "border-red-200 bg-red-50 text-red-900 shadow-red-100/60",
    };
  }

  if (!qrCodeUrl) {
    return {
      label: "Belum terverifikasi",
      tone: "secondary" as const,
      description: "QR verifikasi untuk surat ini belum tersedia.",
      accent: "from-slate-500/16 via-slate-500/8 to-transparent",
      panelClass:
        "border-slate-200 bg-slate-50 text-slate-900 shadow-slate-100/60",
    };
  }

  if (status === "pengarsipan" || status === "selesai") {
    return {
      label: "Valid",
      tone: "default" as const,
      description: "Surat tercatat resmi di ARKA.",
      accent: "from-emerald-500/18 via-emerald-500/8 to-transparent",
      panelClass:
        "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-emerald-100/60",
    };
  }

  return {
    label: "Dalam proses",
    tone: "outline" as const,
    description: "Surat masih berada dalam alur internal dan belum final.",
    accent: "from-amber-500/18 via-amber-500/8 to-transparent",
    panelClass:
      "border-amber-200 bg-amber-50 text-amber-950 shadow-amber-100/60",
  };
}

export default async function VerificationSuratKeluarPage({
  params,
}: PageProps) {
  const { id } = await params;
  const surat = await getSuratKeluarVerificationById(id);

  if (!surat) {
    notFound();
  }

  const verification = getVerificationStatus(surat.status, surat.qrCodeUrl);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <BrandMark />
          <h1 className="mt-5 text-3xl font-medium tracking-tight text-slate-950 sm:text-4xl">
            Verifikasi Surat Elektronik
          </h1>
        </div>

        <section className="mt-8 rounded-[28px] border border-border bg-white p-6 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.18)] sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-normal tracking-[0.24em] text-muted-foreground uppercase">
                Status Verifikasi
              </p>
              <p className="mt-2 text-2xl font-medium text-slate-950">
                {verification.label}
              </p>
            </div>
            <Badge variant={verification.tone}>{verification.label}</Badge>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-600">
            {verification.description}
          </p>

          <div className="mt-8 space-y-4 rounded-[24px] border border-border bg-slate-50 px-5 py-5">
            <DetailRow
              label="Nomor Surat"
              value={surat.nomorSurat ?? "-"}
              mono
            />
            <DetailRow
              label="Tanggal Surat"
              value={formatTanggal(surat.tanggalSurat)}
            />
            <DetailRow label="Perihal" value={surat.perihal} />
            <DetailRow label="Ditujukan Kepada" value={surat.tujuan} />
            <DetailRow label="Penandatangan" value={surat.pejabatNama ?? "-"} />
            <DetailRow
              label="Status Sistem"
              value={humanizeStatus(surat.status)}
            />
          </div>

          <div className="mt-6">
            {surat.fileFinalUrl ? (
              <Link
                href={surat.fileFinalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Buka Dokumen Final
              </Link>
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                Dokumen final belum tersedia.
              </div>
            )}
          </div>
        </section>

        <footer className="mt-8 text-center text-xs tracking-[0.2em] text-muted-foreground uppercase">
          Sistem Verifikasi ARKA
        </footer>
      </div>
    </main>
  );
}

function InfoItem({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-background px-4 py-4 ${className ?? ""}`}
    >
      <p className="text-xs font-normal tracking-[0.2em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className={`mt-2 text-sm text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-[26px] border border-slate-200 bg-white shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/8 text-lg font-medium text-primary">
        IAI
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border-b border-slate-200 pb-4 last:border-b-0 last:pb-0 sm:grid sm:grid-cols-[170px_1fr] sm:gap-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-1 text-base text-slate-950 sm:mt-0 ${mono ? "font-mono font-medium" : "font-medium"}`}
      >
        {value}
      </p>
    </div>
  );
}

function humanizeStatus(status: string | null) {
  switch (status) {
    case "pengarsipan":
      return "Pengarsipan";
    case "selesai":
      return "Selesai";
    case "dibatalkan":
      return "Tidak Berlaku";
    case "reviu":
      return "Proses Reviu";
    case "permohonan_persetujuan":
      return "Menunggu Persetujuan";
    case "draft":
      return "Draft";
    default:
      return status ?? "-";
  }
}
