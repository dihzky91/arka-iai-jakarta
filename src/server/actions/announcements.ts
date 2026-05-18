"use server";

import { cache } from "react";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  announcementReads,
  announcements,
  auditLog,
  divisi,
  users,
  type AnnouncementAttachment,
  type AnnouncementAudience,
} from "@/server/db/schema";
import { getStorageProvider } from "@/lib/storage";
import { prepareUploadPayload } from "@/lib/storage/utils";
import {
  announcementCreateSchema,
  announcementDeleteSchema,
  announcementDuplicateSchema,
  announcementGetReadersSchema,
  announcementAcknowledgeSchema,
  announcementMarkReadSchema,
  announcementUploadFileSchema,
  announcementUpdateSchema,
} from "@/lib/validators/announcement.schema";
import { sanitizeAnnouncementHtml } from "@/lib/html/announcementHtml";
import { requirePermission, requireSession } from "./auth";

export type AnnouncementInboxRow = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  audience: AnnouncementAudience;
  attachments: AnnouncementAttachment[];
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  readAt: Date | null;
  acknowledgedAt: Date | null;
  isRead: boolean;
  isAcknowledged: boolean;
  needsAcknowledgement: boolean;
  isPinned: boolean;
  requiresAck: boolean;
};

export type AnnouncementManageRow = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  audience: AnnouncementAudience;
  attachments: AnnouncementAttachment[];
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  readCount: number;
  acknowledgedCount: number;
  isPinned: boolean;
  requiresAck: boolean;
  status: "draft" | "published";
};

export type AnnouncementReaderRow = {
  userId: string;
  namaLengkap: string | null;
  readAt: Date;
  acknowledgedAt: Date | null;
};

function getTodayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeAudience(input: AnnouncementAudience): AnnouncementAudience {
  const roles = Array.from(new Set(input.roles));
  const divisiIds = Array.from(new Set(input.divisiIds));
  return { all: input.all, roles, divisiIds };
}

function normalizeAttachments(
  attachments: AnnouncementAttachment[] | null | undefined,
): AnnouncementAttachment[] {
  if (!Array.isArray(attachments)) return [];
  return attachments.filter((item) => !!item?.fileName && !!item?.url);
}

function canAccessAnnouncement(
  audience: AnnouncementAudience,
  role: string | null | undefined,
  divisiId: number | null | undefined,
): boolean {
  if (audience.all) return true;
  if (role && audience.roles.includes(role as "admin" | "staff" | "pejabat" | "viewer")) {
    return true;
  }
  if (typeof divisiId === "number" && audience.divisiIds.includes(divisiId)) {
    return true;
  }
  return false;
}

export async function listAnnouncementInbox(): Promise<AnnouncementInboxRow[]> {
  const session = await requirePermission("announcement", "view");
  const today = getTodayJakarta();
  const userRole = (session.user as { role?: string }).role ?? null;

  const [userRow] = await db
    .select({ divisiId: users.divisiId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      description: announcements.description,
      startDate: announcements.startDate,
      endDate: announcements.endDate,
      audience: announcements.audience,
      attachments: announcements.attachments,
      createdBy: announcements.createdBy,
      createdByName: users.namaLengkap,
      createdAt: announcements.createdAt,
      updatedAt: announcements.updatedAt,
      isPinned: announcements.isPinned,
      requiresAck: announcements.requiresAck,
      readAt: announcementReads.readAt,
      acknowledgedAt: announcementReads.acknowledgedAt,
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.createdBy, users.id))
    .leftJoin(
      announcementReads,
      and(
        eq(announcementReads.announcementId, announcements.id),
        eq(announcementReads.userId, session.user.id),
      ),
    )
    .where(
      and(
        eq(announcements.status, "published"),
        lte(announcements.startDate, today),
        gte(announcements.endDate, today),
      ),
    )
    .orderBy(
      desc(announcements.isPinned),
      desc(announcements.startDate),
      desc(announcements.createdAt),
    );

  return rows
    .filter((row) =>
      canAccessAnnouncement(row.audience, userRole, userRow?.divisiId ?? null),
    )
    .map((row) => ({
      ...row,
      attachments: normalizeAttachments(row.attachments),
      readAt: row.readAt ?? null,
      acknowledgedAt: row.acknowledgedAt ?? null,
      isRead: !!row.readAt,
      isAcknowledged: !!row.acknowledgedAt,
      needsAcknowledgement: !!row.requiresAck && !row.acknowledgedAt,
    }));
}

export const countUnreadAnnouncements = cache(async (): Promise<number> => {
  try {
    const session = await requirePermission("announcement", "view");
    const today = getTodayJakarta();
    const userRole = (session.user as { role?: string }).role ?? null;

    const [userRow] = await db
      .select({ divisiId: users.divisiId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    // Lightweight query: only fetch fields needed for count logic
    const rows = await db
      .select({
        audience: announcements.audience,
        requiresAck: announcements.requiresAck,
        readAt: announcementReads.readAt,
        acknowledgedAt: announcementReads.acknowledgedAt,
      })
      .from(announcements)
      .leftJoin(
        announcementReads,
        and(
          eq(announcementReads.announcementId, announcements.id),
          eq(announcementReads.userId, session.user.id),
        ),
      )
      .where(
        and(
          eq(announcements.status, "published"),
          lte(announcements.startDate, today),
          gte(announcements.endDate, today),
        ),
      );

    return rows.filter(
      (row) =>
        canAccessAnnouncement(row.audience, userRole, userRow?.divisiId ?? null) &&
        (!row.readAt || (row.requiresAck && !row.acknowledgedAt)),
    ).length;
  } catch {
    return 0;
  }
});

export async function listAnnouncementManage(): Promise<AnnouncementManageRow[]> {
  await requirePermission("announcement", "manage");
  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      description: announcements.description,
      startDate: announcements.startDate,
      endDate: announcements.endDate,
      audience: announcements.audience,
      attachments: announcements.attachments,
      createdBy: announcements.createdBy,
      createdByName: users.namaLengkap,
      createdAt: announcements.createdAt,
      updatedAt: announcements.updatedAt,
      isPinned: announcements.isPinned,
      requiresAck: announcements.requiresAck,
      status: announcements.status,
      readCount: count(announcementReads.userId),
      acknowledgedCount:
        sql<number>`count(*) filter (where ${announcementReads.acknowledgedAt} is not null)::int`.as(
          "acknowledged_count",
        ),
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.createdBy, users.id))
    .leftJoin(announcementReads, eq(announcementReads.announcementId, announcements.id))
    .groupBy(
      announcements.id,
      announcements.title,
      announcements.description,
      announcements.startDate,
      announcements.endDate,
      announcements.audience,
      announcements.attachments,
      announcements.isPinned,
      announcements.status,
      announcements.createdBy,
      users.namaLengkap,
      announcements.createdAt,
      announcements.updatedAt,
      announcements.requiresAck,
    )
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt));

  return rows.map((row) => ({
    ...row,
    attachments: normalizeAttachments(row.attachments),
    readCount: Number(row.readCount) || 0,
    acknowledgedCount: Number(row.acknowledgedCount) || 0,
    status: row.status as "draft" | "published",
  }));
}

export async function createAnnouncement(data: unknown) {
  const session = await requirePermission("announcement", "create");
  const parsed = announcementCreateSchema.parse(data);
  const audience = normalizeAudience(parsed.audience);

  const [row] = await db
    .insert(announcements)
    .values({
      id: crypto.randomUUID(),
      title: parsed.title,
      description: sanitizeAnnouncementHtml(parsed.description),
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      audience,
      attachments: normalizeAttachments(parsed.attachments),
      isPinned: parsed.isPinned,
      requiresAck: parsed.requiresAck,
      status: parsed.status,
      createdBy: session.user.id,
    })
    .returning();

  if (!row) throw new Error("Gagal membuat pengumuman.");

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_ANNOUNCEMENT",
    entitasType: "announcement",
    entitasId: row.id,
    detail: { title: parsed.title, status: parsed.status },
  });

  revalidatePath("/pengumuman");
  revalidatePath("/dashboard");
  return { ok: true as const, data: row };
}

export async function updateAnnouncement(data: unknown) {
  const session = await requirePermission("announcement", "update");
  const parsed = announcementUpdateSchema.parse(data);
  const audience = normalizeAudience(parsed.audience);

  const [row] = await db
    .update(announcements)
    .set({
      title: parsed.title,
      description: sanitizeAnnouncementHtml(parsed.description),
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      audience,
      attachments: normalizeAttachments(parsed.attachments),
      isPinned: parsed.isPinned,
      requiresAck: parsed.requiresAck,
      status: parsed.status,
      updatedAt: new Date(),
    })
    .where(eq(announcements.id, parsed.id))
    .returning();

  if (!row) return { ok: false as const, error: "Pengumuman tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_ANNOUNCEMENT",
    entitasType: "announcement",
    entitasId: row.id,
    detail: { title: parsed.title, status: parsed.status },
  });

  revalidatePath("/pengumuman");
  revalidatePath("/dashboard");
  return { ok: true as const, data: row };
}

export async function deleteAnnouncement(input: unknown) {
  const session = await requirePermission("announcement", "delete");
  const parsed = announcementDeleteSchema.parse(input);

  const [existing] = await db
    .select({ id: announcements.id, title: announcements.title })
    .from(announcements)
    .where(eq(announcements.id, parsed.id))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Pengumuman tidak ditemukan." };

  await db.delete(announcements).where(eq(announcements.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_ANNOUNCEMENT",
    entitasType: "announcement",
    entitasId: parsed.id,
    detail: { title: existing.title },
  });

  revalidatePath("/pengumuman");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function duplicateAnnouncement(input: unknown) {
  const session = await requirePermission("announcement", "create");
  const parsed = announcementDuplicateSchema.parse(input);

  const [source] = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, parsed.id))
    .limit(1);

  if (!source) return { ok: false as const, error: "Pengumuman tidak ditemukan." };

  const today = getTodayJakarta();
  const [row] = await db
    .insert(announcements)
    .values({
      id: crypto.randomUUID(),
      title: `${source.title} (Salinan)`,
      description: source.description,
      startDate: today,
      endDate: today,
      audience: source.audience,
      attachments: source.attachments,
      isPinned: false,
      requiresAck: source.requiresAck,
      status: "draft",
      createdBy: session.user.id,
    })
    .returning();

  if (!row) return { ok: false as const, error: "Gagal menduplikat pengumuman." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DUPLICATE_ANNOUNCEMENT",
    entitasType: "announcement",
    entitasId: row.id,
    detail: { sourceId: source.id, title: row.title },
  });

  revalidatePath("/pengumuman");
  return { ok: true as const, data: row };
}

export async function markAnnouncementAsRead(input: unknown) {
  const session = await requirePermission("announcement", "view");
  const parsed = announcementMarkReadSchema.parse(input);
  const today = getTodayJakarta();
  const role = (session.user as { role?: string }).role ?? null;

  const [userRow] = await db
    .select({ divisiId: users.divisiId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const [announcement] = await db
    .select({
      id: announcements.id,
      audience: announcements.audience,
      startDate: announcements.startDate,
      endDate: announcements.endDate,
    })
    .from(announcements)
    .where(eq(announcements.id, parsed.id))
    .limit(1);

  if (!announcement) return { ok: false as const, error: "Pengumuman tidak ditemukan." };
  if (announcement.startDate > today || announcement.endDate < today) {
    return { ok: false as const, error: "Pengumuman tidak aktif." };
  }
  if (!canAccessAnnouncement(announcement.audience, role, userRow?.divisiId ?? null)) {
    return { ok: false as const, error: "Anda tidak memiliki akses ke pengumuman ini." };
  }

  await db
    .insert(announcementReads)
    .values({ announcementId: parsed.id, userId: session.user.id, readAt: new Date() })
    .onConflictDoNothing();

  revalidatePath("/pengumuman");
  return { ok: true as const };
}

export async function acknowledgeAnnouncement(input: unknown) {
  const session = await requirePermission("announcement", "view");
  const parsed = announcementAcknowledgeSchema.parse(input);
  const today = getTodayJakarta();
  const role = (session.user as { role?: string }).role ?? null;

  const [userRow] = await db
    .select({ divisiId: users.divisiId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const [announcement] = await db
    .select({
      id: announcements.id,
      audience: announcements.audience,
      startDate: announcements.startDate,
      endDate: announcements.endDate,
      requiresAck: announcements.requiresAck,
    })
    .from(announcements)
    .where(eq(announcements.id, parsed.id))
    .limit(1);

  if (!announcement) return { ok: false as const, error: "Pengumuman tidak ditemukan." };
  if (announcement.startDate > today || announcement.endDate < today) {
    return { ok: false as const, error: "Pengumuman tidak aktif." };
  }
  if (!canAccessAnnouncement(announcement.audience, role, userRow?.divisiId ?? null)) {
    return { ok: false as const, error: "Anda tidak memiliki akses ke pengumuman ini." };
  }
  if (!announcement.requiresAck) {
    return { ok: false as const, error: "Pengumuman ini tidak memerlukan konfirmasi baca." };
  }

  await db
    .insert(announcementReads)
    .values({
      announcementId: parsed.id,
      userId: session.user.id,
      readAt: new Date(),
      acknowledgedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .update(announcementReads)
    .set({ acknowledgedAt: new Date() })
    .where(
      and(
        eq(announcementReads.announcementId, parsed.id),
        eq(announcementReads.userId, session.user.id),
        sql`${announcementReads.acknowledgedAt} IS NULL`,
      ),
    );

  revalidatePath("/pengumuman");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function markAllAnnouncementsAsRead() {
  const session = await requirePermission("announcement", "view");
  const inbox = await listAnnouncementInbox();
  const unread = inbox.filter((row) => !row.isRead);
  if (unread.length === 0) return { ok: true as const, count: 0 };

  await db
    .insert(announcementReads)
    .values(
      unread.map((row) => ({
        announcementId: row.id,
        userId: session.user.id,
        readAt: new Date(),
      })),
    )
    .onConflictDoNothing();

  revalidatePath("/pengumuman");
  revalidatePath("/dashboard");
  return { ok: true as const, count: unread.length };
}

export async function getAnnouncementReaders(
  input: unknown,
): Promise<{ ok: true; data: AnnouncementReaderRow[] } | { ok: false; error: string }> {
  await requirePermission("announcement", "manage");
  const parsed = announcementGetReadersSchema.parse(input);

  const rows = await db
    .select({
      userId: announcementReads.userId,
      namaLengkap: users.namaLengkap,
      readAt: announcementReads.readAt,
      acknowledgedAt: announcementReads.acknowledgedAt,
    })
    .from(announcementReads)
    .leftJoin(users, eq(announcementReads.userId, users.id))
    .where(eq(announcementReads.announcementId, parsed.id))
    .orderBy(asc(announcementReads.readAt));

  return { ok: true as const, data: rows };
}

export async function getAnnouncementAudienceOptions() {
  await requireSession();
  return db.select({ id: divisi.id, nama: divisi.nama }).from(divisi).orderBy(asc(divisi.nama));
}

export async function uploadAnnouncementAttachment(data: unknown) {
  await requirePermission("announcement", "manage");
  const parsed = announcementUploadFileSchema.parse(data);
  const prepared = prepareUploadPayload(parsed);

  const storage = getStorageProvider();
  const uploaded = await storage.upload({
    body: prepared.body,
    fileName: prepared.fileName,
    contentType: prepared.contentType,
    folder: "announcements/attachments",
  });

  return {
    ok: true as const,
    data: {
      fileName: uploaded.fileName || prepared.fileName,
      url: uploaded.url,
      contentType: uploaded.contentType || prepared.contentType,
      size: uploaded.size ?? prepared.size,
    } satisfies AnnouncementAttachment,
  };
}
