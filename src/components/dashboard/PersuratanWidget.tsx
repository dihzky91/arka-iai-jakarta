import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Inbox,
  Mail,
  PenLine,
  Send,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/MetricCard";
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
        <ListPanel
          title="Surat Masuk Terbaru"
          description="5 surat masuk paling baru di sistem."
          detailHref="/surat-masuk"
          emptyText="Belum ada surat masuk."
        >
          {recentSuratMasuk.map((item) => (
            <Link
              key={item.id}
              href={`/surat-masuk?focus=${item.id}`}
              className="flex flex-col gap-1 rounded-2xl border border-border bg-muted/25 px-4 py-3 transition-colors hover:bg-muted/45"
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
        </ListPanel>

        <ListPanel
          title="Disposisi untuk Anda"
          description="Disposisi belum selesai yang ditujukan ke Anda."
          detailHref="/disposisi"
          emptyText="Tidak ada disposisi aktif untuk Anda."
        >
          {recentDisposisi.map((item) => (
            <Link
              key={item.id}
              href="/disposisi"
              className="flex flex-col gap-1 rounded-2xl border border-border bg-muted/25 px-4 py-3 transition-colors hover:bg-muted/45"
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
        </ListPanel>
      </section>

      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Aksi Cepat</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Jalur singkat ke pekerjaan yang paling sering dipakai.
        </p>
        <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction href="/surat-masuk" label="Catat surat masuk" icon={Inbox} />
          <QuickAction href="/surat-keluar" label="Buat surat keluar" icon={Send} />
          <QuickAction href="/disposisi" label="Buka disposisi" icon={Mail} />
          <QuickAction href="/nomor-surat" label="Generate nomor surat" icon={FileText} />
        </div>
      </section>
    </>
  );
}

function ListPanel({
  title,
  description,
  detailHref,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  detailHref: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const childArray = Array.isArray(children) ? children : [children];
  const hasItems = childArray.some(Boolean) && childArray.length > 0;

  return (
    <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {description}
          </p>
        </div>
        <Link
          href={detailHref}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline sm:text-sm"
        >
          Lihat semua
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {hasItems ? (
        <div className="mt-4 grid gap-3 sm:mt-5">{children}</div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground sm:mt-5">
          {emptyText}
        </div>
      )}
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Button asChild variant="outline" className="h-auto justify-start px-4 py-3 text-left">
      <Link href={href}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
