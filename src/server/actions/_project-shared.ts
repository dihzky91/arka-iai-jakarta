import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import {
  notifications,
  projectActivityLog,
  projectComments,
  projectFiles,
  projectLabels,
  projectMembers,
  projects,
  projectToLabels,
  users,
} from "@/server/db/schema";
import { createNotification } from "@/server/actions/notifications";
import { checkNotificationPreference } from "@/server/actions/notificationPreferences";
import { sanitizeAnnouncementHtml } from "@/lib/html/announcementHtml";
import { requireSession } from "@/server/actions/auth";
import { calculateSKP } from "@/lib/skp-calculator";
import { parseIsoDateInJakarta } from "@/lib/utils";
import {
  PROJECT_STATUSES,
  PROJECT_TYPES,
  TIPE_PELAKSANAAN,
  type ProjectMemberRole,
  type ProjectStatus,
  type ProjectType,
  type TipePelaksanaan,
} from "@/lib/project-constants";

export const uuidSchema = z.string().uuid();
export const eventIdSchema = z.coerce.number().int().positive().optional().nullable();

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
  .optional()
  .nullable();

export const projectSchema = z
  .object({
    title: z.string().trim().min(1, "Judul wajib diisi.").max(255),
    type: z.enum(PROJECT_TYPES),
    description: z.string().optional().nullable(),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    price: z.coerce.number().nonnegative().optional().nullable(),
    priceMember: z.coerce.number().nonnegative().optional().nullable(),
    priceNonMember: z.coerce.number().nonnegative().optional().nullable(),
    tipePelaksanaan: z.enum(TIPE_PELAKSANAAN).optional().nullable(),
    waktuMulai: z.string().optional().nullable(),
    waktuSelesai: z.string().optional().nullable(),
    lokasi: z.string().max(255).optional().nullable(),
    maxPeserta: z.coerce.number().int().positive().optional().nullable(),
    isWaitlistEnabled: z.boolean().optional().default(false),
    status: z.enum(PROJECT_STATUSES).default("not_started"),
    skpMode: z.enum(["auto", "manual"]).default("auto"),
    skp: z.coerce.number().nonnegative().optional().nullable(),
    halfDaySkp: z.enum(["2", "4"]).optional().nullable(),
    eventId: eventIdSchema,
    kelasUjianId: z.string().optional().nullable(),
    labelIds: z.array(uuidSchema).optional(),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
    {
      message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
      path: ["endDate"],
    },
  );

export type ProjectLabelRow = {
  id: string;
  name: string;
  color: string;
  group: string | null;
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
  priceMember: string | null;
  priceNonMember: string | null;
  tipePelaksanaan: TipePelaksanaan | null;
  waktuMulai: string | null;
  waktuSelesai: string | null;
  lokasi: string | null;
  maxPeserta: number | null;
  isWaitlistEnabled: boolean;
  skp: string | null;
  skpMode: string;
  halfDaySkp: string | null;
  progress: number;
  kelasUjianId: string | null;
  isTemplate: boolean;
  templateSourceId: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  labels: ProjectLabelRow[];
  memberCount: number;
  fileCount: number;
  commentCount: number;
};

export function isAdminSession(session: Awaited<ReturnType<typeof requireSession>>) {
  const user = session.user as { role?: string; isSuperAdmin?: boolean };
  return user.isSuperAdmin === true || user.role === "admin";
}

export function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function sanitizeDescription(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return sanitizeAnnouncementHtml(trimmed);
}

export function numberToNumeric(value?: number | null) {
  return value == null ? null : String(value);
}

export function resolveSkp(data: z.infer<typeof projectSchema>) {
  if (data.skpMode === "manual") return numberToNumeric(data.skp);
  if (!data.startDate || !data.endDate) return null;

  const halfDay = data.halfDaySkp ? Number(data.halfDaySkp) : null;
  return String(
    calculateSKP(
      parseIsoDateInJakarta(data.startDate),
      parseIsoDateInJakarta(data.endDate),
      halfDay,
    ),
  );
}

export async function logProjectActivity(
  projectId: string,
  userId: string,
  action: string,
  description?: string,
) {
  await db.insert(projectActivityLog).values({ projectId, userId, action, description });
}

export async function notifyProjectUser(input: {
  userId: string;
  type: typeof notifications.$inferInsert.type;
  title: string;
  message: string;
  entitasId: string;
}) {
  const pref = await checkNotificationPreference(input.userId, input.type);
  if (!pref.inApp) return;

  await createNotification({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    entitasType: "project",
    entitasId: input.entitasId,
  });
}

export async function getGlobalAccess(userId: string) {
  const [row] = await db
    .select({ role: users.role, isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    role: row?.role ?? null,
    isAdmin: row?.isSuperAdmin === true || row?.role === "admin",
  };
}

export async function getProjectRole(projectId: string, userId: string) {
  const [member] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);

  return (member?.role as ProjectMemberRole | undefined) ?? null;
}

export async function requireProjectMember(projectId: string) {
  const session = await requireSession();
  const access = await getGlobalAccess(session.user.id);
  if (access.isAdmin) return { session, role: "admin" as const };

  const role = await getProjectRole(projectId, session.user.id);
  if (!role) throw new Error("Forbidden");
  return { session, role };
}

export async function requireProjectRole(projectId: string, allowed: ProjectMemberRole[]) {
  const result = await requireProjectMember(projectId);
  if (result.role === "admin") return result;
  if (!allowed.includes(result.role)) throw new Error("Forbidden");
  return result;
}

export async function requireProjectWriter(projectId: string) {
  return requireProjectRole(projectId, ["owner", "manager"]);
}

export function canWrite(role: ProjectMemberRole | "admin") {
  return role === "admin" || role === "owner" || role === "manager";
}

export async function attachProjectMeta<T extends { id: string }>(
  rows: T[],
): Promise<Array<T & Pick<ProjectListRow, "labels" | "memberCount" | "fileCount" | "commentCount">>> {
  if (rows.length === 0) return [];
  const projectIds = rows.map((row) => row.id);

  const [labelRows, memberCounts, fileCounts, commentCounts] = await Promise.all([
    db
      .select({
        projectId: projectToLabels.projectId,
        id: projectLabels.id,
        name: projectLabels.name,
        color: projectLabels.color,
        group: projectLabels.group,
      })
      .from(projectToLabels)
      .innerJoin(projectLabels, eq(projectToLabels.labelId, projectLabels.id))
      .where(inArray(projectToLabels.projectId, projectIds))
      .orderBy(asc(projectLabels.name)),
    db
      .select({ projectId: projectMembers.projectId, total: count() })
      .from(projectMembers)
      .where(inArray(projectMembers.projectId, projectIds))
      .groupBy(projectMembers.projectId),
    db
      .select({ projectId: projectFiles.projectId, total: count() })
      .from(projectFiles)
      .where(inArray(projectFiles.projectId, projectIds))
      .groupBy(projectFiles.projectId),
    db
      .select({ projectId: projectComments.projectId, total: count() })
      .from(projectComments)
      .where(inArray(projectComments.projectId, projectIds))
      .groupBy(projectComments.projectId),
  ]);

  return rows.map((row) => ({
    ...row,
    labels: labelRows
      .filter((label) => label.projectId === row.id)
      .map(({ projectId: _projectId, ...label }) => label),
    memberCount: Number(memberCounts.find((item) => item.projectId === row.id)?.total) || 0,
    fileCount: Number(fileCounts.find((item) => item.projectId === row.id)?.total) || 0,
    commentCount: Number(commentCounts.find((item) => item.projectId === row.id)?.total) || 0,
  }));
}

export function mapProjectBase(row: {
  id: string;
  title: string;
  type: string;
  status: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  price: string | null;
  priceMember: string | null;
  priceNonMember: string | null;
  tipePelaksanaan: string | null;
  waktuMulai: string | null;
  waktuSelesai: string | null;
  lokasi: string | null;
  maxPeserta: number | null;
  isWaitlistEnabled: boolean;
  skp: string | null;
  skpMode: string;
  halfDaySkp: string | null;
  progress: number;
  kelasUjianId: string | null;
  isTemplate: boolean;
  templateSourceId: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    type: row.type as ProjectType,
    status: row.status as ProjectStatus,
    tipePelaksanaan: row.tipePelaksanaan as TipePelaksanaan | null,
    kelasUjianId: row.kelasUjianId,
    isTemplate: row.isTemplate,
    templateSourceId: row.templateSourceId,
  };
}

export async function assertKelasUjianUnique(kelasUjianId: string, excludeProjectId?: string) {
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.kelasUjianId, kelasUjianId))
    .limit(1);
  if (existing && existing.id !== excludeProjectId) {
    return "Kelas ujian ini sudah terhubung ke project lain.";
  }
  return null;
}

export function normalizeError(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : String(err);
  if (message === "Forbidden") return "Anda tidak memiliki izin untuk aksi ini.";
  return `${fallback}: ${message}`;
}

export function numeric(value?: number | null) {
  return value == null ? null : String(value);
}

export function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}
