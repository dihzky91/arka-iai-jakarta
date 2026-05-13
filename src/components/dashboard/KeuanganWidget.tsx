import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Clock,
  CheckCircle2,
  Lock,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { formatTanggalPendek } from "@/lib/utils";
import type {
  KeuanganMetrics,
  PendingBatchItem,
} from "@/server/actions/statistics";

interface KeuanganWidgetProps {
  metrics: KeuanganMetrics;
  pendingBatches: PendingBatchItem[];
}

const BATCH_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  dikirim_ke_keuangan: "Dikirim ke Keuangan",
  diproses_keuangan: "Diproses Keuangan",
  dibayar: "Dibayar",
  locked: "Terkunci",
};

function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function KeuanganWidget({
  metrics,
  pendingBatches,
}: KeuanganWidgetProps) {
  const needsAttention =
    metrics.batchDikirimKeuangan + metrics.batchDiprosesKeuangan;

  return (
    <>
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Antrian Masuk"
          value={String(metrics.batchDikirimKeuangan)}
          hint="Batch dikirim ke keuangan"
          href="/keuangan/honorarium"
          icon={AlertCircle}
          tone="amber"
        />
        <MetricCard
          label="Sedang Diproses"
          value={String(metrics.batchDiprosesKeuangan)}
          hint="Batch dalam proses keuangan"
          href="/keuangan/honorarium"
          icon={Clock}
          tone="blue"
        />
        <MetricCard
          label="Dibayar"
          value={String(metrics.batchDibayar)}
          hint="Batch sudah dibayar"
          href="/keuangan/honorarium"
          icon={CheckCircle2}
          tone="emerald"
        />
        <MetricCard
          label="Total Dibayar"
          value={formatRupiah(metrics.totalNominalDibayar)}
          hint={`${metrics.batchLocked} batch terkunci`}
          href="/keuangan"
          icon={Banknote}
          tone="violet"
        />
      </section>

      <section className="rounded-[24px] border border-border/60 bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              Antrian Pembayaran
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {needsAttention > 0
                ? `${needsAttention} batch honorarium menunggu diproses.`
                : "Tidak ada batch honorarium yang menunggu."}
            </p>
          </div>
          <Link
            href="/keuangan/honorarium"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline sm:text-sm"
          >
            Lihat semua
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {pendingBatches.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:mt-5">
            {pendingBatches.map((item) => (
              <Link
                key={item.id}
                href={`/keuangan/honorarium/${item.id}`}
                className="grid gap-2 rounded-2xl border border-border/60 bg-muted/25 p-4 transition-colors hover:bg-muted/45 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      {BATCH_STATUS_LABELS[item.status] ?? item.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Periode {formatTanggalPendek(item.periodStart)} –{" "}
                      {formatTanggalPendek(item.periodEnd)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">
                    {item.documentNumber}
                  </p>
                  {item.submittedAt && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Disubmit: {formatTanggalPendek(item.submittedAt)}
                    </p>
                  )}
                </div>
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground sm:mt-5">
            Belum ada batch honorarium yang perlu diproses.
          </div>
        )}
      </section>

      <section className="rounded-[24px] border border-border/60 bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Status Batch Honorarium
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan seluruh batch honorarium.
        </p>

        <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 xl:grid-cols-4">
          <StatusItem label="Draft" value={metrics.batchDraft} icon={Banknote} />
          <StatusItem label="Dikirim Keuangan" value={metrics.batchDikirimKeuangan} icon={AlertCircle} />
          <StatusItem label="Diproses" value={metrics.batchDiprosesKeuangan} icon={Clock} />
          <StatusItem label="Locked" value={metrics.batchLocked} icon={Lock} />
        </div>
      </section>
    </>
  );
}

function StatusItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/25 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
