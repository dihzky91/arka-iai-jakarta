import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { HonorariumReport } from "@/components/jadwal-otomatis/HonorariumReport";
import { OutstandingHonorariumSection } from "@/components/jadwal-otomatis/OutstandingHonorariumSection";
import {
  getHonorariumReport,
  getOutstandingHonorariumSessions,
  getSuggestedHonorariumBatchPeriod,
  listHonorariumBatchesPage,
} from "@/server/actions/jadwal-otomatis/honorarium";
import { listInstructors } from "@/server/actions/jadwal-otomatis/instructors";
import { listPrograms } from "@/server/actions/jadwal-otomatis/programs";

export const metadata: Metadata = {
  title: "Honorarium | Jadwal Otomatis | ARKA",
};

export default async function Page() {
  const [report, batches, instructors, programs, suggestedBatchPeriod, outstanding] = await Promise.all([
    getHonorariumReport(),
    listHonorariumBatchesPage(),
    listInstructors(),
    listPrograms(),
    getSuggestedHonorariumBatchPeriod(),
    getOutstandingHonorariumSessions(),
  ]);

  return (
    <PageWrapper
      title="Laporan Honorarium Instruktur"
      description="Rekap honorarium berdasarkan periode, instruktur, dan program kelas."
    >
      <OutstandingHonorariumSection data={outstanding} />
      <HonorariumReport
        initialReport={report}
        initialBatches={batches}
        suggestedBatchPeriod={suggestedBatchPeriod}
        instructors={instructors.map((item) => ({
          id: item.id,
          name: item.name,
        }))}
        programs={programs.map((item) => ({ id: item.id, name: item.name }))}
      />
    </PageWrapper>
  );
}
