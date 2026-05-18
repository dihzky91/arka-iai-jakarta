"use server";

import { desc, eq, sql, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import {
  projects,
  projectTimesheets,
  projectExpenses,
  projectBudgetItems,
  projectTasks,
  users,
} from "@/server/db/schema";
import { requireCapability } from "@/server/actions/auth";

// ─── Global Timesheets (lintas project) ───────────────────────────────────────

export type GlobalTimesheetRow = {
  id: string;
  projectId: string;
  projectTitle: string;
  userId: string;
  userName: string | null;
  startTime: Date;
  endTime: Date | null;
  durationMinutes: number | null;
  description: string | null;
};

export async function listGlobalTimesheets(): Promise<GlobalTimesheetRow[]> {
  await requireCapability("projects:view");

  return db
    .select({
      id: projectTimesheets.id,
      projectId: projectTimesheets.projectId,
      projectTitle: projects.title,
      userId: projectTimesheets.userId,
      userName: users.namaLengkap,
      startTime: projectTimesheets.startTime,
      endTime: projectTimesheets.endTime,
      durationMinutes: projectTimesheets.durationMinutes,
      description: projectTimesheets.description,
    })
    .from(projectTimesheets)
    .innerJoin(projects, eq(projectTimesheets.projectId, projects.id))
    .leftJoin(users, eq(projectTimesheets.userId, users.id))
    .where(sql`${projectTimesheets.endTime} IS NOT NULL`)
    .orderBy(desc(projectTimesheets.startTime))
    .limit(200);
}

export type GlobalTimesheetSummary = {
  totalMinutes: number;
  totalProjects: number;
  byUser: { userId: string; userName: string | null; totalMinutes: number }[];
  byProject: { projectId: string; projectTitle: string; totalMinutes: number }[];
};

export async function getGlobalTimesheetSummary(): Promise<GlobalTimesheetSummary> {
  await requireCapability("projects:view");

  const rows = await db
    .select({
      projectId: projectTimesheets.projectId,
      projectTitle: projects.title,
      userId: projectTimesheets.userId,
      userName: users.namaLengkap,
      durationMinutes: projectTimesheets.durationMinutes,
    })
    .from(projectTimesheets)
    .innerJoin(projects, eq(projectTimesheets.projectId, projects.id))
    .leftJoin(users, eq(projectTimesheets.userId, users.id))
    .where(sql`${projectTimesheets.endTime} IS NOT NULL`);

  const byUserMap = new Map<string, { userName: string | null; totalMinutes: number }>();
  const byProjectMap = new Map<string, { projectTitle: string; totalMinutes: number }>();
  let totalMinutes = 0;

  for (const row of rows) {
    const duration = row.durationMinutes ?? 0;
    totalMinutes += duration;

    const userEntry = byUserMap.get(row.userId) ?? { userName: row.userName, totalMinutes: 0 };
    userEntry.totalMinutes += duration;
    byUserMap.set(row.userId, userEntry);

    const projEntry = byProjectMap.get(row.projectId) ?? { projectTitle: row.projectTitle, totalMinutes: 0 };
    projEntry.totalMinutes += duration;
    byProjectMap.set(row.projectId, projEntry);
  }

  const projectIds = new Set(rows.map((r) => r.projectId));

  return {
    totalMinutes,
    totalProjects: projectIds.size,
    byUser: Array.from(byUserMap.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes),
    byProject: Array.from(byProjectMap.entries())
      .map(([projectId, data]) => ({ projectId, ...data }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes),
  };
}

// ─── Global Laporan (ringkasan keuangan lintas project) ───────────────────────

export type ProjectReportRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  progress: number;
  totalBudget: number;
  totalExpenses: number;
  taskCount: number;
  taskDoneCount: number;
};

export async function getProjectsReport(): Promise<ProjectReportRow[]> {
  await requireCapability("projects:view");

  const projectRows = await db
    .select({
      id: projects.id,
      title: projects.title,
      type: projects.type,
      status: projects.status,
      progress: projects.progress,
    })
    .from(projects)
    .where(eq(projects.isTemplate, false))
    .orderBy(desc(projects.updatedAt));

  const results: ProjectReportRow[] = [];

  for (const project of projectRows) {
    const [budgetResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${projectBudgetItems.jumlahRencana}::numeric), 0)` })
      .from(projectBudgetItems)
      .where(eq(projectBudgetItems.projectId, project.id));

    const [expenseResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${projectExpenses.jumlah}::numeric), 0)` })
      .from(projectExpenses)
      .where(eq(projectExpenses.projectId, project.id));

    const [taskResult] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        done: sql<number>`COUNT(*) FILTER (WHERE ${projectTasks.status} = 'done')`,
      })
      .from(projectTasks)
      .where(eq(projectTasks.projectId, project.id));

    results.push({
      id: project.id,
      title: project.title,
      type: project.type,
      status: project.status,
      progress: project.progress ?? 0,
      totalBudget: Number(budgetResult?.total ?? 0),
      totalExpenses: Number(expenseResult?.total ?? 0),
      taskCount: Number(taskResult?.total ?? 0),
      taskDoneCount: Number(taskResult?.done ?? 0),
    });
  }

  return results;
}

// ─── Global Kanban (semua task user) ──────────────────────────────────────────

export type GlobalTaskRow = {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  status: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdAt: Date;
};

export async function listMyTasks(): Promise<GlobalTaskRow[]> {
  const session = await requireCapability("projects:view");

  return db
    .select({
      id: projectTasks.id,
      projectId: projectTasks.projectId,
      projectTitle: projects.title,
      title: projectTasks.title,
      status: projectTasks.status,
      assigneeId: projectTasks.assigneeId,
      assigneeName: users.namaLengkap,
      dueDate: projectTasks.dueDate,
      createdAt: projectTasks.createdAt,
    })
    .from(projectTasks)
    .innerJoin(projects, eq(projectTasks.projectId, projects.id))
    .leftJoin(users, eq(projectTasks.assigneeId, users.id))
    .where(eq(projectTasks.assigneeId, session.user.id))
    .orderBy(desc(projectTasks.createdAt))
    .limit(500);
}
