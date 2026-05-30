"use server";

import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import {
  divisi,
  events,
  projectLabels,
  projectMembers,
  projectMilestones,
  projectTasks,
  projects,
  projectToLabels,
  users,
} from "@/server/db/schema";
import { requireCapability } from "@/server/actions/auth";
import {
  PROJECT_MEMBER_ROLES,
  PROJECT_STATUSES,
  type ProjectMemberRole,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/project-constants";
import {
  uuidSchema,
  eventIdSchema,
  projectSchema,
  attachProjectMeta,
  mapProjectBase,
  assertKelasUjianUnique,
  assertPplKegiatanUnique,
  logProjectActivity,
  notifyProjectUser,
  requireProjectMember,
  requireProjectRole,
  getProjectRole,
  getGlobalAccess,
  numberToNumeric,
  sanitizeDescription,
  resolveSkp,
  type ProjectLabelRow,
  type ProjectListRow,
} from "./_project-shared";

export type ProjectListResult = {
  rows: ProjectListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ProjectDetailRow = ProjectListRow & {
  description: string | null;
  eventId: number | null;
  eventName: string | null;
  kelasUjianId: string | null;
  isTemplate: boolean;
  templateSourceId: string | null;
  currentUserProjectRole: ProjectMemberRole | "admin";
};

export type ProjectMemberRow = {
  id: string;
  userId: string;
  namaLengkap: string | null;
  email: string | null;
  avatarUrl: string | null;
  divisiNama: string | null;
  role: ProjectMemberRole;
  addedAt: Date;
};

export type InviteUserRow = {
  id: string;
  namaLengkap: string | null;
  email: string;
  avatarUrl: string | null;
  divisiNama: string | null;
};

export async function listProjects(
  filters: {
    search?: string;
    type?: ProjectType | "all";
    status?: ProjectStatus | "all";
    labelId?: string | "all";
    page?: number;
    pageSize?: number;
  } = {},
): Promise<ProjectListResult> {
  const session = await requireCapability("projects:view");
  const access = await getGlobalAccess(session.user.id);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = [10, 25, 50].includes(filters.pageSize ?? 25) ? (filters.pageSize ?? 25) : 25;
  const offset = (page - 1) * pageSize;
  const conditions: SQL[] = [];

  if (filters.search?.trim()) {
    conditions.push(ilike(projects.title, `%${filters.search.trim()}%`));
  }
  if (filters.type && filters.type !== "all") {
    conditions.push(eq(projects.type, filters.type));
  }
  if (filters.status && filters.status !== "all") {
    conditions.push(eq(projects.status, filters.status));
  }
  if (filters.labelId && filters.labelId !== "all") {
    conditions.push(
      sql`exists (
        select 1 from project_to_labels ptl
        where ptl.project_id = ${projects.id}
          and ptl.label_id = ${filters.labelId}
      )`,
    );
  }
  if (!access.isAdmin) {
    conditions.push(
      sql`exists (
        select 1 from project_members pm
        where pm.project_id = ${projects.id}
          and pm.user_id = ${session.user.id}
      )`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [totalRow, rows] = await Promise.all([
    db.select({ total: count() }).from(projects).where(where),
    db
      .select({
        id: projects.id,
        title: projects.title,
        type: projects.type,
        status: projects.status,
        description: projects.description,
        startDate: projects.startDate,
        endDate: projects.endDate,
        priceMember: projects.priceMember,
        priceNonMember: projects.priceNonMember,
        tipePelaksanaan: projects.tipePelaksanaan,
        waktuMulai: projects.waktuMulai,
        waktuSelesai: projects.waktuSelesai,
        lokasi: projects.lokasi,
        maxPeserta: projects.maxPeserta,
        isWaitlistEnabled: projects.isWaitlistEnabled,
        skp: projects.skp,
        skpMode: projects.skpMode,
        halfDaySkp: projects.halfDaySkp,
        progress: projects.progress,
        kelasUjianId: projects.kelasUjianId,
        isTemplate: projects.isTemplate,
        templateSourceId: projects.templateSourceId,
        createdBy: projects.createdBy,
        createdByName: users.namaLengkap,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .leftJoin(users, eq(projects.createdBy, users.id))
      .where(where)
      .orderBy(desc(projects.updatedAt), desc(projects.createdAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  const hydrated = await attachProjectMeta(rows.map(mapProjectBase));
  const total = Number(totalRow[0]?.total ?? 0);
  return {
    rows: hydrated,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProjectById(id: string): Promise<ProjectDetailRow | null> {
  const projectId = uuidSchema.parse(id);
  const { session, role } = await requireProjectMember(projectId);

  const [row] = await db
    .select({
      id: projects.id,
      title: projects.title,
      type: projects.type,
      description: projects.description,
      status: projects.status,
      startDate: projects.startDate,
      endDate: projects.endDate,
      priceMember: projects.priceMember,
      priceNonMember: projects.priceNonMember,
      tipePelaksanaan: projects.tipePelaksanaan,
      waktuMulai: projects.waktuMulai,
      waktuSelesai: projects.waktuSelesai,
      lokasi: projects.lokasi,
      maxPeserta: projects.maxPeserta,
      isWaitlistEnabled: projects.isWaitlistEnabled,
      skp: projects.skp,
      skpMode: projects.skpMode,
      halfDaySkp: projects.halfDaySkp,
      progress: projects.progress,
      isTemplate: projects.isTemplate,
      templateSourceId: projects.templateSourceId,
      eventId: projects.eventId,
      eventName: events.namaKegiatan,
      kelasUjianId: projects.kelasUjianId,
      createdBy: projects.createdBy,
      createdByName: users.namaLengkap,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(users, eq(projects.createdBy, users.id))
    .leftJoin(events, eq(projects.eventId, events.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!row) return null;
  const [hydrated] = await attachProjectMeta([mapProjectBase(row)]);
  if (!hydrated) return null;

  void session;
  return {
    ...hydrated,
    description: row.description,
    eventId: row.eventId,
    eventName: row.eventName,
    kelasUjianId: row.kelasUjianId,
    currentUserProjectRole: role,
  };
}

export async function createProject(data: unknown) {
  const result = projectSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;

  try {
    const session = await requireCapability("projects:create");

    if (parsed.kelasUjianId) {
      const conflict = await assertKelasUjianUnique(parsed.kelasUjianId);
      if (conflict) return { ok: false as const, error: conflict };
    }

    if (parsed.pplKegiatanId) {
      const conflict = await assertPplKegiatanUnique(parsed.pplKegiatanId);
      if (conflict) return { ok: false as const, error: conflict };
    }

    const [row] = await db
      .insert(projects)
      .values({
        title: parsed.title,
        type: parsed.type,
        description: sanitizeDescription(parsed.description),
        startDate: parsed.startDate ?? null,
        endDate: parsed.endDate ?? null,
        priceMember: numberToNumeric(parsed.priceMember),
        priceNonMember: numberToNumeric(parsed.priceNonMember),
        tipePelaksanaan: parsed.tipePelaksanaan ?? null,
        waktuMulai: parsed.waktuMulai ?? null,
        waktuSelesai: parsed.waktuSelesai ?? null,
        lokasi: parsed.lokasi ?? null,
        maxPeserta: parsed.maxPeserta ?? null,
        isWaitlistEnabled: parsed.isWaitlistEnabled ?? false,
        status: parsed.status,
        skpMode: parsed.skpMode,
        skp: resolveSkp(parsed),
        halfDaySkp: parsed.halfDaySkp ?? null,
        eventId: parsed.eventId ?? null,
        kelasUjianId: parsed.kelasUjianId ?? null,
        pplKegiatanId: parsed.pplKegiatanId ?? null,
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning({ id: projects.id, title: projects.title });

    if (!row) throw new Error("INSERT_FAILED");

    await db.insert(projectMembers).values({
      projectId: row.id,
      userId: session.user.id,
      role: "owner",
      addedBy: session.user.id,
    });

    if (parsed.labelIds?.length) {
      await db.insert(projectToLabels).values(
        parsed.labelIds.map((labelId) => ({ projectId: row.id, labelId })),
      );
    }

    await logProjectActivity(row.id, session.user.id, "created", `Project "${row.title}" dibuat.`);
    revalidatePath("/projects");
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[projects] createProject failed", err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin membuat project." };
    if (message === "Unauthorized") return { ok: false as const, error: "Sesi tidak ditemukan. Silakan login ulang." };
    return { ok: false as const, error: `Gagal membuat project: ${message}` };
  }
}

export async function updateProject(id: string, data: unknown) {
  const schemaResult = projectSchema.safeParse(data);
  if (!schemaResult.success) {
    return { ok: false as const, error: schemaResult.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = schemaResult.data;
  const projectId = uuidSchema.parse(id);

  try {
    const { session } = await requireProjectRole(projectId, ["owner", "manager"]);

    if (parsed.kelasUjianId) {
      const conflict = await assertKelasUjianUnique(parsed.kelasUjianId, projectId);
      if (conflict) return { ok: false as const, error: conflict };
    }

    if (parsed.pplKegiatanId) {
      const conflict = await assertPplKegiatanUnique(parsed.pplKegiatanId, projectId);
      if (conflict) return { ok: false as const, error: conflict };
    }

    const [row] = await db
      .update(projects)
      .set({
        title: parsed.title,
        type: parsed.type,
        description: sanitizeDescription(parsed.description),
        startDate: parsed.startDate ?? null,
        endDate: parsed.endDate ?? null,
        priceMember: numberToNumeric(parsed.priceMember),
        priceNonMember: numberToNumeric(parsed.priceNonMember),
        tipePelaksanaan: parsed.tipePelaksanaan ?? null,
        waktuMulai: parsed.waktuMulai ?? null,
        waktuSelesai: parsed.waktuSelesai ?? null,
        lokasi: parsed.lokasi ?? null,
        maxPeserta: parsed.maxPeserta ?? null,
        isWaitlistEnabled: parsed.isWaitlistEnabled ?? false,
        status: parsed.status,
        skpMode: parsed.skpMode,
        skp: resolveSkp(parsed),
        halfDaySkp: parsed.halfDaySkp ?? null,
        eventId: parsed.eventId ?? null,
        kelasUjianId: parsed.kelasUjianId ?? null,
        pplKegiatanId: parsed.pplKegiatanId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning({ id: projects.id, title: projects.title });

    if (!row) return { ok: false as const, error: "Project tidak ditemukan." };

    await db.delete(projectToLabels).where(eq(projectToLabels.projectId, projectId));
    if (parsed.labelIds?.length) {
      await db.insert(projectToLabels).values(
        parsed.labelIds.map((labelId) => ({ projectId, labelId })),
      );
    }

    await logProjectActivity(projectId, session.user.id, "updated", `Project "${row.title}" diperbarui.`);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin mengubah project." };
    if (message === "Unauthorized") return { ok: false as const, error: "Sesi tidak ditemukan. Silakan login ulang." };
    return { ok: false as const, error: "Gagal memperbarui project." };
  }
}

export async function deleteProject(id: string) {
  try {
    const projectId = uuidSchema.parse(id);
    await requireProjectRole(projectId, ["owner"]);

    const [deleted] = await db
      .delete(projects)
      .where(eq(projects.id, projectId))
      .returning({ title: projects.title });

    if (!deleted) return { ok: false as const, error: "Project tidak ditemukan." };

    revalidatePath("/projects");
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin menghapus project." };
    if (message === "Unauthorized") return { ok: false as const, error: "Sesi tidak ditemukan. Silakan login ulang." };
    return { ok: false as const, error: "Gagal menghapus project." };
  }
}

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  try {
    const projectId = uuidSchema.parse(id);
    const parsedStatus = z.enum(PROJECT_STATUSES).parse(status);
    const { session } = await requireProjectRole(projectId, ["owner", "manager"]);

    const [row] = await db
      .update(projects)
      .set({ status: parsedStatus, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning({ id: projects.id, title: projects.title, status: projects.status });

    if (!row) return { ok: false as const, error: "Project tidak ditemukan." };

    await logProjectActivity(projectId, session.user.id, "status_changed", `Status diubah ke ${parsedStatus}.`);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin mengubah status project." };
    if (message === "Unauthorized") return { ok: false as const, error: "Sesi tidak ditemukan. Silakan login ulang." };
    return { ok: false as const, error: "Gagal mengubah status project." };
  }
}

export async function getProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  const rows = await db
    .select({
      id: projectMembers.id,
      userId: projectMembers.userId,
      namaLengkap: users.namaLengkap,
      email: users.email,
      avatarUrl: users.avatarUrl,
      divisiNama: divisi.nama,
      role: projectMembers.role,
      addedAt: projectMembers.addedAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .where(eq(projectMembers.projectId, parsedId))
    .orderBy(asc(projectMembers.role), asc(users.namaLengkap));

  return rows.map((row) => ({ ...row, role: row.role as ProjectMemberRole }));
}

export async function searchUsersForInvite(
  query: string,
  projectId: string,
): Promise<InviteUserRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectRole(parsedId, ["owner", "manager"]);
  const q = query.trim();

  const conditions: SQL[] = [
    eq(users.isActive, true),
    sql`not exists (
      select 1 from project_members pm
      where pm.project_id = ${parsedId}
        and pm.user_id = ${users.id}
    )`,
  ];

  if (q) {
    conditions.push(or(ilike(users.namaLengkap, `%${q}%`), ilike(users.email, `%${q}%`))!);
  }

  return db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
      email: users.email,
      avatarUrl: users.avatarUrl,
      divisiNama: divisi.nama,
    })
    .from(users)
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .where(and(...conditions))
    .orderBy(asc(users.namaLengkap))
    .limit(20);
}

export async function addProjectMembers(
  projectId: string,
  input: { userIds: string[]; role: ProjectMemberRole },
) {
  try {
    const parsedId = uuidSchema.parse(projectId);
    const role = z.enum(PROJECT_MEMBER_ROLES).parse(input.role);
    const userIds = Array.from(new Set(input.userIds)).filter(Boolean);
    const { session, role: actorRole } = await requireProjectRole(parsedId, ["owner", "manager"]);

    if (userIds.length === 0) return { ok: false as const, error: "Pilih minimal satu user." };
    if (actorRole === "manager" && role === "owner") {
      return { ok: false as const, error: "Manager tidak bisa menambahkan owner." };
    }

    await db
      .insert(projectMembers)
      .values(userIds.map((userId) => ({ projectId: parsedId, userId, role, addedBy: session.user.id })))
      .onConflictDoNothing();

    const [project] = await db
      .select({ title: projects.title })
      .from(projects)
      .where(eq(projects.id, parsedId))
      .limit(1);
    const actorName =
      (session.user as { namaLengkap?: string; name?: string }).namaLengkap ??
      session.user.name ??
      "User";

    await Promise.all(
      userIds
        .filter((userId) => userId !== session.user.id)
        .map((userId) =>
          notifyProjectUser({
            userId,
            type: "project_invitation",
            title: "Undangan Project",
            message: `Anda diundang ke project ${project?.title ?? "Project"} oleh ${actorName}`,
            entitasId: parsedId,
          }),
        ),
    );

    await logProjectActivity(parsedId, session.user.id, "member_added", `${userIds.length} anggota ditambahkan.`);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin mengelola anggota." };
    return { ok: false as const, error: "Gagal menambahkan anggota." };
  }
}

export async function removeProjectMember(projectId: string, userId: string) {
  try {
    const parsedId = uuidSchema.parse(projectId);
    const { session, role: actorRole } = await requireProjectRole(parsedId, ["owner", "manager"]);
    const targetRole = await getProjectRole(parsedId, userId);
    if (!targetRole) return { ok: false as const, error: "Anggota tidak ditemukan." };
    if (targetRole === "owner" && actorRole !== "owner" && actorRole !== "admin") {
      return { ok: false as const, error: "Manager tidak bisa menghapus owner." };
    }

    if (targetRole === "owner") {
      const [owners] = await db
        .select({ total: count() })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, parsedId), eq(projectMembers.role, "owner")));
      if (Number(owners?.total ?? 0) <= 1) {
        return { ok: false as const, error: "Owner terakhir tidak bisa dihapus." };
      }
    }

    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, parsedId), eq(projectMembers.userId, userId)));

    await logProjectActivity(parsedId, session.user.id, "member_removed", "Anggota project dihapus.");
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin mengelola anggota." };
    return { ok: false as const, error: "Gagal menghapus anggota." };
  }
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
) {
  try {
    const parsedId = uuidSchema.parse(projectId);
    const parsedRole = z.enum(PROJECT_MEMBER_ROLES).parse(role);
    const { session } = await requireProjectRole(parsedId, ["owner"]);
    const targetRole = await getProjectRole(parsedId, userId);
    if (!targetRole) return { ok: false as const, error: "Anggota tidak ditemukan." };

    if (targetRole === "owner" && parsedRole !== "owner") {
      const [owners] = await db
        .select({ total: count() })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, parsedId), eq(projectMembers.role, "owner")));
      if (Number(owners?.total ?? 0) <= 1) {
        return { ok: false as const, error: "Owner terakhir tidak bisa di-demote." };
      }
    }

    await db
      .update(projectMembers)
      .set({ role: parsedRole })
      .where(and(eq(projectMembers.projectId, parsedId), eq(projectMembers.userId, userId)));

    await logProjectActivity(parsedId, session.user.id, "member_role_updated", `Role anggota diubah ke ${parsedRole}.`);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin mengubah role anggota." };
    return { ok: false as const, error: "Gagal mengubah role anggota." };
  }
}

export async function listLabels(): Promise<ProjectLabelRow[]> {
  await requireCapability("projects:view");
  return db
    .select({ id: projectLabels.id, name: projectLabels.name, color: projectLabels.color, group: projectLabels.group })
    .from(projectLabels)
    .orderBy(asc(projectLabels.name));
}

export async function createLabel(name: string, color: string, group?: string | null) {
  await requireCapability("projects:create");
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(100),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      group: z.string().trim().max(50).optional().nullable(),
    })
    .parse({ name, color, group: group ?? null });

  const [row] = await db
    .insert(projectLabels)
    .values(parsed)
    .returning({ id: projectLabels.id, name: projectLabels.name, color: projectLabels.color, group: projectLabels.group });

  revalidatePath("/projects");
  return { ok: true as const, data: row };
}

export async function deleteProjectLabel(id: string) {
  try {
    await requireCapability("projects:create");
    const parsedId = uuidSchema.parse(id);

    await db.delete(projectLabels).where(eq(projectLabels.id, parsedId));
    revalidatePath("/projects");
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: `Gagal menghapus label: ${message}` };
  }
}

export async function listProjectEventOptions() {
  await requireCapability("projects:create");
  return db
    .select({ id: events.id, title: events.namaKegiatan, date: events.tanggalMulai })
    .from(events)
    .where(isNull(events.deletedAt))
    .orderBy(desc(events.tanggalMulai))
    .limit(100);
}

export async function duplicateProject(sourceId: string) {
  try {
    const parsedId = uuidSchema.parse(sourceId);
    const session = await requireCapability("projects:create");

    const [source] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, parsedId))
      .limit(1);

    if (!source) return { ok: false as const, error: "Project sumber tidak ditemukan." };

    const sourceRole = await getProjectRole(parsedId, session.user.id);
    const access = await getGlobalAccess(session.user.id);
    if (!access.isAdmin && !sourceRole) {
      return { ok: false as const, error: "Anda tidak memiliki akses ke project sumber." };
    }

    const [newProject] = await db
      .insert(projects)
      .values({
        title: `${source.title} (salinan)`,
        type: source.type,
        description: source.description,
        startDate: null,
        endDate: null,
        priceMember: source.priceMember,
        priceNonMember: source.priceNonMember,
        tipePelaksanaan: source.tipePelaksanaan,
        waktuMulai: source.waktuMulai,
        waktuSelesai: source.waktuSelesai,
        lokasi: source.lokasi,
        maxPeserta: source.maxPeserta,
        isWaitlistEnabled: source.isWaitlistEnabled,
        status: "not_started",
        skpMode: source.skpMode,
        skp: null,
        halfDaySkp: source.halfDaySkp,
        eventId: null,
        kelasUjianId: null,
        progress: 0,
        isTemplate: false,
        templateSourceId: parsedId,
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning({ id: projects.id, title: projects.title });

    if (!newProject) throw new Error("INSERT_FAILED");

    await db.insert(projectMembers).values({
      projectId: newProject.id,
      userId: session.user.id,
      role: "owner",
      addedBy: session.user.id,
    });

    // Copy labels
    const sourceLabels = await db
      .select({ labelId: projectToLabels.labelId })
      .from(projectToLabels)
      .where(eq(projectToLabels.projectId, parsedId));

    if (sourceLabels.length > 0) {
      await db.insert(projectToLabels).values(
        sourceLabels.map((l) => ({ projectId: newProject.id, labelId: l.labelId })),
      );
    }

    // Copy milestones (reset completion) — map by insertion order, not title
    const sourceMilestones = await db
      .select({ id: projectMilestones.id, title: projectMilestones.title, targetDate: projectMilestones.targetDate })
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, parsedId));

    const milestoneIdMap = new Map<string, string>();
    if (sourceMilestones.length > 0) {
      const insertedMilestones = await db
        .insert(projectMilestones)
        .values(sourceMilestones.map((m) => ({ projectId: newProject.id, title: m.title, targetDate: m.targetDate })))
        .returning({ id: projectMilestones.id });

      sourceMilestones.forEach((sm, idx) => {
        const newId = insertedMilestones[idx]?.id;
        if (newId) milestoneIdMap.set(sm.id, newId);
      });
    }

    // Copy tasks (reset status to todo, clear assignees)
    const sourceTasks = await db
      .select({
        title: projectTasks.title,
        description: projectTasks.description,
        dueDate: projectTasks.dueDate,
        milestoneId: projectTasks.milestoneId,
        relatedEntityType: projectTasks.relatedEntityType,
        relatedEntityId: projectTasks.relatedEntityId,
      })
      .from(projectTasks)
      .where(eq(projectTasks.projectId, parsedId));

    if (sourceTasks.length > 0) {
      await db.insert(projectTasks).values(
        sourceTasks.map((t) => ({
          projectId: newProject.id,
          title: t.title,
          description: t.description,
          assigneeId: null,
          status: "todo" as const,
          dueDate: null,
          milestoneId: t.milestoneId ? (milestoneIdMap.get(t.milestoneId) ?? null) : null,
          relatedEntityType: t.relatedEntityType,
          relatedEntityId: t.relatedEntityId,
          createdBy: session.user.id,
          updatedAt: new Date(),
        })),
      );
    }

    await logProjectActivity(newProject.id, session.user.id, "created", `Project diduplikat dari "${source.title}".`);
    revalidatePath("/projects");
    return { ok: true as const, data: newProject };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin menduplikat project." };
    return { ok: false as const, error: `Gagal menduplikat project: ${message}` };
  }
}

export async function listProjectTemplates() {
  await requireCapability("projects:view");

  const rows = await db
    .select({
      id: projects.id,
      title: projects.title,
      type: projects.type,
      description: projects.description,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.isTemplate, true))
    .orderBy(desc(projects.createdAt));

  return rows;
}

export type ProjectTemplateRow = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  createdAt: Date;
};

export async function createProjectFromTemplate(templateId: string, data: { title: string; startDate?: string; endDate?: string }) {
  try {
    const templateIdParsed = uuidSchema.parse(templateId);
    const titleSchema = z.string().trim().min(1).max(255);
    const parsedTitle = titleSchema.parse(data.title);

    const session = await requireCapability("projects:create");

    const [template] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, templateIdParsed), eq(projects.isTemplate, true)))
      .limit(1);

    if (!template) return { ok: false as const, error: "Template tidak ditemukan." };

    const [newProject] = await db
      .insert(projects)
      .values({
        title: parsedTitle,
        type: template.type,
        description: template.description,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        priceMember: template.priceMember,
        priceNonMember: template.priceNonMember,
        tipePelaksanaan: template.tipePelaksanaan,
        waktuMulai: template.waktuMulai,
        waktuSelesai: template.waktuSelesai,
        lokasi: template.lokasi,
        maxPeserta: template.maxPeserta,
        isWaitlistEnabled: template.isWaitlistEnabled,
        status: "not_started",
        skpMode: template.skpMode,
        skp: null,
        halfDaySkp: template.halfDaySkp,
        eventId: null,
        kelasUjianId: null,
        progress: 0,
        isTemplate: false,
        templateSourceId: templateIdParsed,
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning({ id: projects.id, title: projects.title });

    if (!newProject) throw new Error("INSERT_FAILED");

    await db.insert(projectMembers).values({
      projectId: newProject.id,
      userId: session.user.id,
      role: "owner",
      addedBy: session.user.id,
    });

    // Copy labels
    const templateLabels = await db
      .select({ labelId: projectToLabels.labelId })
      .from(projectToLabels)
      .where(eq(projectToLabels.projectId, templateIdParsed));

    if (templateLabels.length > 0) {
      await db.insert(projectToLabels).values(
        templateLabels.map((l) => ({ projectId: newProject.id, labelId: l.labelId })),
      );
    }

    // Copy milestones — map by insertion order, not title
    const templateMilestones = await db
      .select({ id: projectMilestones.id, title: projectMilestones.title, targetDate: projectMilestones.targetDate })
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, templateIdParsed));

    const milestoneIdMap = new Map<string, string>();
    if (templateMilestones.length > 0) {
      const insertedMilestones = await db
        .insert(projectMilestones)
        .values(templateMilestones.map((m) => ({ projectId: newProject.id, title: m.title, targetDate: m.targetDate })))
        .returning({ id: projectMilestones.id });

      templateMilestones.forEach((tm, idx) => {
        const newId = insertedMilestones[idx]?.id;
        if (newId) milestoneIdMap.set(tm.id, newId);
      });
    }

    // Copy tasks
    const templateTasks = await db
      .select({
        title: projectTasks.title,
        description: projectTasks.description,
        dueDate: projectTasks.dueDate,
        milestoneId: projectTasks.milestoneId,
        relatedEntityType: projectTasks.relatedEntityType,
        relatedEntityId: projectTasks.relatedEntityId,
      })
      .from(projectTasks)
      .where(eq(projectTasks.projectId, templateIdParsed));

    if (templateTasks.length > 0) {
      await db.insert(projectTasks).values(
        templateTasks.map((t) => ({
          projectId: newProject.id,
          title: t.title,
          description: t.description,
          assigneeId: null,
          status: "todo" as const,
          dueDate: null,
          milestoneId: t.milestoneId ? (milestoneIdMap.get(t.milestoneId) ?? null) : null,
          relatedEntityType: t.relatedEntityType,
          relatedEntityId: t.relatedEntityId,
          createdBy: session.user.id,
          updatedAt: new Date(),
        })),
      );
    }

    await logProjectActivity(newProject.id, session.user.id, "created", `Project dibuat dari template "${template.title}".`);
    revalidatePath("/projects");
    return { ok: true as const, data: newProject };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin membuat project." };
    return { ok: false as const, error: `Gagal membuat project dari template: ${message}` };
  }
}

export async function toggleProjectTemplate(id: string) {
  try {
    const projectId = uuidSchema.parse(id);
    const { session } = await requireProjectRole(projectId, ["owner", "manager"]);

    const [existing] = await db
      .select({ id: projects.id, title: projects.title, isTemplate: projects.isTemplate })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!existing) return { ok: false as const, error: "Project tidak ditemukan." };

    const nextIsTemplate = !existing.isTemplate;
    await db
      .update(projects)
      .set({ isTemplate: nextIsTemplate, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    const desc = nextIsTemplate
      ? `Project "${existing.title}" dijadikan template.`
      : `Project "${existing.title}" tidak lagi menjadi template.`;
    await logProjectActivity(projectId, session.user.id, "template_toggled", desc);

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin mengubah status template." };
    return { ok: false as const, error: `Gagal mengubah status template: ${message}` };
  }
}
