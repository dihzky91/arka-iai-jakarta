import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ProjectReportView } from "@/components/projects/ProjectReportView";
import { getProjectsReport } from "@/server/actions/projects";

export const metadata: Metadata = {
  title: "Laporan | Projects | ARKA",
};

export default async function LaporanPage() {
  const report = await getProjectsReport();

  return (
    <PageWrapper
      title="Laporan Project"
      description="Ringkasan progress, anggaran, dan pengeluaran semua project."
    >
      <ProjectReportView initialReport={report} />
    </PageWrapper>
  );
}
