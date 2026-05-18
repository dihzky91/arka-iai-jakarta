import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { getAttendanceDashboard } from "@/server/actions/ppl-evaluasi/analytics";
import { AttendanceDashboardClient } from "@/components/ppl-evaluasi/analytics/AttendanceDashboardClient";

export const metadata: Metadata = {
  title: "Analytics Kehadiran & Kategori | ARKA",
};

export default async function AnalyticsPage() {
  const initialData = await getAttendanceDashboard({});

  return (
    <PageWrapper
      title="Analytics Kehadiran & Kategori"
      description="Dashboard tren kehadiran, conversion rate, dan perbandingan kategori PPL."
    >
      <AttendanceDashboardClient initialData={initialData} />
    </PageWrapper>
  );
}
