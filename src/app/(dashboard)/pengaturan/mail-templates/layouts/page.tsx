import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { LayoutListPage } from "@/components/mail-templates/layouts/LayoutListPage";
import { listLayouts } from "@/server/actions/mail-templates/layouts";

export const metadata: Metadata = {
  title: "Layouts | Mail Templates | ARKA",
};

export default async function LayoutsPage() {
  const layouts = await listLayouts();

  return (
    <PageWrapper
      title="Email Layouts"
      description="Kelola layout (header/footer) yang digunakan oleh template email."
    >
      <LayoutListPage initialLayouts={layouts} />
    </PageWrapper>
  );
}
