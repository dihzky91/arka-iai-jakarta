import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { CreateTemplateForm } from "@/components/mail-templates/template-list/CreateTemplateForm";
import { listLayouts } from "@/server/actions/mail-templates/layouts";

export const metadata: Metadata = {
  title: "Buat Template Baru | Mail Templates | ARKA",
};

export default async function CreateTemplatePage() {
  const layouts = await listLayouts();

  return (
    <PageWrapper
      title="Buat Template Baru"
      description="Buat template email baru untuk sistem ARKA."
    >
      <CreateTemplateForm layouts={layouts} />
    </PageWrapper>
  );
}
