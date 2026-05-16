import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { BatchTable } from "@/components/sertifikat/BatchTable";
import {
  listBatches,
  getCertDashboardStats,
} from "@/server/actions/sertifikat/nomor/batches";
import { listCertificatePrograms } from "@/server/actions/sertifikat/nomor/programs";
import { listCertificateClassTypes } from "@/server/actions/sertifikat/nomor/classTypes";
import { Hash, Layers, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Penomoran Sertifikat | ARKA",
  description:
    "Kelola batch penomoran sertifikat formal Brevet AB, Brevet C, BFA, dan program lainnya.",
};

export default async function Page() {
  const [batches, programs, classTypes, stats] = await Promise.all([
    listBatches(),
    listCertificatePrograms(),
    listCertificateClassTypes(),
    getCertDashboardStats(),
  ]);

  return (
    <PageWrapper
      title="Penomoran Sertifikat"
      description="Generate dan kelola batch nomor sertifikat formal dengan sistem serial berkesinambungan."
    >
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Batch</p>
            <p className="text-2xl font-semibold">{stats.totalBatches}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm flex items-center gap-4">
          <div className="rounded-lg bg-green-500/10 p-2.5">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Batch Aktif</p>
            <p className="text-2xl font-semibold">{stats.activeBatches}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm flex items-center gap-4">
          <div className="rounded-lg bg-blue-500/10 p-2.5">
            <Hash className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Sertifikat</p>
            <p className="text-2xl font-semibold">
              {stats.totalCertificates.toLocaleString("id-ID")}
            </p>
          </div>
        </div>
      </div>

      <BatchTable
        initialBatches={batches}
        programs={programs}
        classTypes={classTypes}
      />
    </PageWrapper>
  );
}
