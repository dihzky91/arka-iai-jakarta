"use server";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateDashboardTag } from "@/server/actions/statistics";
import { DASHBOARD_TAGS } from "@/lib/dashboard-cache-tags";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  auditLog,
  certificateTemplates,
  eventCertificateCounters,
  eventSignatories,
  events,
  participants,
  signatories,
} from "@/server/db/schema";
import { requirePermission, requireSession } from "../auth";

const kategoriValues = ["Workshop", "Brevet AB", "Brevet C", "BFA", "Lainnya"] as const;
const statusEventValues = ["aktif", "dibatalkan", "ditunda", "arsip"] as const;

const orderedSignatorySchema = z.object({
  signatoryId: z.coerce.number().int().positive(),
  urutan: z.coerce.number().int().positive().default(1),
});

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Tanggal tidak valid.");

const eventInputSchema = z.object({
  kodeEvent: z.string().trim().min(1, "Kode event wajib diisi.").max(30),
  namaKegiatan: z.string().trim().min(1, "Nama kegiatan wajib diisi.").max(255),
  kategori: z.enum(kategoriValues).default("Workshop"),
  statusEvent: z.enum(statusEventValues).default("aktif"),
  tanggalMulai: isoDateSchema,
  tanggalSelesai: isoDateSchema,
  lokasi: z.string().trim().max(255).optional().nullable(),
  skp: z.string().trim().max(50).optional().nullable(),
  keterangan: z.string().trim().optional().nullable(),
  certificateTemplateId: z.coerce.number().int().positive().optional().nullable(),
  signatories: z.array(orderedSignatorySchema).optional(),
  signatoryIds: z.array(z.coerce.number().int().positive()).optional(),
}).refine((data) => data.tanggalSelesai >= data.tanggalMulai, {
  message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
  path: ["tanggalSelesai"],
});

const eventIdSchema = z.coerce.number().int().positive();

export type KategoriKegiatan = (typeof kategoriValues)[number];
export type StatusEvent = (typeof statusEventValues)[number];

export type EventFilters = {
  search?: string;
  kategori?: KategoriKegiatan | "all";
  status?: "active" | "inactive" | "all";
  statusEvent?: StatusEvent | "all";
  location?: string;
  skpMin?: string | number;
  skpMax?: string | number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type EventListResult = {
  rows: EventRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type EventRow = {
  id: number;
  kodeEvent: string;
  namaKegiatan: string;
  kategori: KategoriKegiatan;
  statusEvent: StatusEvent;
  tanggalMulai: string;
  tanggalSelesai: string;
  lokasi: string | null;
  skp: string | null;
  keterangan: string | null;
  certificateTemplateId: number | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  participantCount: number;
  signatories: EventSignatoryRow[];
};

export type EventTemplateOption = {
  id: number;
  nama: string;
  kategori: KategoriKegiatan;
  isDefault: boolean | null;
};

export type EventSignatoryRow = {
  id: number;
  nama: string;
  jabatan: string | null;
  pejabatId: number | null;
  urutan: number;
};

type EventInput = z.infer<typeof eventInputSchema>;

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeOptional(value?: string | null) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

function normalizeOptionalId(value?: number | null) {
  return value && value > 0 ? value : null;
}

function isUniqueViolation(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  );
}

function normalizeSignatories(input: EventInput) {
  const ordered = input.signatories?.length
    ? input.signatories
    : input.signatoryIds?.map((signatoryId, index) => ({
        signatoryId,
        urutan: index + 1,
      })) ?? [];

  return ordered
    .filter(
      (item, index, array) =>
        array.findIndex((candidate) => candidate.signatoryId === item.signatoryId) === index,
    )
    .map((item, index) => ({
      signatoryId: item.signatoryId,
      urutan: item.urutan || index + 1,
    }));
}

async function attachSignatories(
  eventId: number,
  selectedSignatories: { signatoryId: number; urutan: number }[],
) {
  if (selectedSignatories.length === 0) return;

  await db.insert(eventSignatories).values(
    selectedSignatories.map((item) => ({
      eventId,
      signatoryId: item.signatoryId,
      urutan: item.urutan,
    })),
  );
}

async function hydrateSignatories(rows: Omit<EventRow, "signatories">[]): Promise<EventRow[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const signatureRows = await db
    .select({
      eventId: eventSignatories.eventId,
      id: signatories.id,
      nama: signatories.nama,
      jabatan: signatories.jabatan,
      pejabatId: signatories.pejabatId,
      urutan: eventSignatories.urutan,
    })
    .from(eventSignatories)
    .innerJoin(signatories, eq(eventSignatories.signatoryId, signatories.id))
    .where(inArray(eventSignatories.eventId, ids))
    .orderBy(asc(eventSignatories.urutan), asc(signatories.nama));

  return rows.map((row) => ({
    ...row,
    signatories: signatureRows
      .filter((signature) => signature.eventId === row.id)
      .map(({ eventId: _eventId, ...signature }) => signature),
  }));
}

export async function listEvents(filters: EventFilters = {}): Promise<EventListResult> {
  await requireSession();

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = [10, 25, 50].includes(filters.pageSize ?? 25) ? (filters.pageSize ?? 25) : 25;
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = [sql`${events.deletedAt} IS NULL`];
  const today = todayJakarta();

  if (filters.search?.trim()) {
    conditions.push(ilike(events.namaKegiatan, `%${filters.search.trim()}%`));
  }

  if (filters.kategori && filters.kategori !== "all") {
    conditions.push(eq(events.kategori, filters.kategori));
  }

  if (filters.status === "active") {
    const activeCond = and(eq(events.statusEvent, "aktif"), gte(events.tanggalSelesai, today));
    if (activeCond) conditions.push(activeCond);
  } else if (filters.status === "inactive") {
    conditions.push(sql`${events.tanggalSelesai} < ${today}`);
  }

  if (filters.statusEvent && filters.statusEvent !== "all") {
    conditions.push(eq(events.statusEvent, filters.statusEvent));
  }

  if (filters.location?.trim()) {
    conditions.push(ilike(events.lokasi, `%${filters.location.trim()}%`));
  }

  if (filters.dateFrom) {
    conditions.push(gte(events.tanggalMulai, filters.dateFrom));
  }

  if (filters.dateTo) {
    conditions.push(lte(events.tanggalSelesai, filters.dateTo));
  }

  const skpNumber = sql<number>`nullif(regexp_replace(${events.skp}, '[^0-9]', '', 'g'), '')::int`;
  if (filters.skpMin !== undefined && filters.skpMin !== "") {
    conditions.push(sql`${skpNumber} >= ${Number(filters.skpMin)}`);
  }
  if (filters.skpMax !== undefined && filters.skpMax !== "") {
    conditions.push(sql`${skpNumber} <= ${Number(filters.skpMax)}`);
  }

  const where = and(...conditions);

  const participantWhere = and(
    eq(participants.eventId, events.id),
    sql`${participants.deletedAt} IS NULL`,
    eq(participants.statusPeserta, "aktif"),
  );

  const [totalRow, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(events)
      .where(where),
    db
      .select({
        id: events.id,
        kodeEvent: events.kodeEvent,
        namaKegiatan: events.namaKegiatan,
        kategori: events.kategori,
        statusEvent: events.statusEvent,
        tanggalMulai: events.tanggalMulai,
        tanggalSelesai: events.tanggalSelesai,
        lokasi: events.lokasi,
        skp: events.skp,
        keterangan: events.keterangan,
        certificateTemplateId: events.certificateTemplateId,
        createdBy: events.createdBy,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        participantCount: sql<number>`count(${participants.id})::int`,
      })
      .from(events)
      .leftJoin(participants, participantWhere)
      .where(where)
      .groupBy(events.id)
      .orderBy(desc(events.tanggalMulai), desc(events.id))
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = totalRow[0]?.total ?? 0;
  const hydrated = await hydrateSignatories(rows);

  return {
    rows: hydrated,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getEvent(id: number): Promise<EventRow | null> {
  await requireSession();
  const parsedId = eventIdSchema.parse(id);

  const rows = await db
    .select({
      id: events.id,
      kodeEvent: events.kodeEvent,
      namaKegiatan: events.namaKegiatan,
      kategori: events.kategori,
      statusEvent: events.statusEvent,
      tanggalMulai: events.tanggalMulai,
      tanggalSelesai: events.tanggalSelesai,
      lokasi: events.lokasi,
      skp: events.skp,
      keterangan: events.keterangan,
      certificateTemplateId: events.certificateTemplateId,
      createdBy: events.createdBy,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
      participantCount: sql<number>`count(${participants.id})::int`,
    })
    .from(events)
    .leftJoin(
      participants,
      and(
        eq(participants.eventId, events.id),
        sql`${participants.deletedAt} IS NULL`,
        eq(participants.statusPeserta, "aktif"),
      ),
    )
    .where(and(eq(events.id, parsedId), sql`${events.deletedAt} IS NULL`))
    .groupBy(events.id)
    .limit(1);

  const [row] = await hydrateSignatories(rows);
  return row ?? null;
}

export async function listEventTemplateOptions(): Promise<EventTemplateOption[]> {
  await requirePermission("sertifikat", "manage");

  return db
    .select({
      id: certificateTemplates.id,
      nama: certificateTemplates.nama,
      kategori: certificateTemplates.kategori,
      isDefault: certificateTemplates.isDefault,
    })
    .from(certificateTemplates)
    .where(eq(certificateTemplates.isActive, true))
    .orderBy(asc(certificateTemplates.kategori), asc(certificateTemplates.nama));
}

export async function createEvent(data: unknown) {
  const result = eventInputSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  const parsed = result.data;
  const session = await requirePermission("sertifikat", "manage");
  const selectedSignatories = normalizeSignatories(parsed);

  try {
    const [row] = await db
      .insert(events)
      .values({
        kodeEvent: parsed.kodeEvent,
        namaKegiatan: parsed.namaKegiatan,
        kategori: parsed.kategori,
        statusEvent: parsed.statusEvent,
        tanggalMulai: parsed.tanggalMulai,
        tanggalSelesai: parsed.tanggalSelesai,
        lokasi: normalizeOptional(parsed.lokasi),
        skp: normalizeOptional(parsed.skp),
        keterangan: normalizeOptional(parsed.keterangan),
        certificateTemplateId: normalizeOptionalId(parsed.certificateTemplateId),
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning();

    if (!row) throw new Error("Gagal membuat kegiatan.");
    await attachSignatories(row.id, selectedSignatories);

    await db.insert(eventCertificateCounters).values({
      eventId: row.id,
      lastCounter: 0,
    });

    await writeAuditLog({
      userId: session.user.id,
      aksi: "CREATE_SERTIFIKAT_EVENT",
      entitasType: "sertifikat_event",
      entitasId: String(row.id),
      detail: { kodeEvent: row.kodeEvent, namaKegiatan: row.namaKegiatan, kategori: row.kategori },
    });

    revalidatePath("/sertifikat/kegiatan");
    revalidateDashboardTag(DASHBOARD_TAGS.sertifikat);
    return { ok: true as const, data: row };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false as const, error: "Kode event sudah digunakan." };
    }
    throw err;
  }
}

export async function updateEvent(id: number, data: unknown) {
  const parsedId = eventIdSchema.parse(id);
  const result = eventInputSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  const parsed = result.data;
  const session = await requirePermission("sertifikat", "manage");
  const selectedSignatories = normalizeSignatories(parsed);

  try {
    const [row] = await db
      .update(events)
      .set({
        kodeEvent: parsed.kodeEvent,
        namaKegiatan: parsed.namaKegiatan,
        kategori: parsed.kategori,
        statusEvent: parsed.statusEvent,
        tanggalMulai: parsed.tanggalMulai,
        tanggalSelesai: parsed.tanggalSelesai,
        lokasi: normalizeOptional(parsed.lokasi),
        skp: normalizeOptional(parsed.skp),
        keterangan: normalizeOptional(parsed.keterangan),
        certificateTemplateId: normalizeOptionalId(parsed.certificateTemplateId),
        updatedAt: new Date(),
      })
      .where(eq(events.id, parsedId))
      .returning();

    if (!row) return { ok: false as const, error: "Kegiatan tidak ditemukan." };

    await db.delete(eventSignatories).where(eq(eventSignatories.eventId, parsedId));
    await attachSignatories(parsedId, selectedSignatories);

    await writeAuditLog({
      userId: session.user.id,
      aksi: "UPDATE_SERTIFIKAT_EVENT",
      entitasType: "sertifikat_event",
      entitasId: String(parsedId),
      detail: { kodeEvent: row.kodeEvent, namaKegiatan: row.namaKegiatan, kategori: row.kategori },
    });

    revalidatePath("/sertifikat/kegiatan");
    revalidateDashboardTag(DASHBOARD_TAGS.sertifikat);
    revalidatePath(`/sertifikat/kegiatan/${parsedId}`);
    revalidatePath("/verifikasi", "layout");
    return { ok: true as const, data: row };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false as const, error: "Kode event sudah digunakan." };
    }
    throw err;
  }
}

export async function deleteEvent(id: number) {
  const parsedId = eventIdSchema.parse(id);
  const session = await requirePermission("sertifikat", "manage");

  const [existing] = await db
    .select({ id: events.id, namaKegiatan: events.namaKegiatan })
    .from(events)
    .where(and(eq(events.id, parsedId), sql`${events.deletedAt} IS NULL`))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Kegiatan tidak ditemukan." };

  await db
    .update(events)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(events.id, parsedId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "SOFT_DELETE_SERTIFIKAT_EVENT",
    entitasType: "sertifikat_event",
    entitasId: String(parsedId),
    detail: { namaKegiatan: existing.namaKegiatan },
  });

  revalidatePath("/sertifikat/kegiatan");
  return { ok: true as const };
}

// â”€â”€â”€ Quick Stats per Event (D2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type EventQuickStats = {
  total: number;
  aktif: number;
  dicabut: number;
  punyaEmail: number;
  emailTerkirim: number;
  sudahDownload: number;
};

export async function getEventQuickStats(eventId: number): Promise<EventQuickStats> {
  await requirePermission("sertifikat", "manage");
  const parsedId = eventIdSchema.parse(eventId);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      aktif: sql<number>`count(*) filter (where ${participants.statusPeserta} = 'aktif')::int`,
      dicabut: sql<number>`count(*) filter (where ${participants.statusPeserta} = 'dicabut')::int`,
      punyaEmail: sql<number>`count(*) filter (where ${participants.email} is not null and ${participants.email} <> '')::int`,
      emailTerkirim: sql<number>`count(*) filter (where ${participants.emailSentAt} is not null)::int`,
      sudahDownload: sql<number>`count(*) filter (where ${participants.lastPdfGeneratedAt} is not null)::int`,
    })
    .from(participants)
    .where(
      and(
        eq(participants.eventId, parsedId),
        sql`${participants.deletedAt} IS NULL`,
      ),
    );

  return stats ?? { total: 0, aktif: 0, dicabut: 0, punyaEmail: 0, emailTerkirim: 0, sudahDownload: 0 };
}

// â”€â”€â”€ Trash / Restore (C1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type DeletedEventRow = {
  id: number;
  kodeEvent: string;
  namaKegiatan: string;
  kategori: KategoriKegiatan;
  tanggalMulai: string;
  tanggalSelesai: string;
  deletedAt: Date | null;
};

export async function listDeletedEvents(): Promise<DeletedEventRow[]> {
  await requirePermission("sertifikat", "configure");
  const rows = await db
    .select({
      id: events.id,
      kodeEvent: events.kodeEvent,
      namaKegiatan: events.namaKegiatan,
      kategori: events.kategori,
      tanggalMulai: events.tanggalMulai,
      tanggalSelesai: events.tanggalSelesai,
      deletedAt: events.deletedAt,
    })
    .from(events)
    .where(sql`${events.deletedAt} IS NOT NULL`)
    .orderBy(desc(events.deletedAt));
  return rows;
}

export async function restoreEvent(id: number) {
  const parsedId = eventIdSchema.parse(id);
  const session = await requirePermission("sertifikat", "configure");

  const [existing] = await db
    .select({ id: events.id, namaKegiatan: events.namaKegiatan, deletedAt: events.deletedAt })
    .from(events)
    .where(eq(events.id, parsedId))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Kegiatan tidak ditemukan." };
  if (!existing.deletedAt) return { ok: false as const, error: "Kegiatan tidak berada di sampah." };

  await db
    .update(events)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(events.id, parsedId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "RESTORE_SERTIFIKAT_EVENT",
    entitasType: "sertifikat_event",
    entitasId: String(parsedId),
    detail: { namaKegiatan: existing.namaKegiatan },
  });

  revalidatePath("/sertifikat/kegiatan");
  revalidatePath("/sertifikat/sampah");
  return { ok: true as const };
}

export async function updateEventStatus(eventId: number, statusEvent: StatusEvent) {
  const parsedId = eventIdSchema.parse(eventId);
  const parsedStatus = z.enum(statusEventValues).parse(statusEvent);
  const session = await requirePermission("sertifikat", "configure");

  const [row] = await db
    .update(events)
    .set({ statusEvent: parsedStatus, updatedAt: new Date() })
    .where(eq(events.id, parsedId))
    .returning({
      id: events.id,
      kodeEvent: events.kodeEvent,
      namaKegiatan: events.namaKegiatan,
      statusEvent: events.statusEvent,
    });

  if (!row) return { ok: false as const, error: "Kegiatan tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_SERTIFIKAT_EVENT_STATUS",
    entitasType: "sertifikat_event",
    entitasId: String(parsedId),
    detail: {
      kodeEvent: row.kodeEvent,
      namaKegiatan: row.namaKegiatan,
      statusEvent: row.statusEvent,
    },
  });

  revalidatePath("/sertifikat/kegiatan");
  revalidatePath(`/sertifikat/kegiatan/${parsedId}`);
  return { ok: true as const, data: row };
}
