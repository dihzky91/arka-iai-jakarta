import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ProjectDetail } from "@/components/projects/ProjectDetail";
import { requireSession } from "@/server/actions/auth";
import {
  getBrevetSummaryByProject,
  getProjectById,
  getProjectMembers,
  listComments,
  listProjectActivity,
  listProjectFiles,
  listProjectNotes,
  listProjectTasks,
  listProjectMilestones,
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
  const [project, session] = await Promise.all([getProjectById(id), requireSession()]);
  if (!project) notFound();

  const [members, comments, files, activity, tasks, milestones, notes, brevetSummary] = await Promise.all([
    getProjectMembers(id),
    listComments(id),
    listProjectFiles(id),
    listProjectActivity(id),
    listProjectTasks(id),
    listProjectMilestones(id),
    listProjectNotes(id),
    project.kelasUjianId ? getBrevetSummaryByProject(id) : Promise.resolve(null),
  ]);

  return (
    <PageWrapper title="Detail Project" description={project.title}>
      <ProjectDetail
        project={project}
        currentUserId={session.user.id}
        initialMembers={members}
        initialComments={comments}
        initialFiles={files}
        initialActivity={activity}
        initialTasks={tasks}
        initialMilestones={milestones}
        initialNotes={notes}
        initialBrevetSummary={brevetSummary}
        defaultTab={tab ?? "overview"}
      />
    </PageWrapper>
  );
}
