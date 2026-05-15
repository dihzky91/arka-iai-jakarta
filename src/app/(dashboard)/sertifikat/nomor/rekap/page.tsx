import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { YearlyReportView } from "@/components/sertifikat/YearlyReportView";
import {
  getAvailableYears,
  getYearlyStats,
  getYearlyProgramStats,
} from "@/server/actions/sertifikat/nomor/batches";

export const metadata: Metadata = {
  title: "Rekap Tahunan Sertifikat | ARKA",
  description:
    "Rekap statistik penomoran sertifikat per tahun, program, dan jenis kelas.",
};

export default async function Page() {
  const availableYears = await getAvailableYears();

  // Default: tampilkan tahun ini, atau tahun terbaru jika tidak ada data tahun ini
  const currentYear = new Date().getFullYear();
  const initialYear = availableYears.includes(currentYear)
    ? currentYear
    : (availableYears[0] ?? currentYear);

  const [initialStats, initialDetailStats] = await Promise.all([
    getYearlyStats(initialYear),
    getYearlyProgramStats(initialYear),
  ]);

  return (
    <PageWrapper
      title="Rekap Tahunan"
      description="Statistik penomoran sertifikat formal dikelompokkan per tahun, program, dan jenis kelas."
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/sertifikat/nomor">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Daftar Batch
          </Link>
        </Button>
      </div>
      <YearlyReportView
        availableYears={
          availableYears.length > 0 ? availableYears : [currentYear]
        }
        initialYear={initialYear}
        initialStats={initialStats}
        initialDetailStats={initialDetailStats}
      />
    </PageWrapper>
  );
}
