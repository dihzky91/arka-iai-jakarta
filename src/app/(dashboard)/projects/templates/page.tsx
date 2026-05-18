import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ProjectTemplateList } from "@/components/projects/ProjectTemplateList";
import { listProjectTemplates } from "@/server/actions/projects";

export const metadata: Metadata = {
  title: "Templates | Projects | ARKA",
};

export default async function TemplatesPage() {
  const templates = await listProjectTemplates();

  return (
    <PageWrapper
      title="Project Templates"
      description="Kelola template project yang bisa di-clone untuk kegiatan berulang."
    >
      <ProjectTemplateList initialTemplates={templates} />
    </PageWrapper>
  );
}
