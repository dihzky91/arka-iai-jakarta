import Link from "next/link";
import { ArrowRight, Clock, CalendarOff, UserCheck, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { formatTanggalPendek } from "@/lib/utils";
import type {
  KepegawaianMetrics,
  PendingCutiItem,
} from "@/server/actions/statistics";

interface KepegawaianWidgetProps {
  metrics: KepegawaianMetrics;
  pendingCuti: PendingCutiItem[];
}

const JENIS_CUTI_LABELS: Record<string, string> = {
  tahunan: "Cuti Tahunan",
  sakit: "Sakit",
  melahirkan: "Melahirkan",
  menikah: "Menikah",
  kematian: "Kematian",
  lainnya: "Lainnya",
};

export function KepegawaianWidget({
  metrics,
  pendingCuti,
}: KepegawaianWidgetProps) {
  return (
    <>
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Hadir Hari Ini"
          value={String(metrics.absensiHadirHariIni)}
          hint="Karyawan hadir"
          href="/absensi"
          icon={UserCheck}
          tone="emerald"
        />
        <MetricCard
          label="Terlambat Hari Ini"
          value={String(metrics.absensiTerlambatHariIni)}
          hint="Perlu tindak lanjut"
          href="/absensi"
          icon={Clock}
          tone="amber"
        />
        <MetricCard
          label="Alpha Hari Ini"
          value={String(metrics.absensiAlphaHariIni)}
          hint="Tidak hadir tanpa keterangan"
          href="/absensi"
          icon={AlertTriangle}
          tone="red"
        />
        <MetricCard
          label="Cuti Menunggu Approval"
          value={String(metrics.cutiMenungguApproval)}
          hint={`${metrics.cutiDisetujuiBulanIni} disetujui bulan ini`}
          href="/cuti"
          icon={CalendarOff}
          tone="blue"
        />
      </section>

      <section className="rounded-[24px] border border-border/60 bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-medium text-foreground sm:text-lg">
              Pengajuan Cuti Menunggu
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {metrics.cutiMenungguApproval > 0
                ? `${metrics.cutiMenungguApproval} pengajuan menunggu persetujuan.`
                : "Tidak ada pengajuan cuti menunggu approval."}
            </p>
          </div>
          <Link
            href="/cuti"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline sm:text-sm"
          >
            Lihat semua
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {pendingCuti.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:mt-5">
            {pendingCuti.map((item) => (
              <Link
                key={item.id}
                href="/cuti"
                className="grid gap-2 rounded-2xl border border-border/60 bg-muted/25 p-4 transition-colors hover:bg-muted/45 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      {JENIS_CUTI_LABELS[item.jenisCuti] ?? item.jenisCuti}
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {item.jumlahHari} hari
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTanggalPendek(item.tanggalMulai)} –{" "}
                      {formatTanggalPendek(item.tanggalSelesai)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">
                    {item.userName ?? "(Tanpa nama)"}
                  </p>
                  {item.alasan && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {item.alasan}
                    </p>
                  )}
                </div>
                <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                  <span>Proses</span>
                </Button>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground sm:mt-5">
            Belum ada pengajuan cuti yang perlu Anda proses.
          </div>
        )}
      </section>
    </>
  );
}
