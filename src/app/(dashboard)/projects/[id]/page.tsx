import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ProjectDetail } from "@/components/projects/ProjectDetail";
import {
  getProjectById,
  getProjectMembers,
  listComments,
  listProjectActivity,
  listProjectFiles,
} from "@/server/actions/projects";

export const metadata: Metadata = {
  title: "Detail Project | ARKA",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const project = await getProjectById(id);
  if (!project) notFound();

  const [members, comments, files, activity] = await Promise.all([
    getProjectMembers(id),
    listComments(id),
    listProjectFiles(id),
    listProjectActivity(id),
  ]);

  return (
    <PageWrapper title="Detail Project" description={project.title}>
      <ProjectDetail
        project={project}
        initialMembers={members}
        initialComments={comments}
        initialFiles={files}
        initialActivity={activity}
        defaultTab={tab ?? "overview"}
      />
    </PageWrapper>
  );
}
