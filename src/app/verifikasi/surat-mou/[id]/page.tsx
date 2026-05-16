import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getSuratMouVerificationById } from "@/server/actions/suratMou";
import { formatTanggal } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Verifikasi Surat MOU | ARKA",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VerificationSuratMouPage({ params }: PageProps) {
  const { id } = await params;
  const surat = await getSuratMouVerificationById(id);

  if (!surat) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5ef_0%,#ffffff_100%)] px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-border bg-card shadow-sm">
        <section className="border-b border-border bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-6 py-8 sm:px-8">
          <Badge>Valid</Badge>
          <h1 className="mt-4 text-3xl font-medium tracking-tight">
            Verifikasi Surat MOU
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Dokumen Memorandum of Understanding ini tercatat di ARKA.
          </p>
        </section>

        <section className="grid gap-4 px-6 py-8 sm:grid-cols-2 sm:px-8">
          <InfoItem label="Nomor MOU" value={surat.nomorMOU} mono />
          <InfoItem
            label="Tanggal MOU"
            value={formatTanggal(surat.tanggalMOU)}
          />
          <InfoItem label="Perihal" value={surat.perihal} />
          <InfoItem label="Pihak Kedua" value={surat.pihakKedua} />
          <InfoItem
            label="Alamat Pihak Kedua"
            value={surat.pihakKeduaAlamat ?? "-"}
          />
          <InfoItem
            label="Pejabat Penandatangan"
            value={surat.pejabatNama ?? "-"}
          />
        </section>

        {surat.fileUrl ? (
          <section className="px-6 pb-8 sm:px-8">
            <Link
              href={surat.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-primary transition hover:bg-muted"
            >
              Buka Dokumen MOU
            </Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function InfoItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-4">
      <p className="text-xs font-normal tracking-[0.2em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className={`mt-2 text-sm text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}
