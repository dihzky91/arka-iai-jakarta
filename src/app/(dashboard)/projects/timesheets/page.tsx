import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { GlobalTimesheetView } from "@/components/projects/GlobalTimesheetView";
import {
  listGlobalTimesheets,
  getGlobalTimesheetSummary,
} from "@/server/actions/projects";

export const metadata: Metadata = {
  title: "Timesheets | Projects | ARKA",
};

export default async function TimesheetsPage() {
  const [timesheets, summary] = await Promise.all([
    listGlobalTimesheets(),
    getGlobalTimesheetSummary(),
  ]);

  return (
    <PageWrapper
      title="Timesheets"
      description="Ringkasan jam kerja semua anggota di seluruh project."
    >
      <GlobalTimesheetView initialTimesheets={timesheets} initialSummary={summary} />
    </PageWrapper>
  );
}
