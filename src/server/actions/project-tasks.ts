"use server";

import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  jadwalUjian,
  kelasUjian,
  participants,
  pengawas,
  penugasanPengawas,
  projectMilestones,
  projects,
  projectTasks,
  users,
} from "@/server/db/schema";
import { requireSession } from "@/server/actions/auth";
import { type ProjectTaskStatus } from "@/lib/project-constants";
import {
  projectTaskCreateSchema,
  projectTaskUpdateSchema,
  projectMilestoneCreateSchema,
  projectMilestoneUpdateSchema,
} from "@/lib/validators/project-task.schema";
import {
  uuidSchema,
  logProjectActivity,
  notifyProjectUser,
  requireProjectMember,
  requireProjectRole,
  getProjectRole,
  getGlobalAccess,
  normalizeOptionalText,
} from "./_project-shared";

export type ProjectTaskRow = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatarUrl: string | null;
  status: ProjectTaskStatus;
  dueDate: string | null;
  milestoneId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectMilestoneRow = {
  id: string;
  projectId: string;
  title: string;
  targetDate: string | null;
  isCompleted: boolean;
  createdAt: Date;
};

export type BrevetJadwalSummary = {
  id: string;
  tanggalUjian: string;
  mataPelajaran: string[];
  jamMulai: string;
  jamSelesai: string;
  pengawasAssigned: boolean;
  pengawasNama: string | null;
};

export type BrevetSummary = {
  kelasUjianId: string;
  kelasNama: string;
  program: string;
  tipe: string;
  mode: string;
  lokasi: string | null;
  totalUjian: number;
  jadwal: BrevetJadwalSummary[];
};

export type ProjectParticipantCounts = {
  registered: number;
  waitlisted: number;
};

export type ProjectCapacityStatus = {
  registered: number;
  max: number | null;
  waitlistCount: number;
  isFull: boolean;
  isWaitlistEnabled: boolean;
};

export async function listProjectTasks(projectId: string): Promise<ProjectTaskRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  const rows = await db
    .select({
      id: projectTasks.id,
      projectId: projectTasks.projectId,
      title: projectTasks.title,
      description: projectTasks.description,
      assigneeId: projectTasks.assigneeId,
      assigneeName: users.namaLengkap,
      assigneeAvatarUrl: users.avatarUrl,
      status: projectTasks.status,
      dueDate: projectTasks.dueDate,
      milestoneId: projectTasks.milestoneId,
      relatedEntityType: projectTasks.relatedEntityType,
      relatedEntityId: projectTasks.relatedEntityId,
      createdBy: projectTasks.createdBy,
      createdAt: projectTasks.createdAt,
      updatedAt: projectTasks.updatedAt,
    })
    .from(projectTasks)
    .leftJoin(users, eq(projectTasks.assigneeId, users.id))
    .where(eq(projectTasks.projectId, parsedId))
    .orderBy(asc(projectTasks.status), asc(projectTasks.dueDate), desc(projectTasks.createdAt));

  if (rows.length === 0) return [];

  const creatorIds = [...new Set(rows.map((r) => r.createdBy))];
  const creators = await db
    .select({ id: users.id, namaLengkap: users.namaLengkap })
    .from(users)
    .where(inArray(users.id, creatorIds));

  const creatorMap = new Map(creators.map((c) => [c.id, c.namaLengkap]));

  return rows.map((row) => ({
    ...row,
    status: row.status as ProjectTaskStatus,
    createdByName: creatorMap.get(row.createdBy) ?? null,
  }));
}

export async function createProjectTask(projectId: string, data: unknown) {
  const result = projectTaskCreateSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;

  try {
    const parsedId = uuidSchema.parse(projectId);
    const { session, role } = await requireProjectMember(parsedId);
    if (role === "viewer") return { ok: false as const, error: "Viewer tidak bisa membuat task." };

    if (parsed.assigneeId && role !== "admin" && role !== "owner" && role !== "manager") {
      return { ok: false as const, error: "Anda tidak memiliki izin meng-assign task ke anggota lain." };
    }

    if (parsed.assigneeId) {
      const assigneeRole = await getProjectRole(parsedId, parsed.assigneeId);
      const assigneeAccess = await getGlobalAccess(parsed.assigneeId);
      if (!assigneeRole && !assigneeAccess.isAdmin) {
        return { ok: false as const, error: "Assignee bukan anggota project ini." };
      }
    }

    const [row] = await db
      .insert(projectTasks)
      .values({
        projectId: parsedId,
        title: parsed.title,
        description: normalizeOptionalText(parsed.description),
        assigneeId: parsed.assigneeId ?? null,
        status: parsed.status ?? "todo",
        dueDate: parsed.dueDate ?? null,
        milestoneId: parsed.milestoneId ?? null,
        relatedEntityType: parsed.relatedEntityType ?? null,
        relatedEntityId: parsed.relatedEntityId ?? null,
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning({ id: projectTasks.id, title: projectTasks.title });

    if (!row) throw new Error("INSERT_FAILED");

    await logProjectActivity(parsedId, session.user.id, "task_created", `Task "${row.title}" dibuat.`);

    if (parsed.assigneeId && parsed.assigneeId !== session.user.id) {
      const [project] = await db
        .select({ title: projects.title })
        .from(projects)
        .where(eq(projects.id, parsedId))
        .limit(1);
      const authorName =
        (session.user as { namaLengkap?: string; name?: string }).namaLengkap ??
        session.user.name ??
        "User";
      await notifyProjectUser({
        userId: parsed.assigneeId,
        type: "project_update",
        title: "Task Di-assign",
        message: `${authorName} meng-assign task "${row.title}" di project ${project?.title ?? "Project"}`,
        entitasId: parsedId,
      });
    }

    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin membuat task." };
    if (message === "Unauthorized") return { ok: false as const, error: "Sesi tidak ditemukan. Silakan login ulang." };
    return { ok: false as const, error: `Gagal membuat task: ${message}` };
  }
}

export async function updateProjectTask(id: string, data: unknown) {
  const result = projectTaskUpdateSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;

  try {
    const taskId = uuidSchema.parse(id);
    const session = await requireSession();

    const [existing] = await db
      .select({
        id: projectTasks.id,
        projectId: projectTasks.projectId,
        assigneeId: projectTasks.assigneeId,
        status: projectTasks.status,
        title: projectTasks.title,
        createdBy: projectTasks.createdBy,
      })
      .from(projectTasks)
      .where(eq(projectTasks.id, taskId))
      .limit(1);

    if (!existing) return { ok: false as const, error: "Task tidak ditemukan." };

    const access = await getGlobalAccess(session.user.id);
    const role = await getProjectRole(existing.projectId, session.user.id);
    const isAdmin = access.isAdmin;
    const isManager = role === "owner" || role === "manager";
    const isAssignee = existing.assigneeId === session.user.id;
    const isCreator = existing.createdBy === session.user.id;

    if (!isAdmin && role === "viewer") {
      return { ok: false as const, error: "Viewer tidak bisa mengubah task." };
    }
    if (!isAdmin && !isManager && !isAssignee && !isCreator) {
      return { ok: false as const, error: "Anda tidak memiliki izin mengubah task ini." };
    }
    if (!isAdmin && !isManager && parsed.assigneeId && parsed.assigneeId !== existing.assigneeId) {
      return { ok: false as const, error: "Anda tidak memiliki izin meng-assign task ke anggota lain." };
    }

    if (parsed.assigneeId && parsed.assigneeId !== existing.assigneeId) {
      const assigneeRole = await getProjectRole(existing.projectId, parsed.assigneeId);
      const assigneeAccess = await getGlobalAccess(parsed.assigneeId);
      if (!assigneeRole && !assigneeAccess.isAdmin) {
        return { ok: false as const, error: "Assignee bukan anggota project ini." };
      }
    }

    const newStatus = parsed.status ?? existing.status;
    const statusChanged = newStatus !== existing.status;

    const [row] = await db
      .update(projectTasks)
      .set({
        title: parsed.title,
        description: normalizeOptionalText(parsed.description),
        assigneeId: parsed.assigneeId ?? null,
        status: newStatus,
        dueDate: parsed.dueDate ?? null,
        milestoneId: parsed.milestoneId ?? null,
        relatedEntityType: parsed.relatedEntityType ?? null,
        relatedEntityId: parsed.relatedEntityId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(projectTasks.id, taskId))
      .returning({ id: projectTasks.id, title: projectTasks.title, projectId: projectTasks.projectId });

    if (!row) return { ok: false as const, error: "Task tidak ditemukan." };

    const action = statusChanged && newStatus === "done" ? "task_completed" : "task_updated";
    const desc =
      statusChanged && newStatus === "done"
        ? `Task "${row.title}" diselesaikan.`
        : `Task "${row.title}" diperbarui.`;
    await logProjectActivity(row.projectId, session.user.id, action, desc);

    if (statusChanged && newStatus === "done" && existing.createdBy !== session.user.id) {
      const [project] = await db
        .select({ title: projects.title })
        .from(projects)
        .where(eq(projects.id, row.projectId))
        .limit(1);
      const actorName =
        (session.user as { namaLengkap?: string; name?: string }).namaLengkap ??
        session.user.name ??
        "User";
      await notifyProjectUser({
        userId: existing.createdBy,
        type: "project_update",
        title: "Task Selesai",
        message: `${actorName} menyelesaikan task "${row.title}" di project ${project?.title ?? "Project"}`,
        entitasId: row.projectId,
      });
    }

    if (parsed.assigneeId && parsed.assigneeId !== existing.assigneeId && parsed.assigneeId !== session.user.id) {
      const [project] = await db
        .select({ title: projects.title })
        .from(projects)
        .where(eq(projects.id, row.projectId))
        .limit(1);
      const authorName =
        (session.user as { namaLengkap?: string; name?: string }).namaLengkap ??
        session.user.name ??
        "User";
      await notifyProjectUser({
        userId: parsed.assigneeId,
        type: "project_update",
        title: "Task Di-assign",
        message: `${authorName} meng-assign task "${row.title}" di project ${project?.title ?? "Project"}`,
        entitasId: row.projectId,
      });
    }

    if (statusChanged) {
      await recalculateProjectProgress(row.projectId);
    }

    revalidatePath(`/projects/${row.projectId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin mengubah task." };
    return { ok: false as const, error: `Gagal mengubah task: ${message}` };
  }
}

export async function deleteProjectTask(id: string) {
  try {
    const taskId = uuidSchema.parse(id);
    const session = await requireSession();

    const [existing] = await db
      .select({
        id: projectTasks.id,
        projectId: projectTasks.projectId,
        title: projectTasks.title,
        createdBy: projectTasks.createdBy,
        assigneeId: projectTasks.assigneeId,
      })
      .from(projectTasks)
      .where(eq(projectTasks.id, taskId))
      .limit(1);

    if (!existing) return { ok: false as const, error: "Task tidak ditemukan." };

    const access = await getGlobalAccess(session.user.id);
    const role = await getProjectRole(existing.projectId, session.user.id);

    if (!access.isAdmin && role === "viewer") {
      return { ok: false as const, error: "Viewer tidak bisa menghapus task." };
    }

    const canDelete =
      access.isAdmin ||
      role === "owner" ||
      role === "manager" ||
      existing.createdBy === session.user.id;

    if (!canDelete) return { ok: false as const, error: "Anda tidak memiliki izin menghapus task ini." };

    await db.delete(projectTasks).where(eq(projectTasks.id, taskId));

    await logProjectActivity(existing.projectId, session.user.id, "task_deleted", `Task "${existing.title}" dihapus.`);
    await recalculateProjectProgress(existing.projectId);

    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin menghapus task." };
    return { ok: false as const, error: `Gagal menghapus task: ${message}` };
  }
}

export async function listProjectMilestones(projectId: string): Promise<ProjectMilestoneRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  return db
    .select({
      id: projectMilestones.id,
      projectId: projectMilestones.projectId,
      title: projectMilestones.title,
      targetDate: projectMilestones.targetDate,
      isCompleted: projectMilestones.isCompleted,
      createdAt: projectMilestones.createdAt,
    })
    .from(projectMilestones)
    .where(eq(projectMilestones.projectId, parsedId))
    .orderBy(asc(projectMilestones.targetDate), asc(projectMilestones.createdAt));
}

export async function createProjectMilestone(projectId: string, data: unknown) {
  const result = projectMilestoneCreateSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;

  try {
    const parsedId = uuidSchema.parse(projectId);
    const { session, role } = await requireProjectRole(parsedId, ["owner", "manager"]);

    const [row] = await db
      .insert(projectMilestones)
      .values({ projectId: parsedId, title: parsed.title, targetDate: parsed.targetDate ?? null })
      .returning({ id: projectMilestones.id, title: projectMilestones.title });

    if (!row) throw new Error("INSERT_FAILED");

    await logProjectActivity(parsedId, session.user.id, "milestone_created", `Milestone "${row.title}" dibuat.`);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin membuat milestone." };
    return { ok: false as const, error: `Gagal membuat milestone: ${message}` };
  }
}

export async function updateProjectMilestone(id: string, data: unknown) {
  const result = projectMilestoneUpdateSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;

  try {
    const milestoneId = uuidSchema.parse(id);
    const session = await requireSession();

    const [existing] = await db
      .select({
        id: projectMilestones.id,
        projectId: projectMilestones.projectId,
        title: projectMilestones.title,
        isCompleted: projectMilestones.isCompleted,
      })
      .from(projectMilestones)
      .where(eq(projectMilestones.id, milestoneId))
      .limit(1);

    if (!existing) return { ok: false as const, error: "Milestone tidak ditemukan." };

    const role = await getProjectRole(existing.projectId, session.user.id);
    const access = await getGlobalAccess(session.user.id);
    if (!access.isAdmin && role !== "owner" && role !== "manager") {
      return { ok: false as const, error: "Anda tidak memiliki izin mengubah milestone." };
    }

    const [row] = await db
      .update(projectMilestones)
      .set({ title: parsed.title, targetDate: parsed.targetDate ?? null })
      .where(eq(projectMilestones.id, milestoneId))
      .returning({ id: projectMilestones.id, title: projectMilestones.title, projectId: projectMilestones.projectId });

    if (!row) return { ok: false as const, error: "Milestone tidak ditemukan." };

    await logProjectActivity(row.projectId, session.user.id, "milestone_updated", `Milestone "${row.title}" diperbarui.`);
    revalidatePath(`/projects/${row.projectId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin mengubah milestone." };
    return { ok: false as const, error: `Gagal mengubah milestone: ${message}` };
  }
}

export async function toggleProjectMilestone(id: string) {
  try {
    const milestoneId = uuidSchema.parse(id);
    const session = await requireSession();

    const [existing] = await db
      .select({
        id: projectMilestones.id,
        projectId: projectMilestones.projectId,
        title: projectMilestones.title,
        isCompleted: projectMilestones.isCompleted,
      })
      .from(projectMilestones)
      .where(eq(projectMilestones.id, milestoneId))
      .limit(1);

    if (!existing) return { ok: false as const, error: "Milestone tidak ditemukan." };

    const role = await getProjectRole(existing.projectId, session.user.id);
    const access = await getGlobalAccess(session.user.id);
    if (!access.isAdmin && role !== "owner" && role !== "manager") {
      return { ok: false as const, error: "Anda tidak memiliki izin mengubah milestone." };
    }

    const nextCompleted = !existing.isCompleted;
    const [row] = await db
      .update(projectMilestones)
      .set({ isCompleted: nextCompleted })
      .where(eq(projectMilestones.id, milestoneId))
      .returning({
        id: projectMilestones.id,
        title: projectMilestones.title,
        projectId: projectMilestones.projectId,
        isCompleted: projectMilestones.isCompleted,
      });

    if (!row) return { ok: false as const, error: "Milestone tidak ditemukan." };

    const action = nextCompleted ? "milestone_completed" : "milestone_reopened";
    const desc = nextCompleted
      ? `Milestone "${row.title}" diselesaikan.`
      : `Milestone "${row.title}" dibuka kembali.`;
    await logProjectActivity(row.projectId, session.user.id, action, desc);

    revalidatePath(`/projects/${row.projectId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin mengubah milestone." };
    return { ok: false as const, error: `Gagal mengubah milestone: ${message}` };
  }
}

export async function deleteProjectMilestone(id: string) {
  try {
    const milestoneId = uuidSchema.parse(id);
    const session = await requireSession();

    const [existing] = await db
      .select({
        id: projectMilestones.id,
        projectId: projectMilestones.projectId,
        title: projectMilestones.title,
      })
      .from(projectMilestones)
      .where(eq(projectMilestones.id, milestoneId))
      .limit(1);

    if (!existing) return { ok: false as const, error: "Milestone tidak ditemukan." };

    const role = await getProjectRole(existing.projectId, session.user.id);
    const access = await getGlobalAccess(session.user.id);
    if (!access.isAdmin && role !== "owner" && role !== "manager") {
      return { ok: false as const, error: "Anda tidak memiliki izin menghapus milestone." };
    }

    await db.delete(projectMilestones).where(eq(projectMilestones.id, milestoneId));

    await logProjectActivity(existing.projectId, session.user.id, "milestone_deleted", `Milestone "${existing.title}" dihapus.`);
    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin menghapus milestone." };
    return { ok: false as const, error: `Gagal menghapus milestone: ${message}` };
  }
}

export async function recalculateProjectProgress(projectId: string) {
  const parsedId = uuidSchema.parse(projectId);

  const [agg] = await db
    .select({
      total: count(),
      completed: sql<number>`count(*) filter (where ${projectTasks.status} = 'done')`.mapWith(Number),
    })
    .from(projectTasks)
    .where(eq(projectTasks.projectId, parsedId));

  const total = agg?.total ?? 0;
  const completed = agg?.completed ?? 0;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  await db
    .update(projects)
    .set({ progress, updatedAt: new Date() })
    .where(eq(projects.id, parsedId));
}

export async function getBrevetSummaryByProject(projectId: string): Promise<BrevetSummary | null> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  const [project] = await db
    .select({ kelasUjianId: projects.kelasUjianId })
    .from(projects)
    .where(eq(projects.id, parsedId))
    .limit(1);

  if (!project?.kelasUjianId) return null;

  const [kelas] = await db
    .select({
      namaKelas: kelasUjian.namaKelas,
      program: kelasUjian.program,
      tipe: kelasUjian.tipe,
      mode: kelasUjian.mode,
      lokasi: kelasUjian.lokasi,
    })
    .from(kelasUjian)
    .where(eq(kelasUjian.id, project.kelasUjianId))
    .limit(1);

  if (!kelas) return null;

  const jadwalRows = await db
    .select({
      id: jadwalUjian.id,
      tanggalUjian: jadwalUjian.tanggalUjian,
      mataPelajaran: jadwalUjian.mataPelajaran,
      jamMulai: jadwalUjian.jamMulai,
      jamSelesai: jadwalUjian.jamSelesai,
      pengawasId: penugasanPengawas.pengawasId,
      pengawasNama: pengawas.nama,
    })
    .from(jadwalUjian)
    .leftJoin(penugasanPengawas, eq(jadwalUjian.id, penugasanPengawas.ujianId))
    .leftJoin(pengawas, eq(penugasanPengawas.pengawasId, pengawas.id))
    .where(eq(jadwalUjian.kelasId, project.kelasUjianId))
    .orderBy(asc(jadwalUjian.tanggalUjian));

  const jadwalMap = new Map<string, BrevetJadwalSummary>();
  for (const row of jadwalRows) {
    if (!jadwalMap.has(row.id)) {
      jadwalMap.set(row.id, {
        id: row.id,
        tanggalUjian: row.tanggalUjian,
        mataPelajaran: row.mataPelajaran,
        jamMulai: row.jamMulai,
        jamSelesai: row.jamSelesai,
        pengawasAssigned: !!row.pengawasId,
        pengawasNama: row.pengawasNama ?? null,
      });
    }
  }

  return {
    kelasUjianId: project.kelasUjianId,
    kelasNama: kelas.namaKelas,
    program: kelas.program,
    tipe: kelas.tipe,
    mode: kelas.mode,
    lokasi: kelas.lokasi,
    totalUjian: jadwalMap.size,
    jadwal: Array.from(jadwalMap.values()),
  };
}

export async function autoGenerateBrevetTasks(projectId: string) {
  const parsedId = uuidSchema.parse(projectId);
  const { session } = await requireProjectRole(parsedId, ["owner", "manager"]);

  const summary = await getBrevetSummaryByProject(parsedId);
  if (!summary) {
    return { ok: false as const, error: "Project tidak terhubung ke kelas ujian." };
  }

  const newTasks: Array<{
    title: string;
    assigneeId: string | null;
    dueDate: string | null;
    relatedEntityType: string;
    relatedEntityId: string;
  }> = [
    {
      title: `Assign pengawas untuk semua ujian — ${summary.kelasNama}`,
      assigneeId: session.user.id,
      dueDate: null,
      relatedEntityType: "brevet",
      relatedEntityId: "pengawas",
    },
  ];

  for (const jadwal of summary.jadwal) {
    const materiStr = jadwal.mataPelajaran.join(", ");
    newTasks.push({
      title: `Siapkan soal ${materiStr} — ${jadwal.tanggalUjian}`,
      assigneeId: session.user.id,
      dueDate: jadwal.tanggalUjian,
      relatedEntityType: "brevet_ujian",
      relatedEntityId: jadwal.id,
    });
  }

  for (const jadwal of summary.jadwal) {
    newTasks.push({
      title: `Cetak & siapkan berkas ujian — ${jadwal.tanggalUjian}`,
      assigneeId: null,
      dueDate: jadwal.tanggalUjian,
      relatedEntityType: "brevet_ujian",
      relatedEntityId: jadwal.id,
    });
  }

  newTasks.push({
    title: `Input nilai & cetak sertifikat — ${summary.kelasNama}`,
    assigneeId: session.user.id,
    dueDate: null,
    relatedEntityType: "brevet",
    relatedEntityId: "selesai",
  });

  const existing = await db
    .select({ id: projectTasks.id })
    .from(projectTasks)
    .where(
      and(
        eq(projectTasks.projectId, parsedId),
        inArray(projectTasks.relatedEntityType, ["brevet", "brevet_ujian"]),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return { ok: false as const, error: "Tugas brevet sudah ada. Gunakan syncBrevetTasks untuk memperbarui." };
  }

  try {
    await db.insert(projectTasks).values(
      newTasks.map((task) => ({
        projectId: parsedId,
        title: task.title,
        assigneeId: task.assigneeId,
        status: "todo" as const,
        dueDate: task.dueDate,
        relatedEntityType: task.relatedEntityType,
        relatedEntityId: task.relatedEntityId,
        createdBy: session.user.id,
        updatedAt: new Date(),
      })),
    );

    await logProjectActivity(
      parsedId,
      session.user.id,
      "brevet_tasks_generated",
      `Task brevet di-generate untuk "${summary.kelasNama}" (${newTasks.length} task).`,
    );

    await recalculateProjectProgress(parsedId);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, count: newTasks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: `Gagal generate task: ${message}` };
  }
}

export async function syncBrevetTasks(projectId: string) {
  const parsedId = uuidSchema.parse(projectId);
  const { session } = await requireProjectRole(parsedId, ["owner", "manager"]);

  const summary = await getBrevetSummaryByProject(parsedId);
  if (!summary) {
    return { ok: false as const, error: "Project tidak terhubung ke kelas ujian." };
  }

  const newTasks = [
    {
      title: `Assign pengawas untuk semua ujian — ${summary.kelasNama}`,
      assigneeId: session.user.id,
      dueDate: null as string | null,
      relatedEntityType: "brevet",
      relatedEntityId: "pengawas",
    },
    ...summary.jadwal.map((jadwal) => ({
      title: `Siapkan soal ${jadwal.mataPelajaran.join(", ")} — ${jadwal.tanggalUjian}`,
      assigneeId: session.user.id,
      dueDate: jadwal.tanggalUjian as string | null,
      relatedEntityType: "brevet_ujian",
      relatedEntityId: jadwal.id,
    })),
    ...summary.jadwal.map((jadwal) => ({
      title: `Cetak & siapkan berkas ujian — ${jadwal.tanggalUjian}`,
      assigneeId: null as string | null,
      dueDate: jadwal.tanggalUjian as string | null,
      relatedEntityType: "brevet_ujian",
      relatedEntityId: jadwal.id,
    })),
    {
      title: `Input nilai & cetak sertifikat — ${summary.kelasNama}`,
      assigneeId: session.user.id,
      dueDate: null as string | null,
      relatedEntityType: "brevet",
      relatedEntityId: "selesai",
    },
  ];

  try {
    await db
      .delete(projectTasks)
      .where(
        and(
          eq(projectTasks.projectId, parsedId),
          inArray(projectTasks.relatedEntityType, ["brevet", "brevet_ujian"]),
        ),
      );

    await db.insert(projectTasks).values(
      newTasks.map((task) => ({
        projectId: parsedId,
        title: task.title,
        assigneeId: task.assigneeId,
        status: "todo" as const,
        dueDate: task.dueDate,
        relatedEntityType: task.relatedEntityType,
        relatedEntityId: task.relatedEntityId,
        createdBy: session.user.id,
        updatedAt: new Date(),
      })),
    );

    await logProjectActivity(
      parsedId,
      session.user.id,
      "brevet_tasks_synced",
      `Task brevet di-sync ulang untuk "${summary.kelasNama}" (${newTasks.length} task).`,
    );

    await recalculateProjectProgress(parsedId);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, count: newTasks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: `Gagal sync task: ${message}` };
  }
}

export async function getProjectParticipantCounts(projectId: string): Promise<ProjectParticipantCounts> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  const [project] = await db
    .select({ eventId: projects.eventId })
    .from(projects)
    .where(eq(projects.id, parsedId))
    .limit(1);

  if (!project?.eventId) return { registered: 0, waitlisted: 0 };

  const [agg] = await db
    .select({ registered: count() })
    .from(participants)
    .where(eq(participants.eventId, project.eventId));

  return { registered: Number(agg?.registered ?? 0), waitlisted: 0 };
}

export async function getProjectCapacityStatus(projectId: string): Promise<ProjectCapacityStatus> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  const [project] = await db
    .select({
      maxPeserta: projects.maxPeserta,
      isWaitlistEnabled: projects.isWaitlistEnabled,
      eventId: projects.eventId,
    })
    .from(projects)
    .where(eq(projects.id, parsedId))
    .limit(1);

  if (!project) {
    return { registered: 0, max: null, waitlistCount: 0, isFull: false, isWaitlistEnabled: false };
  }

  const participantCounts = await getProjectParticipantCounts(parsedId);
  const max = project.maxPeserta ? Number(project.maxPeserta) : null;

  return {
    registered: participantCounts.registered,
    max,
    waitlistCount: participantCounts.waitlisted,
    isFull: max != null && participantCounts.registered >= max,
    isWaitlistEnabled: project.isWaitlistEnabled,
  };
}
