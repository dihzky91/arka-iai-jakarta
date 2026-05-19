"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import {
  Award,
  Banknote,
  CalendarOff,
  FileText,
  Inbox,
  Mail,
  Send,
  Timer,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { StatsSummary } from "@/components/dashboard/StatsCharts";
import { LazyStatsCharts } from "@/components/dashboard/LazyStatsCharts";
import { PersuratanWidget } from "@/components/dashboard/PersuratanWidget";
import { KepegawaianWidget } from "@/components/dashboard/KepegawaianWidget";
import { SertifikatWidget } from "@/components/dashboard/SertifikatWidget";
import { KeuanganWidget } from "@/components/dashboard/KeuanganWidget";
import { UjianDashboardWidget } from "@/components/jadwal-ujian/UjianDashboardWidget";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardActivityList } from "@/components/dashboard/DashboardActivityList";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProjectCentricRingkasan } from "@/components/dashboard/ProjectCentricRingkasan";
import { DashboardCustomizeDrawer } from "@/components/dashboard/DashboardCustomizeDrawer";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import type { RoleDashboardData, RecentSuratMasukItem, ProjectCentricData } from "@/server/actions/statistics";
import type { UserWidgetPreference } from "@/lib/dashboard-widgets";

interface DashboardContentProps {
  data: RoleDashboardData;
  projectData?: ProjectCentricData | null;
  preferences?: UserWidgetPreference[] | null;
  userName: string | null;
}

export function DashboardContent({ data, projectData, preferences, userName }: DashboardContentProps) {
  const { capabilities, isSuperAdmin } = useDashboard();
  const isProjectCentric = !!projectData;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <DashboardHeader userName={userName} />
        <DashboardCustomizeDrawer
          preferences={preferences ?? null}
          capabilities={capabilities}
          isSuperAdmin={isSuperAdmin}
          isProjectCentric={isProjectCentric}
        />
      </div>
      <DashboardTabs
        ringkasan={<RingkasanTab data={data} projectData={projectData ?? null} userName={userName} />}
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
            <UjianDashboardWidget data={data.statistikUjian} />
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

// ─── Ringkasan Tab ────────────────────────────────────────────────────────────

function RingkasanTab({
  data,
  projectData,
  userName,
}: {
  data: RoleDashboardData;
  projectData: ProjectCentricData | null;
  userName: string | null;
}) {

  // Staff/Pejabat with projects:view → project-centric dashboard
  if (projectData) {
    return (
      <div className="space-y-6">
        <ProjectCentricRingkasan data={projectData} userName={userName} />

        {/* Quick Actions sidebar */}
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div />
          <div className="space-y-4">
            <QuickActionsCard data={data} />
          </div>
        </div>
      </div>
    );
  }

  // Admin/SuperAdmin → existing overview layout
  return (
    <div className="space-y-6">
      {/* Hero 4 metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.persuratan && (
          <MetricCard
            heroLayout
            label="Surat Masuk"
            value={String(data.persuratan.suratMasukBaru)}
            hint={`${data.persuratan.suratMasukDiproses} sedang diproses`}
            href="/surat-masuk"
            icon={Inbox}
            tone="blue"
          />
        )}
        {data.kepegawaian && (
          <MetricCard
            heroLayout
            label="Kepegawaian"
            value={String(data.kepegawaian.absensiHadirHariIni)}
            hint={`${data.kepegawaian.cutiMenungguApproval} pengajuan cuti`}
            href="/dashboard?tab=kepegawaian"
            icon={Users}
            tone="emerald"
          />
        )}
        {data.sertifikat && (
          <MetricCard
            heroLayout
            label="Sertifikat"
            value={data.sertifikat.totalPeserta.toLocaleString("id-ID")}
            hint={`${data.sertifikat.kegiatanAktif} kegiatan aktif`}
            href="/dashboard?tab=sertifikat"
            icon={Award}
            tone="violet"
          />
        )}
        {data.keuangan && (
          <MetricCard
            heroLayout
            label="Keuangan"
            value={`Rp ${data.keuangan.totalNominalDibayar.toLocaleString("id-ID")}`}
            hint={`${data.keuangan.batchDikirimKeuangan + data.keuangan.batchDiprosesKeuangan} batch aktif`}
            href="/dashboard?tab=keuangan"
            icon={Banknote}
            tone="amber"
          />
        )}
      </div>

      {/* 2-column layout: content left + sidebar right */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Left: Antrean Persuratan */}
        <div>
          {data.recentSuratMasuk !== null && (
            <AntreanPersuratanCard items={data.recentSuratMasuk ?? []} />
          )}
        </div>

        {/* Right: Quick Actions */}
        <div>
          <QuickActionsCard data={data} />
        </div>
      </div>
    </div>
  );
}

// ─── Antrean Persuratan ───────────────────────────────────────────────────────

function statusInfo(status: string | null): { label: string; className: string } {
  switch (status) {
    case "diterima":
      return {
        label: "Diterima",
        className: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
      };
    case "diproses":
      return {
        label: "Diproses",
        className: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
      };
    case "selesai":
      return {
        label: "Selesai",
        className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
      };
    case "ditolak":
      return {
        label: "Ditolak",
        className: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
      };
    default:
      return { label: status ?? "—", className: "bg-muted text-muted-foreground" };
  }
}

function AntreanPersuratanCard({ items }: { items: RecentSuratMasukItem[] }) {
  return (
    <DashboardActivityList
      title="Antrean Persuratan"
      description="Daftar surat masuk, disposisi, dan surat keluar."
      detailHref="/surat-masuk"
      detailLabel="Lihat detail"
      hasItems={items.length > 0}
      emptyIcon={FileText}
      emptyTitle="Tidak ada surat masuk terbaru"
      emptyDescription="Surat masuk terbaru akan muncul di sini setelah ada aktivitas persuratan."
    >
      {items.slice(0, 5).map((item) => {
        const info = statusInfo(item.status);
        const timeAgo = item.createdAt
          ? formatDistanceToNow(new Date(item.createdAt), {
              addSuffix: true,
              locale: id,
            })
          : "-";

        return (
          <div
            key={item.id}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 transition-colors hover:bg-muted/40"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {item.perihal}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${info.className}`}
                >
                  {info.label}
                </span>
                <span className="text-xs text-muted-foreground">{timeAgo}</span>
              </div>
            </div>
          </div>
        );
      })}
    </DashboardActivityList>
  );
}

// ─── Quick Actions Card ───────────────────────────────────────────────────────

function QuickActionsCard({ data }: { data: RoleDashboardData }) {
  const actions: { href: string; label: string; icon: LucideIcon }[] = [];

  if (data.persuratan) {
    actions.push({ href: "/surat-masuk", label: "Catat surat masuk", icon: Inbox });
    actions.push({ href: "/surat-keluar", label: "Buat surat keluar", icon: Send });
    actions.push({ href: "/disposisi", label: "Buka disposisi", icon: Mail });
  }
  if (data.kepegawaian) {
    actions.push({ href: "/absensi", label: "Cek absensi", icon: Timer });
    actions.push({ href: "/cuti", label: "Pengajuan cuti", icon: CalendarOff });
  }
  if (data.sertifikat) {
    actions.push({ href: "/sertifikat/kegiatan", label: "Kelola kegiatan", icon: Award });
  }
  if (data.keuangan) {
    actions.push({ href: "/keuangan/honorarium", label: "Proses honorarium", icon: Banknote });
  }

  if (actions.length === 0) return null;

  return (
    <section className="h-full rounded-3xl border border-border/60 bg-card p-5 text-card-foreground shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Aksi Cepat</h3>
      </div>
      <div className="space-y-0.5">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <action.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
