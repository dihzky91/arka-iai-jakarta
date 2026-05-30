import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { TemplateEditor } from "@/components/mail-templates/editor/TemplateEditor";
import { getTemplateById } from "@/server/actions/mail-templates/templates";
import { listLayouts } from "@/server/actions/mail-templates/layouts";
import { getAvailableVariables } from "@/server/actions/mail-templates/variables";

export const metadata: Metadata = {
  title: "Edit Template | Mail Templates | ARKA",
};

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [template, layouts, variables] = await Promise.all([
    getTemplateById(id),
    listLayouts(),
    getAvailableVariables(),
  ]);

  if (!template) {
    notFound();
  }

  return (
    <PageWrapper
      title={template.templateName}
      description={`Key: ${template.templateKey} • Kategori: ${template.category} • Versi ${template.version}`}
    >
      <TemplateEditor
        template={template}
        layouts={layouts}
        variables={variables}
      />
    </PageWrapper>
  );
}
