import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { getSpeakerPerformance } from "@/server/actions/ppl-evaluasi/analytics";
import { SpeakerPerformanceClient } from "@/components/ppl-evaluasi/analytics/SpeakerPerformanceClient";

export const metadata: Metadata = {
  title: "Performa Narasumber | ARKA",
};

export default async function NarasumberPerformancePage() {
  const initialData = await getSpeakerPerformance({});

  return (
    <PageWrapper
      title="Analisis Performa Narasumber"
      description="Ranking narasumber berdasarkan skor evaluasi, tren performa, dan statistik kegiatan."
    >
      <SpeakerPerformanceClient initialData={initialData} />
    </PageWrapper>
  );
}
