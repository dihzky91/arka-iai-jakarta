import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ProjectManager } from "@/components/projects/ProjectManager";
import {
  listLabels,
  listProjectEventOptions,
  listProjects,
} from "@/server/actions/projects";

export const metadata: Metadata = {
  title: "Projects | ARKA",
};

export default async function Page() {
  const [projectList, labels, eventOptions] = await Promise.all([
    listProjects(),
    listLabels(),
    listProjectEventOptions(),
  ]);

  return (
    <PageWrapper
      title="Projects"
      description="Ruang kolaborasi untuk perencanaan kegiatan, diskusi, file, dan anggota tim."
    >
      <ProjectManager
        initialProjectList={projectList}
        labels={labels}
        eventOptions={eventOptions}
      />
    </PageWrapper>
  );
}
