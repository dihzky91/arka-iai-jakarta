import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { VersionHistoryPage } from "@/components/mail-templates/versions/VersionHistoryPage";
import { getTemplateById } from "@/server/actions/mail-templates/templates";
import { listVersions } from "@/server/actions/mail-templates/versions";

export const metadata: Metadata = {
  title: "Riwayat Versi | Mail Templates | ARKA",
};

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [template, versions] = await Promise.all([
    getTemplateById(id),
    listVersions(id),
  ]);

  if (!template) {
    notFound();
  }

  return (
    <PageWrapper
      title={`Riwayat Versi: ${template.templateName}`}
      description={`Key: ${template.templateKey} • Versi aktif: v${template.version}`}
    >
      <VersionHistoryPage
        template={template}
        versions={versions}
      />
    </PageWrapper>
  );
}
