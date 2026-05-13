import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  CheckCircle2,
  Landmark,
  Lock,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FinancePaymentTrendChart } from "@/components/keuangan/FinancePaymentTrendChart";
import { getCurrentUserAccess } from "@/server/actions/auth";
import { getKeuanganDashboardMetrics } from "@/server/actions/statistics";
import { formatTanggalPendek } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard Keuangan | ARKA",
};

const PIPELINE_STAGES = [
  {
    key: "dikirim_ke_keuangan",
    label: "Antrian Masuk",
    description: "Batch masuk dari admin",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    countKey: "dikirimKeuangan",
  },
  {
    key: "diproses_keuangan",
    label: "Diproses",
    description: "Sedang diverifikasi",
    tone: "border-sky-200 bg-sky-50 text-sky-900",
    countKey: "diprosesKeuangan",
  },
  {
    key: "dibayar",
    label: "Dibayar",
    description: "Pembayaran selesai",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    countKey: "dibayar",
  },
  {
    key: "locked",
    label: "Locked",
    description: "Final dan terkunci",
    tone: "border-zinc-200 bg-zinc-50 text-zinc-900",
    countKey: "locked",
  },
] as const;

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export default async function Page() {
  const [access, metrics] = await Promise.all([
    getCurrentUserAccess(),
    getKeuanganDashboardMetrics(),
  ]);
  const isSuperAdmin = access?.isSuperAdmin === true;
  const hasAgingAlert = metrics.agingAlerts.length > 0;

  return (
    <PageWrapper
      title="Dashboard Keuangan"
      description="Pantau pipeline pembayaran honorarium, nominal outstanding, dan batch yang melewati SLA."
    >
      {hasAgingAlert ? (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-amber-950">
                  {metrics.agingAlerts.length} batch melewati SLA 7 hari
                </p>
                <p className="mt-1 text-sm text-amber-900">
                  Prioritaskan antrian masuk yang sudah lama menunggu proses.
                </p>
              </div>
            </div>
            {metrics.oldestPending ? (
              <Button asChild size="sm" className="shrink-0">
                <Link href={`/keuangan/honorarium/${metrics.oldestPending.id}`}>
                  Buka batch tertua
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={WalletCards}
          label="Outstanding"
          value={formatCurrency(metrics.totals.outstanding)}
          hint={`${metrics.statusCounts.dikirimKeuangan + metrics.statusCounts.diprosesKeuangan} batch aktif`}
        />
        <MetricTile
          icon={Landmark}
          label="Dibayar Bulan Ini"
          value={formatCurrency(metrics.totals.bulanIni)}
          hint="Berdasarkan tanggal bayar"
        />
        <MetricTile
          icon={BarChart3}
          label="Dibayar YTD"
          value={formatCurrency(metrics.totals.ytd)}
          hint="Akumulasi tahun berjalan"
        />
        <MetricTile
          icon={CheckCircle2}
          label="Total Dibayar"
          value={formatCurrency(metrics.totals.paidAllTime)}
          hint={`${metrics.statusCounts.dibayar + metrics.statusCounts.locked} batch selesai`}
        />
      </section>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>Pipeline Pembayaran</CardTitle>
          <CardDescription>
            Klik stage untuk membuka antrian dengan status terkait.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-3 lg:grid-cols-4">
            {PIPELINE_STAGES.map((stage) => {
              const count = metrics.statusCounts[stage.countKey];
              return (
                <Link
                  key={stage.key}
                  href={`/keuangan/honorarium?status=${stage.key}`}
                  className={`block rounded-lg border p-4 transition-colors hover:border-primary/50 ${stage.tone}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{stage.label}</p>
                      <p className="mt-1 text-xs opacity-80">
                        {stage.description}
                      </p>
                    </div>
                    <span className="text-2xl font-bold">{count}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tren Pembayaran Tahun Ini</CardTitle>
            <CardDescription>
              Nominal batch yang sudah dibayar atau locked per bulan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FinancePaymentTrendChart data={metrics.monthlyTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prioritas Antrian</CardTitle>
            <CardDescription>
              Batch dikirim ke keuangan yang paling lama menunggu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.oldestPending ? (
              <Link
                href={`/keuangan/honorarium/${metrics.oldestPending.id}`}
                className="block rounded-lg border border-border/60 p-4 transition-all hover:border-primary/20 hover:bg-muted/35 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Badge
                      variant={
                        metrics.oldestPending.waitingDays > 7
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {metrics.oldestPending.waitingDays} hari
                    </Badge>
                    <p className="mt-2 line-clamp-1 font-semibold">
                      {metrics.oldestPending.documentNumber}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Disubmit{" "}
                      {formatTanggalPendek(metrics.oldestPending.submittedAt)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm font-medium">
                  {formatCurrency(metrics.oldestPending.netAmount)}
                </p>
              </Link>
            ) : (
              <EmptyState
                icon={WalletCards}
                title="Tidak ada batch menunggu"
                description="Batch baru yang dikirim ke keuangan akan muncul di prioritas antrian."
                className="min-h-36"
              />
            )}

            {metrics.agingAlerts.length > 0 ? (
              <div className="space-y-2">
                {metrics.agingAlerts.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    href={`/keuangan/honorarium/${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/45"
                  >
                    <span className="min-w-0 truncate">
                      {item.documentNumber}
                    </span>
                    <span className="shrink-0 font-medium">
                      {item.waitingDays} hari
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>Akses Cepat</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-2">
          <Button asChild variant="outline" className="justify-between">
            <Link href="/keuangan/honorarium">
              <span className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Antrian Pembayaran Honorarium
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-between">
            <Link href="/keuangan/laporan">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Laporan dan Rekap
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {isSuperAdmin ? (
        <Card className="border-destructive/30">
          <CardHeader className="border-b border-border">
            <CardTitle>Super Admin</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Button
              asChild
              variant="outline"
              className="w-full justify-between"
            >
              <Link href="/jadwal-otomatis/honorarium">
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Kelola Honorarium (Full Access)
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </PageWrapper>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-normal">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
