"use client";

import Link from "next/link";
import {
  Award,
  Banknote,
  CalendarOff,
  GraduationCap,
  Inbox,
  Mail,
  Send,
  Timer,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsSummary } from "@/components/dashboard/StatsCharts";
import { LazyStatsCharts } from "@/components/dashboard/LazyStatsCharts";
import { PersuratanWidget } from "@/components/dashboard/PersuratanWidget";
import { KepegawaianWidget } from "@/components/dashboard/KepegawaianWidget";
import { SertifikatWidget } from "@/components/dashboard/SertifikatWidget";
import { KeuanganWidget } from "@/components/dashboard/KeuanganWidget";
import { UjianDashboardWidget } from "@/components/jadwal-ujian/UjianDashboardWidget";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import type { RoleDashboardData } from "@/server/actions/statistics";

interface DashboardContentProps {
  data: RoleDashboardData;
  userName: string | null;
}

export function DashboardContent({ data, userName }: DashboardContentProps) {
  const { capabilities, isSuperAdmin } = useDashboard();
  return (
    <div className="space-y-5 sm:space-y-6">
      <DashboardHeader userName={userName} />
      <DashboardTabs
        ringkasan={<RingkasanTab data={data} />}
        persuratan={
          data.persuratan ? (
            <PersuratanWidget
              metrics={data.persuratan}
              recentSuratMasuk={data.recentSuratMasuk ?? []}
              recentDisposisi={data.recentDisposisi ?? []}
            />
          ) : undefined
        }
        kepegawaian={
          data.kepegawaian ? (
            <KepegawaianWidget
              metrics={data.kepegawaian}
              pendingCuti={data.pendingCuti ?? []}
            />
          ) : undefined
        }
        sertifikat={
          data.sertifikat ? (
            <SertifikatWidget metrics={data.sertifikat} />
          ) : undefined
        }
        keuangan={
          data.keuangan ? (
            <KeuanganWidget
              metrics={data.keuangan}
              pendingBatches={data.pendingBatches ?? []}
            />
          ) : undefined
        }
        ujian={
          data.statistikUjian ? (
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <UjianDashboardWidget data={data.statistikUjian} />
            </section>
          ) : undefined
        }
        analitik={
          data.stats ? (
            <>
              <StatsSummary stats={data.stats} />
              <LazyStatsCharts stats={data.stats} />
            </>
          ) : undefined
        }
      />
    </div>
  );
}

function RingkasanTab({ data }: { data: RoleDashboardData }) {
  const hasAnyModule =
    data.persuratan ||
    data.kepegawaian ||
    data.sertifikat ||
    data.keuangan ||
    data.statistikUjian;

  return (
    <div className="space-y-6 sm:space-y-7">
      {data.persuratan && (
        <DashboardSection
          title="Persuratan"
          description="Antrean surat masuk, disposisi, dan surat keluar."
          icon={Mail}
          detailHref="/dashboard?tab=persuratan"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              compact
              label="Surat Masuk Baru"
              value={String(data.persuratan.suratMasukBaru)}
              hint={`${data.persuratan.suratMasukDiproses} sedang diproses`}
              href="/surat-masuk"
              icon={Inbox}
              tone="blue"
            />
            <MetricCard
              compact
              label="Disposisi Belum Dibaca"
              value={String(data.persuratan.disposisiBelumDibaca)}
              hint={`${data.persuratan.disposisiAktif} disposisi aktif`}
              href="/disposisi"
              icon={Mail}
              tone="amber"
            />
            <MetricCard
              compact
              label="Perlu Review"
              value={String(data.persuratan.suratKeluarReview)}
              hint="Surat keluar menunggu persetujuan"
              href="/surat-keluar"
              icon={Send}
              tone="violet"
            />
            <MetricCard
              compact
              label="Pengarsipan"
              value={String(data.persuratan.suratKeluarArsip)}
              hint="Siapkan nomor, QR, dan file final"
              href="/surat-keluar"
              icon={Award}
              tone="emerald"
            />
          </div>
        </DashboardSection>
      )}

      {data.kepegawaian && (
        <DashboardSection
          title="Kepegawaian"
          description="Absensi & pengajuan cuti hari ini."
          icon={UserCheck}
          detailHref="/dashboard?tab=kepegawaian"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              compact
              label="Hadir Hari Ini"
              value={String(data.kepegawaian.absensiHadirHariIni)}
              hint={`${data.kepegawaian.absensiTerlambatHariIni} terlambat`}
              href="/absensi"
              icon={UserCheck}
              tone="emerald"
            />
            <MetricCard
              compact
              label="Cuti Menunggu"
              value={String(data.kepegawaian.cutiMenungguApproval)}
              hint={`${data.kepegawaian.cutiDisetujuiBulanIni} disetujui bulan ini`}
              href="/cuti"
              icon={CalendarOff}
              tone="blue"
            />
            <MetricCard
              compact
              label="Alpha Hari Ini"
              value={String(data.kepegawaian.absensiAlphaHariIni)}
              hint="Tidak hadir tanpa keterangan"
              href="/absensi"
              icon={Timer}
              tone="red"
            />
          </div>
        </DashboardSection>
      )}

      {data.sertifikat && (
        <DashboardSection
          title="Sertifikat & Kegiatan"
          description="Kegiatan aktif dan peserta."
          icon={Award}
          detailHref="/dashboard?tab=sertifikat"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            <MetricCard
              compact
              label="Kegiatan Aktif"
              value={String(data.sertifikat.kegiatanAktif)}
              hint="Kegiatan berlangsung saat ini"
              href="/sertifikat/kegiatan"
              icon={Award}
              tone="violet"
            />
            <MetricCard
              compact
              label="Total Peserta"
              value={data.sertifikat.totalPeserta.toLocaleString("id-ID")}
              hint="Seluruh periode"
              href="/sertifikat/peserta"
              icon={UserCheck}
              tone="blue"
            />
          </div>
        </DashboardSection>
      )}

      {data.keuangan && (
        <DashboardSection
          title="Keuangan"
          description="Status batch honorarium."
          icon={Banknote}
          detailHref="/dashboard?tab=keuangan"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              compact
              label="Antrian Pembayaran"
              value={String(
                data.keuangan.batchDikirimKeuangan +
                  data.keuangan.batchDiprosesKeuangan,
              )}
              hint="Batch menunggu diproses"
              href="/keuangan/honorarium"
              icon={Timer}
              tone="amber"
            />
            <MetricCard
              compact
              label="Batch Dibayar"
              value={String(data.keuangan.batchDibayar)}
              hint="Sudah selesai dibayar"
              href="/keuangan/honorarium"
              icon={Banknote}
              tone="emerald"
            />
            <MetricCard
              compact
              label="Total Dibayar"
              value={`Rp ${data.keuangan.totalNominalDibayar.toLocaleString("id-ID")}`}
              hint={`${data.keuangan.batchLocked} batch terkunci`}
              href="/keuangan"
              icon={Banknote}
              tone="violet"
            />
          </div>
        </DashboardSection>
      )}

      {data.statistikUjian && (
        <DashboardSection
          title="Jadwal Ujian"
          description="Ringkasan jadwal ujian dan pengawas."
          icon={GraduationCap}
          detailHref="/dashboard?tab=ujian"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <UjianDashboardWidget data={data.statistikUjian} />
          </div>
        </DashboardSection>
      )}

      {hasAnyModule && <QuickActionsSection data={data} />}
    </div>
  );
}

function QuickActionsSection({ data }: { data: RoleDashboardData }) {
  return (
    <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-foreground sm:text-lg">
        Aksi Cepat
      </h2>
      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
        Jalur singkat ke pekerjaan yang paling sering dipakai.
      </p>
      <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2 lg:grid-cols-3">
        {data.persuratan && (
          <>
            <QuickAction href="/surat-masuk" label="Catat surat masuk" icon={Inbox} />
            <QuickAction href="/surat-keluar" label="Buat surat keluar" icon={Send} />
            <QuickAction href="/disposisi" label="Buka disposisi" icon={Mail} />
          </>
        )}
        {data.kepegawaian && (
          <>
            <QuickAction href="/absensi" label="Cek absensi" icon={Timer} />
            <QuickAction href="/cuti" label="Pengajuan cuti" icon={CalendarOff} />
          </>
        )}
        {data.sertifikat && (
          <QuickAction
            href="/sertifikat/kegiatan"
            label="Kelola kegiatan"
            icon={Award}
          />
        )}
        {data.keuangan && (
          <QuickAction
            href="/keuangan/honorarium"
            label="Proses honorarium"
            icon={Banknote}
          />
        )}
      </div>
    </section>
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
