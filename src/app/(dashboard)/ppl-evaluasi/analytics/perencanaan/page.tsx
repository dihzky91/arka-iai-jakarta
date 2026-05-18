import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { getPatternAnalysis } from "@/server/actions/ppl-evaluasi/analytics";
import { PatternAnalysisClient } from "@/components/ppl-evaluasi/analytics/PatternAnalysisClient";

export const metadata: Metadata = {
  title: "Analisis Pola Perencanaan | ARKA",
};

export default async function PerencanaanPage() {
  const initialData = await getPatternAnalysis({});

  return (
    <PageWrapper
      title="Analisis Pola Perencanaan Program Tahunan"
      description="Identifikasi pola historis kehadiran per kategori untuk perencanaan program PPL tahunan."
    >
      <PatternAnalysisClient initialData={initialData} />
    </PageWrapper>
  );
}
