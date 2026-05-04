import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Inbox,
  Mail,
  PenLine,
  Send,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  countUnreadDisposisi,
  inboxDisposisi,
} from "@/server/actions/disposisi";
import { listSuratKeluar } from "@/server/actions/suratKeluar";
import { listSuratMasuk } from "@/server/actions/suratMasuk";
import { getDashboardStats } from "@/server/actions/statistics";
import { getStatistikUjian } from "@/server/actions/jadwal-ujian/bebanKerja";
import { formatTanggalWaktuJakarta } from "@/lib/utils";
import { StatsSummary } from "@/components/dashboard/StatsCharts";
import { LazyStatsCharts } from "@/components/dashboard/LazyStatsCharts";
import { UjianDashboardWidget } from "@/components/jadwal-ujian/UjianDashboardWidget";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";

export const metadata: Metadata = {
  title: "Dashboard | ARKA",
};

export default async function DashboardPage() {
  const [
    suratKeluarRows,
    suratMasukRows,
    disposisiRows,
    unreadDisposisiCount,
    stats,
    statistikUjian,
  ] = await Promise.all([
    listSuratKeluar(),
    listSuratMasuk(),
    inboxDisposisi(),
    countUnreadDisposisi(),
    getDashboardStats(),
    getStatistikUjian(),
  ]);

  const suratMasukBaru = suratMasukRows.filter(
    (row) => row.status === "diterima",
  );
  const suratMasukProses = suratMasukRows.filter(
    (row) => row.status === "diproses",
  );
  const suratKeluarReview = suratKeluarRows.filter((row) =>
    ["permohonan_persetujuan", "reviu"].includes(row.status ?? ""),
  );
  const suratKeluarArsip = suratKeluarRows.filter(
    (row) => row.status === "pengarsipan",
  );
  const disposisiAktif = disposisiRows.filter(
    (row) => row.status !== "selesai",
  );

  const recentItems = [
    ...suratMasukRows.slice(0, 4).map((row) => ({
      id: row.id,
      type: "Surat masuk",
      title: row.perihal,
      meta: row.pengirim,
      date: row.updatedAt ?? row.createdAt,
      href: `/surat-masuk/${row.id}`,
      status: statusSuratMasuk(row.status),
    })),
    ...suratKeluarRows.slice(0, 4).map((row) => ({
      id: row.id,
      type: "Surat keluar",
      title: row.perihal,
      meta: row.tujuan,
      date: row.updatedAt ?? row.createdAt,
      href: "/surat-keluar",
      status: statusSuratKeluar(row.status),
    })),
    ...disposisiRows.slice(0, 4).map((row) => ({
      id: row.id,
      type: "Disposisi",
      title: row.suratPerihal ?? "Instruksi disposisi",
      meta: row.dariNama ? `Dari ${row.dariNama}` : "Inbox disposisi",
      date: row.tanggalDisposisi,
      href: "/disposisi",
      status: statusDisposisi(row.status),
    })),
  ]
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .slice(0, 6);

  return (
    <DashboardTabs
      ringkasan={
        <>
          <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Surat Masuk Baru"
              value={String(suratMasukBaru.length)}
              hint={`${suratMasukProses.length} sedang diproses`}
              href="/surat-masuk"
              icon={Inbox}
            />
            <MetricCard
              label="Disposisi Belum Dibaca"
              value={String(unreadDisposisiCount)}
              hint={`${disposisiAktif.length} disposisi aktif`}
              href="/disposisi"
              icon={Mail}
            />
            <MetricCard
              label="Perlu Review"
              value={String(suratKeluarReview.length)}
              hint="Surat keluar menunggu persetujuan atau reviu"
              href="/surat-keluar"
              icon={PenLine}
            />
            <MetricCard
              label="Pengarsipan"
              value={String(suratKeluarArsip.length)}
              hint="Siapkan nomor, QR, dan file final"
              href="/surat-keluar"
              icon={FileText}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Pekerjaan Perlu Ditindaklanjuti
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ringkasan antrean operasional dari surat masuk, disposisi,
                    dan surat keluar.
                  </p>
                </div>
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/surat-masuk">
                    Input Surat Masuk
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="mt-5 grid gap-3 sm:mt-6">
                <WorkItem
                  title="Surat masuk baru"
                  description="Periksa surat yang baru diterima, lengkapi detail, lalu teruskan ke disposisi bila perlu."
                  value={suratMasukBaru.length}
                  href="/surat-masuk"
                  icon={Inbox}
                  action="Kelola"
                />
                <WorkItem
                  title="Disposisi aktif"
                  description="Buka instruksi yang belum selesai dan tindak lanjuti sesuai batas waktu."
                  value={disposisiAktif.length}
                  href="/disposisi"
                  icon={Mail}
                  action="Buka inbox"
                />
                <WorkItem
                  title="Surat keluar perlu review"
                  description="Surat yang menunggu persetujuan atau proses reviu sebelum masuk pengarsipan."
                  value={suratKeluarReview.length}
                  href="/surat-keluar"
                  icon={Send}
                  action="Review"
                />
                <WorkItem
                  title="Surat keluar pengarsipan"
                  description="Pastikan nomor surat, QR verifikasi, dan file final sudah lengkap."
                  value={suratKeluarArsip.length}
                  href="/surat-keluar"
                  icon={CheckCircle2}
                  action="Lengkapi"
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Aksi Cepat
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Jalur singkat ke pekerjaan yang paling sering dipakai.
              </p>

              <div className="mt-5 grid gap-3 sm:mt-6">
                <QuickAction
                  href="/surat-masuk"
                  label="Catat surat masuk"
                  icon={Inbox}
                />
                <QuickAction
                  href="/surat-keluar"
                  label="Buat surat keluar"
                  icon={Send}
                />
                <QuickAction
                  href="/disposisi"
                  label="Buka disposisi"
                  icon={Mail}
                />
                <QuickAction
                  href="/nomor-surat"
                  label="Generate nomor surat"
                  icon={FileText}
                />
                <QuickAction
                  href="/pengaturan"
                  label="Cek pengaturan sistem"
                  icon={Timer}
                />
              </div>
            </div>
          </section>
        </>
      }
      analitik={
        <>
          <StatsSummary stats={stats} />
          <LazyStatsCharts stats={stats} />
        </>
      }
      aktivitas={
        <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Aktivitas Terbaru
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Item terbaru dari modul persuratan yang perlu mudah dipantau.
              </p>
            </div>
            <Badge variant="outline">{recentItems.length} item</Badge>
          </div>

          <div className="mt-6 divide-y divide-border rounded-2xl border border-border">
            {recentItems.length ? (
              recentItems.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/45 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-full">
                        {item.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTanggalWaktuJakarta(item.date)}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {item.meta}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="w-fit shrink-0 rounded-full"
                  >
                    {item.status}
                  </Badge>
                </Link>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Belum ada aktivitas persuratan.
              </div>
            )}
          </div>
        </section>
      }
      ujian={
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <UjianDashboardWidget data={statistikUjian} />
        </section>
      }
    />
  );
}

function MetricCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
  icon: typeof Inbox;
}) {
  return (
    <Link
      href={href}
      className="rounded-[24px] border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/35 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold text-foreground sm:text-3xl">
            {value}
          </p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-11 sm:w-11">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}

function WorkItem({
  title,
  description,
  value,
  href,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  value: number;
  href: string;
  icon: typeof Inbox;
  action: string;
}) {
  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-muted/25 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <Badge
            variant={value > 0 ? "default" : "secondary"}
            className="rounded-full"
          >
            {value}
          </Badge>
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
        <Link href={href}>{action}</Link>
      </Button>
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
  icon: typeof Inbox;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className="h-auto justify-start px-4 py-3 text-left"
    >
      <Link href={href}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

function statusSuratMasuk(status: string | null) {
  switch (status) {
    case "diterima":
      return "Diterima";
    case "diproses":
      return "Diproses";
    case "diarsip":
      return "Diarsip";
    case "dibatalkan":
      return "Dibatalkan";
    default:
      return "Belum ada status";
  }
}

function statusSuratKeluar(status: string | null) {
  switch (status) {
    case "draft":
      return "Draft";
    case "permohonan_persetujuan":
      return "Persetujuan";
    case "reviu":
      return "Reviu";
    case "pengarsipan":
      return "Pengarsipan";
    case "selesai":
      return "Selesai";
    case "dibatalkan":
      return "Dibatalkan";
    default:
      return "Belum ada status";
  }
}

function statusDisposisi(status: string | null) {
  switch (status) {
    case "belum_dibaca":
      return "Belum dibaca";
    case "dibaca":
      return "Dibaca";
    case "diproses":
      return "Diproses";
    case "selesai":
      return "Selesai";
    default:
      return "Belum ada status";
  }
}
