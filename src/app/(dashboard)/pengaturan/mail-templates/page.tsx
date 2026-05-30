import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { TemplateListPage } from "@/components/mail-templates/template-list/TemplateListPage";
import { listTemplates } from "@/server/actions/mail-templates/templates";
import { listLayouts } from "@/server/actions/mail-templates/layouts";

export const metadata: Metadata = {
  title: "Mail Templates | ARKA",
};

export default async function MailTemplatesPage() {
  const [templates, layouts] = await Promise.all([
    listTemplates(),
    listLayouts(),
  ]);

  return (
    <PageWrapper
      title="Mail Templates"
      description="Kelola template email untuk seluruh sistem ARKA."
    >
      <TemplateListPage initialTemplates={templates} layouts={layouts} />
    </PageWrapper>
  );
}
