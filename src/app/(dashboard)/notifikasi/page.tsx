import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { NotifikasiPageClient } from "./NotifikasiPageClient";
import { getNotifications } from "@/server/actions/notifications";

export const metadata: Metadata = {
  title: "Notifikasi | ARKA",
};

export default async function NotifikasiPage() {
  const initialData = await getNotifications({ limit: 50 });

  return (
    <PageWrapper
      title="Notifikasi"
      description="Semua notifikasi disposisi, surat, project, dan honorarium Anda."
    >
      <NotifikasiPageClient initialData={initialData} />
    </PageWrapper>
  );
}
