import Link from "next/link";
import {
  FileText,
  Inbox,
  Mail,
  PenLine,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashboardActivityList } from "@/components/dashboard/DashboardActivityList";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { QuickActionButton } from "@/components/dashboard/QuickActionButton";
import { formatTanggalPendek } from "@/lib/utils";
import type {
  PersuratanMetrics,
  RecentSuratMasukItem,
  RecentDisposisiItem,
} from "@/server/actions/statistics";

interface PersuratanWidgetProps {
  metrics: PersuratanMetrics;
  recentSuratMasuk: RecentSuratMasukItem[];
  recentDisposisi: RecentDisposisiItem[];
}

const STATUS_LABELS: Record<string, string> = {
  diterima: "Diterima",
  diproses: "Diproses",
  diarsip: "Diarsip",
  dibatalkan: "Dibatalkan",
  belum_dibaca: "Belum dibaca",
  dibaca: "Dibaca",
  selesai: "Selesai",
};

const JENIS_LABELS: Record<string, string> = {
  undangan: "Undangan",
  pemberitahuan: "Pemberitahuan",
  permohonan: "Permohonan",
  keputusan: "Keputusan",
  mou: "MOU",
  balasan: "Balasan",
  edaran: "Edaran",
  keterangan: "Keterangan",
  tugas: "Tugas",
  lainnya: "Lainnya",
};

export function PersuratanWidget({
  metrics,
  recentSuratMasuk,
  recentDisposisi,
}: PersuratanWidgetProps) {
  return (
    <>
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Surat Masuk Baru"
          value={String(metrics.suratMasukBaru)}
          hint={`${metrics.suratMasukDiproses} sedang diproses`}
          href="/surat-masuk"
          icon={Inbox}
          tone="blue"
        />
        <MetricCard
          label="Disposisi Belum Dibaca"
          value={String(metrics.disposisiBelumDibaca)}
          hint={`${metrics.disposisiAktif} disposisi aktif`}
          href="/disposisi"
          icon={Mail}
          tone="amber"
        />
        <MetricCard
          label="Perlu Review"
          value={String(metrics.suratKeluarReview)}
          hint="Surat keluar menunggu persetujuan atau reviu"
          href="/surat-keluar"
          icon={PenLine}
          tone="violet"
        />
        <MetricCard
          label="Pengarsipan"
          value={String(metrics.suratKeluarArsip)}
          hint="Siapkan nomor, QR, dan file final"
          href="/surat-keluar"
          icon={FileText}
          tone="emerald"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <DashboardActivityList
          title="Surat Masuk Terbaru"
          description="5 surat masuk paling baru di sistem."
          detailHref="/surat-masuk"
          hasItems={recentSuratMasuk.length > 0}
          emptyIcon={Inbox}
          emptyTitle="Belum ada surat masuk"
          emptyDescription="Surat masuk terbaru akan tampil di sini setelah dicatat."
        >
          {recentSuratMasuk.map((item) => (
            <Link
              key={item.id}
              href={`/surat-masuk?focus=${item.id}`}
              className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 transition-colors hover:bg-muted/45"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  {JENIS_LABELS[item.jenisSurat] ?? item.jenisSurat}
                </Badge>
                {item.status && (
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatTanggalPendek(item.tanggalDiterima)}
                </span>
              </div>
              <p className="line-clamp-1 text-sm font-semibold text-foreground">
                {item.perihal}
              </p>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                Dari: {item.pengirim}
              </p>
            </Link>
          ))}
        </DashboardActivityList>

        <DashboardActivityList
          title="Disposisi untuk Anda"
          description="Disposisi belum selesai yang ditujukan ke Anda."
          detailHref="/disposisi"
          hasItems={recentDisposisi.length > 0}
          emptyIcon={Mail}
          emptyTitle="Tidak ada disposisi aktif"
          emptyDescription="Disposisi yang perlu Anda tindak lanjuti akan tampil di sini."
        >
          {recentDisposisi.map((item) => (
            <Link
              key={item.id}
              href="/disposisi"
              className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 transition-colors hover:bg-muted/45"
            >
              <div className="flex flex-wrap items-center gap-2">
                {item.status && (
                  <Badge
                    variant={item.status === "belum_dibaca" ? "default" : "outline"}
                    className="rounded-full text-[10px]"
                  >
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                )}
                {item.batasWaktu && (
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    Batas: {formatTanggalPendek(item.batasWaktu)}
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {item.tanggalDisposisi
                    ? formatTanggalPendek(item.tanggalDisposisi)
                    : "-"}
                </span>
              </div>
              <p className="line-clamp-1 text-sm font-semibold text-foreground">
                {item.perihal}
              </p>
              {item.dariUserName && (
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  Dari: {item.dariUserName}
                </p>
              )}
            </Link>
          ))}
        </DashboardActivityList>
      </section>

      <section className="rounded-[24px] border border-border/60 bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Aksi Cepat</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Jalur singkat ke pekerjaan yang paling sering dipakai.
        </p>
        <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionButton
            href="/surat-masuk"
            label="Catat surat masuk"
            description="Input dan arsipkan surat baru."
            icon={Inbox}
          />
          <QuickActionButton
            href="/surat-keluar"
            label="Buat surat keluar"
            description="Susun draft dan proses persetujuan."
            icon={Send}
          />
          <QuickActionButton
            href="/disposisi"
            label="Buka disposisi"
            description="Tindak lanjuti instruksi aktif."
            icon={Mail}
          />
          <QuickActionButton
            href="/nomor-surat"
            label="Generate nomor surat"
            description="Kelola counter dan penomoran."
            icon={FileText}
          />
        </div>
      </section>
    </>
  );
}
