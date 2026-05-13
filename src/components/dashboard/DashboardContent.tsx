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
import { MetricCard } from "@/components/dashboard/MetricCard";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import type { RoleDashboardData, RecentSuratMasukItem } from "@/server/actions/statistics";

interface DashboardContentProps {
  data: RoleDashboardData;
  userName: string | null;
}

export function DashboardContent({ data, userName }: DashboardContentProps) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <DashboardHeader userName={userName} />
      <DashboardTabs
        ringkasan={<RingkasanTab data={data} userName={userName} />}
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
  userName,
}: {
  data: RoleDashboardData;
  userName: string | null;
}) {
  const { userRole, isSuperAdmin } = useDashboard();

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
        <div className="space-y-5">
          {data.recentSuratMasuk !== null && (
            <AntreanPersuratanCard items={data.recentSuratMasuk ?? []} />
          )}
        </div>

        {/* Right: Profile + Quick Actions */}
        <div className="space-y-4">
          <ProfileCard
            userName={userName}
            userRole={userRole}
            isSuperAdmin={isSuperAdmin}
          />
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
    <section className="rounded-3xl border border-border/60 bg-card p-5 text-card-foreground shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Antrean Persuratan</h2>
          <p className="text-xs text-muted-foreground">
            Daftar surat masuk, disposisi, dan surat keluar.
          </p>
        </div>
        <Link
          href="/surat-masuk"
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          Lihat detail →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 bg-muted/25 py-10 text-center text-sm text-muted-foreground">
          Tidak ada surat masuk terbaru.
        </p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((item) => {
            const info = statusInfo(item.status);
            const timeAgo = item.createdAt
              ? formatDistanceToNow(new Date(item.createdAt), {
                  addSuffix: true,
                  locale: id,
                })
              : "—";
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
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${info.className}`}
                    >
                      {info.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Profile Card ─────────────────────────────────────────────────────────────

function ProfileCard({
  userName,
  userRole,
  isSuperAdmin,
}: {
  userName: string | null;
  userRole: string | null;
  isSuperAdmin: boolean;
}) {
  const name = userName ?? "Pengguna";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  const roleLabel = isSuperAdmin
    ? "Super Admin"
    : userRole === "admin"
      ? "Admin"
      : userRole === "staff"
        ? "Staff"
        : userRole === "pejabat"
          ? "Pejabat"
          : (userRole ?? "Member");

  return (
    <div className="rounded-3xl bg-linear-to-br from-blue-600 to-blue-700 p-5 text-white shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-200">
        Profil Saya
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-blue-200">IAI Jakarta</p>
        </div>
      </div>
      <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-blue-200">Peran</span>
          <span className="font-semibold">{roleLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-blue-200">Status</span>
          <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
            TERVERIFIKASI
          </span>
        </div>
      </div>
    </div>
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
    <section className="rounded-3xl border border-border/60 bg-card p-5 text-card-foreground shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Aksi Cepat</h3>
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
