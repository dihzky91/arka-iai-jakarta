"use server";

import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  projects,
  projectTasks,
  projectBudgetItems,
  projectExpenses,
  projectFiles,
  projectActivityLog,
  users,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface EmbeddedProjectData {
  projectId: string;
  title: string;
  status: string;
  progress: number;
  tasks: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
  };
  budget: {
    totalRencana: number;
    totalRealisasi: number;
  };
  fileCount: number;
  recentActivity: Array<{
    id: string;
    action: string;
    description: string | null;
    userName: string | null;
    createdAt: Date;
  }>;
}

export interface UnifiedTimelineEntry {
  id: string;
  source: "ppl" | "project";
  timestamp: Date;
  action: string;
  description: string;
  userName: string | null;
}

// ─── GET EMBEDDED PROJECT DATA ───────────────────────────────────────────────

export async function getEmbeddedProjectData(
  kegiatanId: number,
): Promise<EmbeddedProjectData | null> {
  await requirePermission("pplEvaluasi", "view");

  // Find linked project
  const [project] = await db
    .select({
      id: projects.id,
      title: projects.title,
      status: projects.status,
      progress: projects.progress,
    })
    .from(projects)
    .where(eq(projects.pplKegiatanId, kegiatanId))
    .limit(1);

  if (!project) return null;

  // Task counts
  const [taskAgg] = await db
    .select({
      total: count(),
      done: sql<number>`count(*) filter (where ${projectTasks.status} = 'done')`.mapWith(Number),
      inProgress: sql<number>`count(*) filter (where ${projectTasks.status} = 'in_progress')`.mapWith(Number),
    })
    .from(projectTasks)
    .where(eq(projectTasks.projectId, project.id));

  const total = taskAgg?.total ?? 0;
  const done = taskAgg?.done ?? 0;
  const inProgress = taskAgg?.inProgress ?? 0;

  // Budget summary
  const [budgetAgg] = await db
    .select({
      totalRencana: sql<number>`coalesce(sum(${projectBudgetItems.jumlahRencana}::numeric), 0)`.mapWith(Number),
    })
    .from(projectBudgetItems)
    .where(eq(projectBudgetItems.projectId, project.id));

  const [expenseAgg] = await db
    .select({
      totalRealisasi: sql<number>`coalesce(sum(${projectExpenses.jumlah}::numeric), 0)`.mapWith(Number),
    })
    .from(projectExpenses)
    .where(eq(projectExpenses.projectId, project.id));

  // File count (standalone files only)
  const [fileAgg] = await db
    .select({ count: count() })
    .from(projectFiles)
    .where(
      and(
        eq(projectFiles.projectId, project.id),
        isNull(projectFiles.commentId),
      ),
    );

  // Recent activity (last 5)
  const recentActivity = await db
    .select({
      id: projectActivityLog.id,
      action: projectActivityLog.action,
      description: projectActivityLog.description,
      userName: users.namaLengkap,
      createdAt: projectActivityLog.createdAt,
    })
    .from(projectActivityLog)
    .leftJoin(users, eq(projectActivityLog.userId, users.id))
    .where(eq(projectActivityLog.projectId, project.id))
    .orderBy(desc(projectActivityLog.createdAt))
    .limit(5);

  return {
    projectId: project.id,
    title: project.title,
    status: project.status,
    progress: project.progress,
    tasks: {
      total,
      done,
      inProgress,
      todo: total - done - inProgress,
    },
    budget: {
      totalRencana: budgetAgg?.totalRencana ?? 0,
      totalRealisasi: expenseAgg?.totalRealisasi ?? 0,
    },
    fileCount: fileAgg?.count ?? 0,
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      description: a.description,
      userName: a.userName,
      createdAt: a.createdAt,
    })),
  };
}
