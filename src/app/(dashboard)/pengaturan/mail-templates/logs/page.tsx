import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { SendLogListPage } from "@/components/mail-templates/logs/SendLogListPage";
import { listSendLogs, getSendLogStats } from "@/server/actions/mail-templates/logs";

export const metadata: Metadata = {
  title: "Send Logs | Mail Templates | ARKA",
};

export default async function SendLogsPage() {
  const [logsResult, stats] = await Promise.all([
    listSendLogs({ page: 1, pageSize: 25 }),
    getSendLogStats(),
  ]);

  return (
    <PageWrapper
      title="Email Send Logs"
      description="Log pengiriman email dari seluruh sistem."
    >
      <SendLogListPage initialData={logsResult} stats={stats} />
    </PageWrapper>
  );
}
