import {
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { DashboardInsightCard } from "@/components/dashboard/DashboardInsightCard";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ModuleTabContent } from "@/components/dashboard/ModuleTabContent";
import { QuickActionButton } from "@/components/dashboard/QuickActionButton";
import type { StatistikUjian } from "@/server/actions/jadwal-ujian/bebanKerja";

interface UjianDashboardWidgetProps {
  data: StatistikUjian;
}

export function UjianDashboardWidget({ data }: UjianDashboardWidgetProps) {
  const tugasMingguIni = Math.max(data.totalMingguIni - data.totalHariIni, 0);
  const rataRataBeban =
    data.totalPengawasAktif > 0
      ? data.totalBulanIni / data.totalPengawasAktif
      : 0;
  const bebanLabel =
    data.totalPengawasAktif === 0
      ? "Belum ada pengawas aktif"
      : `${rataRataBeban.toFixed(1).replace(".", ",")} ujian / pengawas`;
  const hasUpcomingExams = data.totalMingguIni > 0 || data.totalBulanIni > 0;

  return (
    <ModuleTabContent
      title="Operasional Ujian"
      description="Pantau jadwal ujian, ketersediaan pengawas, dan tindakan cepat untuk menjaga operasional tetap rapi."
      metrics={
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Ujian Hari Ini"
            value={String(data.totalHariIni)}
            hint={
              data.totalHariIni > 0
                ? "Perlu pemantauan pelaksanaan hari ini"
                : "Tidak ada ujian hari ini"
            }
            href="/jadwal-ujian"
            icon={CalendarCheck}
            tone="blue"
          />
          <MetricCard
            label="Ujian Minggu Ini"
            value={String(data.totalMingguIni)}
            hint={`${tugasMingguIni} jadwal selain hari ini`}
            href="/jadwal-ujian"
            icon={CalendarDays}
            tone="indigo"
          />
          <MetricCard
            label="Ujian Bulan Ini"
            value={String(data.totalBulanIni)}
            hint="Total jadwal dalam periode berjalan"
            href="/jadwal-ujian"
            icon={CalendarRange}
            tone="violet"
          />
          <MetricCard
            label="Total Pengawas"
            value={String(data.totalPengawasAktif)}
            hint={bebanLabel}
            href="/jadwal-ujian/pengawas"
            icon={Users}
            tone="emerald"
          />
        </section>
      }
      insights={
        <section className="grid gap-4 lg:grid-cols-3">
          <DashboardInsightCard
            title="Prioritas Hari Ini"
            value={`${data.totalHariIni} ujian`}
            description={
              data.totalHariIni > 0
                ? "Pastikan penugasan pengawas dan materi sudah siap sebelum sesi dimulai."
                : "Tidak ada jadwal hari ini, gunakan waktu untuk menyiapkan jadwal mendatang."
            }
            icon={AlertCircle}
            tone={data.totalHariIni > 0 ? "amber" : "blue"}
          />
          <DashboardInsightCard
            title="Kesiapan Pengawas"
            value={`${data.totalPengawasAktif} aktif`}
            description={
              data.totalPengawasAktif > 0
                ? "Basis pengawas tersedia untuk penugasan dan pemerataan beban."
                : "Tambahkan data pengawas agar jadwal bisa ditugaskan dengan baik."
            }
            icon={UsersRound}
            tone="emerald"
          />
          <DashboardInsightCard
            title="Beban Bulan Ini"
            value={bebanLabel}
            description="Gunakan halaman beban kerja untuk melihat pemerataan penugasan lebih rinci."
            icon={ClipboardList}
            tone="violet"
          />
        </section>
      }
      activity={
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <DashboardInsightCard
            title="Ringkasan Jadwal Terdekat"
            description="Snapshot periode berjalan agar admin cepat melihat volume ujian tanpa masuk ke halaman detail."
            icon={CalendarClock}
            tone="blue"
          >
            {hasUpcomingExams ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <ScheduleSummaryItem label="Hari ini" value={data.totalHariIni} />
                <ScheduleSummaryItem label="Sisa minggu ini" value={tugasMingguIni} />
                <ScheduleSummaryItem label="Bulan ini" value={data.totalBulanIni} />
              </div>
            ) : (
              <DashboardEmptyState
                icon={CalendarDays}
                title="Belum ada jadwal aktif"
                description="Tidak ada ujian terjadwal pada periode berjalan."
              />
            )}
          </DashboardInsightCard>

          <section className="rounded-[24px] border border-border/60 bg-card p-5 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Aksi Cepat</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Jalur singkat untuk pekerjaan ujian yang paling sering dilakukan.
              </p>
            </div>
            <div className="mt-4 grid gap-3">
              <QuickActionButton
                href="/jadwal-ujian"
                label="Kelola jadwal ujian"
                description="Buka daftar jadwal dan detail pelaksanaan."
                icon={CalendarDays}
              />
              <QuickActionButton
                href="/jadwal-ujian/pengawas"
                label="Atur pengawas"
                description="Kelola pengawas dan kapasitas penugasan."
                icon={Users}
              />
              <QuickActionButton
                href="/jadwal-ujian/pengaturan"
                label="Pengaturan ujian"
                description="Cek konfigurasi operasional ujian."
                icon={Settings}
              />
            </div>
          </section>
        </section>
      }
    />
  );
}

function ScheduleSummaryItem({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}
