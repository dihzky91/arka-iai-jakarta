import Link from "next/link";
import { Award, CalendarDays, Users, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import type { SertifikatMetrics } from "@/server/actions/statistics";

interface SertifikatWidgetProps {
  metrics: SertifikatMetrics;
}

const KATEGORI_LABELS: Record<string, string> = {
  Workshop: "Workshop",
  "Brevet AB": "Brevet AB",
  "Brevet C": "Brevet C",
  BFA: "BFA",
  Lainnya: "Lainnya",
};

export function SertifikatWidget({ metrics }: SertifikatWidgetProps) {
  return (
    <>
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Kegiatan Aktif"
          value={String(metrics.kegiatanAktif)}
          hint="Kegiatan berlangsung saat ini"
          href="/sertifikat/kegiatan"
          icon={CalendarDays}
          tone="violet"
        />
        <MetricCard
          label="Total Peserta"
          value={metrics.totalPeserta.toLocaleString("id-ID")}
          hint="Seluruh periode"
          href="/sertifikat/peserta"
          icon={Users}
          tone="blue"
        />
        <MetricCard
          label="Kategori Kegiatan"
          value={String(metrics.kegiatanByKategori.length)}
          hint={metrics.kegiatanByKategori
            .map((k) => `${KATEGORI_LABELS[k.kategori] ?? k.kategori}: ${k.count}`)
            .join(" · ")}
          href="/sertifikat/analytics"
          icon={BarChart3}
          tone="emerald"
        />
      </section>

      {metrics.kegiatanTerbaru.length > 0 && (
        <section className="rounded-[24px] border border-border/60 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Kegiatan Mendatang
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Kegiatan aktif yang akan berlangsung.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link href="/sertifikat/kegiatan">Lihat Semua</Link>
            </Button>
          </div>

          <div className="mt-5 divide-y divide-border/60 rounded-2xl border border-border/60 sm:mt-6">
            {metrics.kegiatanTerbaru.map((kegiatan) => (
              <Link
                key={kegiatan.id}
                href={`/sertifikat/kegiatan/${kegiatan.id}`}
                className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/45 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">
                      {KATEGORI_LABELS[kegiatan.kategori] ?? kegiatan.kategori}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {kegiatan.tanggalMulai}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {kegiatan.namaKegiatan}
                  </p>
                </div>
                <Badge variant="outline" className="w-fit shrink-0 rounded-full">
                  {kegiatan.pesertaCount} peserta
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
