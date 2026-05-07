import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { FinanceReportView } from "@/components/keuangan/FinanceReportView";
import { getFinanceHonorariumRecap } from "@/server/actions/jadwal-otomatis/honorarium";
import { listInstructors } from "@/server/actions/jadwal-otomatis/instructors";

export const metadata: Metadata = {
  title: "Laporan Keuangan | ARKA",
};

export default async function Page() {
  const [recap, instructors] = await Promise.all([
    getFinanceHonorariumRecap(),
    listInstructors(),
  ]);

  return (
    <PageWrapper
      title="Laporan & Rekap Keuangan"
      description="Laporan pembayaran honorarium dan rekap periodik untuk tim keuangan."
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/keuangan">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Dashboard Keuangan
          </Link>
        </Button>
      </div>

      <FinanceReportView
        initialRecap={recap}
        instructors={instructors.map((instructor) => ({
          id: instructor.id,
          name: instructor.name,
        }))}
      />
    </PageWrapper>
  );
}
