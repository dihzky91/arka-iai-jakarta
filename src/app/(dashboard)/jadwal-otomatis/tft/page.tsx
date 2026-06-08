import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { TftListView } from "@/components/tft/TftListView";
import { listPeriodeTft } from "@/server/actions/tft/periode";

export const metadata: Metadata = {
  title: "TFT - Rekrutmen Instruktur | ARKA",
};

export default async function Page() {
  const periodes = await listPeriodeTft();

  return (
    <PageWrapper
      title="Training for Trainers (TFT)"
      description="Kelola periode rekrutmen dan penilaian calon instruktur."
    >
      <TftListView periodes={periodes} />
    </PageWrapper>
  );
}
