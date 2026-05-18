import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { GlobalKanbanBoard } from "@/components/projects/GlobalKanbanBoard";
import { listMyTasks } from "@/server/actions/projects";

export const metadata: Metadata = {
  title: "Kanban Board | Projects | ARKA",
};

export default async function KanbanPage() {
  const tasks = await listMyTasks();

  return (
    <PageWrapper
      title="Kanban Board"
      description="Lihat semua task yang di-assign ke kamu dalam satu board."
    >
      <GlobalKanbanBoard initialTasks={tasks} />
    </PageWrapper>
  );
}
