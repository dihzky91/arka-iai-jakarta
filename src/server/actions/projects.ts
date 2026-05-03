"use server";

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/server/db";
import {
  divisi,
  events,
  notifications,
  projectActivityLog,
  projectCommentMentions,
  projectComments,
  projectFiles,
  projectLabels,
  projectMembers,
  projects,
  projectToLabels,
  users,
} from "@/server/db/schema";
import { env } from "@/lib/env";
import { parseDataUrl, sanitizeFileName } from "@/lib/storage/utils";
import { getStorageProvider } from "@/lib/storage";
import { calculateSKP } from "@/lib/skp-calculator";
import { sanitizeAnnouncementHtml } from "@/lib/html/announcementHtml";
import { requireCapability, requireSession } from "@/server/actions/auth";
import {
  PROJECT_MEMBER_ROLES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type ProjectMemberRole,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/project-constants";

const uuidSchema = z.string().uuid();
const eventIdSchema = z.coerce.number().int().positive().optional().nullable();

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
  .optional()
  .nullable();

const projectSchema = z
  .object({
    title: z.string().trim().min(1, "Judul wajib diisi.").max(255),
    type: z.enum(PROJECT_TYPES),
    description: z.string().optional().nullable(),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    price: z.coerce.number().nonnegative().optional().nullable(),
    status: z.enum(PROJECT_STATUSES).default("not_started"),
    skpMode: z.enum(["auto", "manual"]).default("auto"),
    skp: z.coerce.number().nonnegative().optional().nullable(),
    halfDaySkp: z.enum(["2", "4"]).optional().nullable(),
    eventId: eventIdSchema,
    labelIds: z.array(uuidSchema).optional(),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
    {
      message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
      path: ["endDate"],
    },
  );

const commentSchema = z.object({
  content: z.string().trim().min(1, "Komentar wajib diisi."),
  parentId: uuidSchema.optional().nullable(),
  isInternal: z.boolean().optional().default(false),
});

const uploadSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  dataUrl: z.string().min(1),
});

const projectMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/zip",
  "application/x-zip-compressed",
]);

export type ProjectLabelRow = {
  id: string;
  name: string;
  color: string;
};

export type ProjectListRow = {
  id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  price: string | null;
  skp: string | null;
  skpMode: string;
  halfDaySkp: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  labels: ProjectLabelRow[];
  memberCount: number;
  fileCount: number;
  commentCount: number;
};

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

export type ProjectCommentRow = {
  id: string;
  projectId: string;
  parentId: string | null;
  content: string;
  isInternal: boolean | null;
  isEdited: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  authorDivisi: string | null;
};

export type ProjectFileRow = {
  id: string;
  projectId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  uploaderId: string;
  uploaderName: string | null;
};

export type ProjectActivityRow = {
  id: string;
  action: string;
  description: string | null;
  createdAt: Date;
  userId: string;
  userName: string | null;
};

export type InviteUserRow = {
  id: string;
  namaLengkap: string | null;
  email: string;
  avatarUrl: string | null;
  divisiNama: string | null;
};

function isAdminSession(session: Awaited<ReturnType<typeof requireSession>>) {
  const user = session.user as { role?: string; isSuperAdmin?: boolean };
  return user.isSuperAdmin === true || user.role === "admin";
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeDescription(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return sanitizeAnnouncementHtml(trimmed);
}

function numberToNumeric(value?: number | null) {
  return value == null ? null : String(value);
}

function resolveSkp(data: z.infer<typeof projectSchema>) {
  if (data.skpMode === "manual") return numberToNumeric(data.skp);
  if (!data.startDate || !data.endDate) return null;

  const halfDay = data.halfDaySkp ? Number(data.halfDaySkp) : null;
  return String(calculateSKP(new Date(data.startDate), new Date(data.endDate), halfDay));
}

async function logProjectActivity(
  projectId: string,
  userId: string,
  action: string,
  description?: string,
) {
  await db.insert(projectActivityLog).values({
    projectId,
    userId,
    action,
    description,
  });
}

async function notifyProjectUser(input: {
  userId: string;
  type: typeof notifications.$inferInsert.type;
  title: string;
  message: string;
  entitasId: string;
}) {
  await db.insert(notifications).values({
    id: nanoid(),
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    entitasType: "project",
    entitasId: input.entitasId,
    isRead: false,
    isEmailSent: false,
  });
}

async function getGlobalAccess(userId: string) {
  const [row] = await db
    .select({
      role: users.role,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    role: row?.role ?? null,
    isAdmin: row?.isSuperAdmin === true || row?.role === "admin",
  };
}

async function getProjectRole(projectId: string, userId: string) {
  const [member] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    )
    .limit(1);

  return (member?.role as ProjectMemberRole | undefined) ?? null;
}

async function requireProjectMember(projectId: string) {
  const session = await requireSession();
  const access = await getGlobalAccess(session.user.id);
  if (access.isAdmin) {
    return { session, role: "admin" as const };
  }

  const role = await getProjectRole(projectId, session.user.id);
  if (!role) throw new Error("Forbidden");
  return { session, role };
}

async function requireProjectRole(
  projectId: string,
  allowed: ProjectMemberRole[],
) {
  const result = await requireProjectMember(projectId);
  if (result.role === "admin") return result;
  if (!allowed.includes(result.role)) throw new Error("Forbidden");
  return result;
}

function canWrite(role: ProjectMemberRole | "admin") {
  return role === "admin" || role === "owner" || role === "manager";
}

async function attachProjectMeta<T extends { id: string }>(
  rows: T[],
): Promise<Array<T & Pick<ProjectListRow, "labels" | "memberCount" | "fileCount" | "commentCount">>> {
  if (rows.length === 0) return [];
  const projectIds = rows.map((row) => row.id);

  const [labelRows, memberCounts, fileCounts, commentCounts] =
    await Promise.all([
      db
        .select({
          projectId: projectToLabels.projectId,
          id: projectLabels.id,
          name: projectLabels.name,
          color: projectLabels.color,
        })
        .from(projectToLabels)
        .innerJoin(projectLabels, eq(projectToLabels.labelId, projectLabels.id))
        .where(inArray(projectToLabels.projectId, projectIds))
        .orderBy(asc(projectLabels.name)),
      db
        .select({
          projectId: projectMembers.projectId,
          total: count(),
        })
        .from(projectMembers)
        .where(inArray(projectMembers.projectId, projectIds))
        .groupBy(projectMembers.projectId),
      db
        .select({
          projectId: projectFiles.projectId,
          total: count(),
        })
        .from(projectFiles)
        .where(inArray(projectFiles.projectId, projectIds))
        .groupBy(projectFiles.projectId),
      db
        .select({
          projectId: projectComments.projectId,
          total: count(),
        })
        .from(projectComments)
        .where(inArray(projectComments.projectId, projectIds))
        .groupBy(projectComments.projectId),
    ]);

  return rows.map((row) => ({
    ...row,
    labels: labelRows
      .filter((label) => label.projectId === row.id)
      .map(({ projectId: _projectId, ...label }) => label),
    memberCount:
      Number(memberCounts.find((item) => item.projectId === row.id)?.total) || 0,
    fileCount:
      Number(fileCounts.find((item) => item.projectId === row.id)?.total) || 0,
    commentCount:
      Number(commentCounts.find((item) => item.projectId === row.id)?.total) ||
      0,
  }));
}

function mapProjectBase(row: {
  id: string;
  title: string;
  type: string;
  status: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  price: string | null;
  skp: string | null;
  skpMode: string;
  halfDaySkp: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    type: row.type as ProjectType,
    status: row.status as ProjectStatus,
  };
}

export async function listProjects(filters: {
  search?: string;
  type?: ProjectType | "all";
  status?: ProjectStatus | "all";
  labelId?: string | "all";
  page?: number;
  pageSize?: number;
} = {}): Promise<ProjectListResult> {
  const session = await requireCapability("projects:view");
  const access = await getGlobalAccess(session.user.id);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = [10, 25, 50].includes(filters.pageSize ?? 25)
    ? (filters.pageSize ?? 25)
    : 25;
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
        price: projects.price,
        skp: projects.skp,
        skpMode: projects.skpMode,
        halfDaySkp: projects.halfDaySkp,
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
      price: projects.price,
      skp: projects.skp,
      skpMode: projects.skpMode,
      halfDaySkp: projects.halfDaySkp,
      eventId: projects.eventId,
      eventName: events.namaKegiatan,
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

    const [row] = await db
      .insert(projects)
      .values({
        title: parsed.title,
        type: parsed.type,
        description: sanitizeDescription(parsed.description),
        startDate: parsed.startDate ?? null,
        endDate: parsed.endDate ?? null,
        price: numberToNumeric(parsed.price),
        status: parsed.status,
        skpMode: parsed.skpMode,
        skp: resolveSkp(parsed),
        halfDaySkp: parsed.halfDaySkp ?? null,
        eventId: parsed.eventId ?? null,
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

  try {
    await requireCapability("projects:edit");
    const projectId = uuidSchema.parse(id);
    const { session } = await requireProjectRole(projectId, ["owner", "manager"]);

    const [row] = await db
      .update(projects)
      .set({
        title: parsed.title,
        type: parsed.type,
        description: sanitizeDescription(parsed.description),
        startDate: parsed.startDate ?? null,
        endDate: parsed.endDate ?? null,
        price: numberToNumeric(parsed.price),
        status: parsed.status,
        skpMode: parsed.skpMode,
        skp: resolveSkp(parsed),
        halfDaySkp: parsed.halfDaySkp ?? null,
        eventId: parsed.eventId ?? null,
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
    await requireCapability("projects:delete");
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

  return rows.map((row) => ({
    ...row,
    role: row.role as ProjectMemberRole,
  }));
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
    const { session, role: actorRole } = await requireProjectRole(parsedId, [
      "owner",
      "manager",
    ]);

    if (userIds.length === 0) return { ok: false as const, error: "Pilih minimal satu user." };
    if (actorRole === "manager" && role === "owner") {
      return { ok: false as const, error: "Manager tidak bisa menambahkan owner." };
    }

    await db
      .insert(projectMembers)
      .values(
        userIds.map((userId) => ({
          projectId: parsedId,
          userId,
          role,
          addedBy: session.user.id,
        })),
      )
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
    const { session, role: actorRole } = await requireProjectRole(parsedId, [
      "owner",
      "manager",
    ]);
    const targetRole = await getProjectRole(parsedId, userId);
    if (!targetRole) return { ok: false as const, error: "Anggota tidak ditemukan." };
    if (targetRole === "owner" && actorRole !== "owner" && actorRole !== "admin") {
      return { ok: false as const, error: "Manager tidak bisa menghapus owner." };
    }

    if (targetRole === "owner") {
      const [owners] = await db
        .select({ total: count() })
        .from(projectMembers)
        .where(
          and(eq(projectMembers.projectId, parsedId), eq(projectMembers.role, "owner")),
        );
      if (Number(owners?.total ?? 0) <= 1) {
        return { ok: false as const, error: "Owner terakhir tidak bisa dihapus." };
      }
    }

    await db
      .delete(projectMembers)
      .where(
        and(eq(projectMembers.projectId, parsedId), eq(projectMembers.userId, userId)),
      );

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
        .where(
          and(eq(projectMembers.projectId, parsedId), eq(projectMembers.role, "owner")),
        );
      if (Number(owners?.total ?? 0) <= 1) {
        return { ok: false as const, error: "Owner terakhir tidak bisa di-demote." };
      }
    }

    await db
      .update(projectMembers)
      .set({ role: parsedRole })
      .where(
        and(eq(projectMembers.projectId, parsedId), eq(projectMembers.userId, userId)),
      );

    await logProjectActivity(parsedId, session.user.id, "member_role_updated", `Role anggota diubah ke ${parsedRole}.`);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin mengubah role anggota." };
    return { ok: false as const, error: "Gagal mengubah role anggota." };
  }
}

export async function listComments(projectId: string): Promise<ProjectCommentRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  return db
    .select({
      id: projectComments.id,
      projectId: projectComments.projectId,
      parentId: projectComments.parentId,
      content: projectComments.content,
      isInternal: projectComments.isInternal,
      isEdited: projectComments.isEdited,
      createdAt: projectComments.createdAt,
      updatedAt: projectComments.updatedAt,
      authorId: projectComments.userId,
      authorName: users.namaLengkap,
      authorAvatarUrl: users.avatarUrl,
      authorDivisi: divisi.nama,
    })
    .from(projectComments)
    .innerJoin(users, eq(projectComments.userId, users.id))
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .where(eq(projectComments.projectId, parsedId))
    .orderBy(asc(projectComments.createdAt));
}

export async function createComment(projectId: string, data: unknown) {
  const dataResult = commentSchema.safeParse(data);
  if (!dataResult.success) {
    return { ok: false as const, error: dataResult.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = dataResult.data;

  try {
    await requireCapability("projects:comment");
    const parsedId = uuidSchema.parse(projectId);
    const { session, role } = await requireProjectMember(parsedId);
    if (role === "viewer") return { ok: false as const, error: "Viewer tidak bisa berkomentar." };

    const [comment] = await db
      .insert(projectComments)
      .values({
        projectId: parsedId,
        userId: session.user.id,
        parentId: parsed.parentId ?? null,
        content: parsed.content,
        isInternal: parsed.isInternal,
      })
      .returning({ id: projectComments.id, content: projectComments.content });

    if (!comment) return { ok: false as const, error: "Gagal menyimpan komentar." };

    const [project] = await db
      .select({ title: projects.title })
      .from(projects)
      .where(eq(projects.id, parsedId))
      .limit(1);
    const members = await getProjectMembers(parsedId);
    const loweredContent = parsed.content.toLowerCase();
    const mentioned = members.filter(
      (member) =>
        member.userId !== session.user.id &&
        member.namaLengkap &&
        loweredContent.includes(`@${member.namaLengkap.toLowerCase()}`),
    );

    if (mentioned.length) {
      await db.insert(projectCommentMentions).values(
        mentioned.map((member) => ({
          commentId: comment.id,
          userId: member.userId,
        })),
      );
      const authorName =
        (session.user as { namaLengkap?: string; name?: string }).namaLengkap ??
        session.user.name ??
        "User";
      await Promise.all(
        mentioned.map((member) =>
          notifyProjectUser({
            userId: member.userId,
            type: "mention",
            title: "Mention Project",
            message: `${authorName} mention Anda di project ${project?.title ?? "Project"}`,
            entitasId: parsedId,
          }),
        ),
      );
    }

    await logProjectActivity(parsedId, session.user.id, "comment_added", "Komentar baru ditambahkan.");
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: comment };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin berkomentar." };
    return { ok: false as const, error: "Gagal menyimpan komentar." };
  }
}

export async function updateComment(commentId: string, content: string) {
  const parsedCommentId = uuidSchema.parse(commentId);
  const trimmedContent = content.trim();
  if (!trimmedContent) return { ok: false as const, error: "Komentar tidak boleh kosong." };
  const session = await requireSession();
  const [existing] = await db
    .select({
      id: projectComments.id,
      projectId: projectComments.projectId,
      userId: projectComments.userId,
    })
    .from(projectComments)
    .where(eq(projectComments.id, parsedCommentId))
    .limit(1);
  if (!existing) return { ok: false as const, error: "Komentar tidak ditemukan." };
  if (existing.userId !== session.user.id && !isAdminSession(session)) {
    return { ok: false as const, error: "Hanya author yang bisa mengubah komentar." };
  }

  await db
    .update(projectComments)
    .set({ content: trimmedContent, isEdited: true, updatedAt: new Date() })
    .where(eq(projectComments.id, parsedCommentId));

  revalidatePath(`/projects/${existing.projectId}`);
  return { ok: true as const };
}

export async function deleteComment(commentId: string) {
  const parsedCommentId = uuidSchema.parse(commentId);
  const session = await requireSession();
  const [existing] = await db
    .select({
      id: projectComments.id,
      projectId: projectComments.projectId,
      userId: projectComments.userId,
    })
    .from(projectComments)
    .where(eq(projectComments.id, parsedCommentId))
    .limit(1);
  if (!existing) return { ok: false as const, error: "Komentar tidak ditemukan." };

  const role = await getProjectRole(existing.projectId, session.user.id);
  const canDelete =
    existing.userId === session.user.id ||
    isAdminSession(session) ||
    role === "owner";
  if (!canDelete) return { ok: false as const, error: "Tidak boleh menghapus komentar." };

  await db.delete(projectComments).where(eq(projectComments.id, parsedCommentId));
  await logProjectActivity(existing.projectId, session.user.id, "comment_deleted", "Komentar dihapus.");
  revalidatePath(`/projects/${existing.projectId}`);
  return { ok: true as const };
}

export async function listProjectFiles(projectId: string): Promise<ProjectFileRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  return db
    .select({
      id: projectFiles.id,
      projectId: projectFiles.projectId,
      fileName: projectFiles.fileName,
      fileUrl: projectFiles.fileUrl,
      fileSize: projectFiles.fileSize,
      mimeType: projectFiles.mimeType,
      uploadedAt: projectFiles.uploadedAt,
      uploaderId: projectFiles.userId,
      uploaderName: users.namaLengkap,
    })
    .from(projectFiles)
    .innerJoin(users, eq(projectFiles.userId, users.id))
    .where(eq(projectFiles.projectId, parsedId))
    .orderBy(desc(projectFiles.uploadedAt));
}

export async function uploadProjectFile(projectId: string, data: unknown) {
  const dataResult = uploadSchema.safeParse(data);
  if (!dataResult.success) {
    return { ok: false as const, error: dataResult.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = dataResult.data;

  try {
    await requireCapability("projects:upload");
    const parsedId = uuidSchema.parse(projectId);
    const { session, role } = await requireProjectMember(parsedId);
    if (role === "viewer") return { ok: false as const, error: "Viewer tidak bisa upload file." };

    const payload = parseDataUrl(parsed.dataUrl);
    const contentType = parsed.contentType.trim().toLowerCase();
    if (contentType !== payload.contentType) {
      return { ok: false as const, error: "Tipe file tidak konsisten." };
    }
    if (!projectMimeTypes.has(contentType)) {
      return { ok: false as const, error: "Tipe file tidak didukung." };
    }

    const maxBytes = Math.max(1, env.STORAGE_MAX_FILE_MB || 20) * 1024 * 1024;
    if (payload.body.byteLength > maxBytes) {
      return { ok: false as const, error: `Ukuran file melebihi ${env.STORAGE_MAX_FILE_MB || 20} MB.` };
    }

    const storage = getStorageProvider();
    const uploaded = await storage.upload({
      body: payload.body,
      fileName: sanitizeFileName(parsed.fileName),
      contentType,
      folder: `projects/${parsedId}`,
    });

    const [row] = await db
      .insert(projectFiles)
      .values({
        projectId: parsedId,
        userId: session.user.id,
        fileName: uploaded.fileName || sanitizeFileName(parsed.fileName),
        fileUrl: uploaded.url,
        storageKey: uploaded.key,
        fileSize: uploaded.size ?? payload.body.byteLength,
        mimeType: contentType,
      })
      .returning({ id: projectFiles.id, fileName: projectFiles.fileName });

    await logProjectActivity(parsedId, session.user.id, "file_uploaded", `Uploaded ${row?.fileName ?? parsed.fileName}.`);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin upload file." };
    return { ok: false as const, error: "Gagal upload file." };
  }
}

export async function deleteProjectFile(fileId: string) {
  const parsedFileId = uuidSchema.parse(fileId);
  const session = await requireSession();
  const [file] = await db
    .select({
      id: projectFiles.id,
      projectId: projectFiles.projectId,
      userId: projectFiles.userId,
      fileName: projectFiles.fileName,
      storageKey: projectFiles.storageKey,
    })
    .from(projectFiles)
    .where(eq(projectFiles.id, parsedFileId))
    .limit(1);
  if (!file) return { ok: false as const, error: "File tidak ditemukan." };

  const role = await getProjectRole(file.projectId, session.user.id);
  const canDelete =
    file.userId === session.user.id ||
    isAdminSession(session) ||
    role === "owner";
  if (!canDelete) return { ok: false as const, error: "Tidak boleh menghapus file." };

  await db.delete(projectFiles).where(eq(projectFiles.id, parsedFileId));
  if (file.storageKey) {
    await getStorageProvider().delete(file.storageKey);
  }
  await logProjectActivity(file.projectId, session.user.id, "file_deleted", `Deleted ${file.fileName}.`);
  revalidatePath(`/projects/${file.projectId}`);
  return { ok: true as const };
}

export async function listProjectActivity(projectId: string): Promise<ProjectActivityRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  return db
    .select({
      id: projectActivityLog.id,
      action: projectActivityLog.action,
      description: projectActivityLog.description,
      createdAt: projectActivityLog.createdAt,
      userId: projectActivityLog.userId,
      userName: users.namaLengkap,
    })
    .from(projectActivityLog)
    .leftJoin(users, eq(projectActivityLog.userId, users.id))
    .where(eq(projectActivityLog.projectId, parsedId))
    .orderBy(desc(projectActivityLog.createdAt));
}

export async function listLabels(): Promise<ProjectLabelRow[]> {
  await requireCapability("projects:view");
  return db
    .select({
      id: projectLabels.id,
      name: projectLabels.name,
      color: projectLabels.color,
    })
    .from(projectLabels)
    .orderBy(asc(projectLabels.name));
}

export async function createLabel(name: string, color: string) {
  await requireCapability("projects:create");
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(100),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    })
    .parse({ name, color });

  const [row] = await db
    .insert(projectLabels)
    .values(parsed)
    .returning({
      id: projectLabels.id,
      name: projectLabels.name,
      color: projectLabels.color,
    });

  revalidatePath("/projects");
  return { ok: true as const, data: row };
}

export async function listProjectEventOptions() {
  await requireCapability("projects:create");
  return db
    .select({
      id: events.id,
      title: events.namaKegiatan,
      date: events.tanggalMulai,
    })
    .from(events)
    .where(sql`${events.deletedAt} IS NULL`)
    .orderBy(desc(events.tanggalMulai))
    .limit(100);
}
