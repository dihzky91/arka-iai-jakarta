"use server";

import { and, asc, count, desc, eq, ilike, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { auditLog, eventCertificateCounters, events, participantRevisions, participants, users } from "@/server/db/schema";
import { requirePermission, requireSession } from "../auth";

type RevisionChangeType =
  | "create"
  | "update"
  | "revoke"
  | "reactivate"
  | "soft_delete"
  | "restore"
  | "reissue";

async function logRevision(params: {
  participantId: number;
  changedBy: string;
  changeType: RevisionChangeType;
  before?: unknown;
  after?: unknown;
  note?: string;
}) {
  await db.insert(participantRevisions).values({
    participantId: params.participantId,
    changedBy: params.changedBy,
    changeType: params.changeType,
    before: params.before ?? null,
    after: params.after ?? null,
    note: params.note ?? null,
  });
}

const participantInputSchema = z.object({
  eventId: z.coerce.number().int().positive(),
  noSertifikat: z.string().trim().max(100).optional().nullable(),
  nama: z.string().trim().min(1, "Nama peserta wajib diisi.").max(255),
  role: z.string().trim().max(50).default("Peserta"),
  email: z.string().trim().email("Format email tidak valid.").max(150).optional().nullable().or(z.literal("")),
  autoGenerate: z.boolean().default(true),
});

const participantUpdateSchema = participantInputSchema
  .omit({ eventId: true, autoGenerate: true })
  .extend({
    noSertifikat: z.string().trim().min(1, "Nomor sertifikat wajib diisi.").max(100),
  });
const idSchema = z.coerce.number().int().positive();

type ImportRecord = Record<string, unknown>;
type CertificateNumberExecutor = Pick<typeof db, "select" | "execute">;

function isUniqueViolation(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  );
}

export type StatusPeserta = "aktif" | "dicabut";

export type ParticipantRow = {
  id: number;
  eventId: number;
  noSertifikat: string;
  nama: string;
  role: string;
  email: string | null;
  emailSentAt: Date | null;
  statusPeserta: StatusPeserta;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokeReason: string | null;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type ParticipantListResult = {
  rows: ParticipantRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ParticipantFilters = {
  search?: string;
  status?: StatusPeserta | "all";
  page?: number;
  pageSize?: number;
};

export type BulkImportResult = {
  totalRows: number;
  successCount: number;
  errors: string[];
};

function normalizeOptionalRole(role?: string) {
  return role && role.trim().length > 0 ? role.trim() : "Peserta";
}

function normalizeOptionalEmail(email?: string | null) {
  return email && email.trim().length > 0 ? email.trim().toLowerCase() : null;
}

function hasFormulaInjection(value: string) {
  return /^[=+\-@]/.test(value);
}

function rejectFormulaCells(lineNumber: number, values: string[], errors: string[]) {
  if (values.some((value) => value.length > 0 && hasFormulaInjection(value))) {
    errors.push(`Baris ${lineNumber}: nilai mengandung karakter formula yang tidak diizinkan.`);
    return true;
  }
  return false;
}

function pickCell(row: ImportRecord, candidates: string[]) {
  const entries = Object.entries(row).map(([key, value]) => [
    key.trim().toLowerCase().replace(/\s+/g, "_"),
    value,
  ] as const);

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.trim().toLowerCase().replace(/\s+/g, "_");
    const found = entries.find(([key]) => key === normalizedCandidate);
    if (found) return found[1];
  }

  return undefined;
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

async function parseImportFile(file: File): Promise<ImportRecord[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === "csv") {
    const parsed = Papa.parse<ImportRecord>(buffer.toString("utf-8"), {
      header: true,
      skipEmptyLines: true,
    });
    if (parsed.errors.length > 0) {
      throw new Error(parsed.errors[0]?.message ?? "Gagal membaca file CSV.");
    }
    return parsed.data;
  }

  if (extension === "xlsx" || extension === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return [];
    return XLSX.utils.sheet_to_json<ImportRecord>(worksheet, { defval: "" });
  }

  throw new Error("Format file tidak didukung. Gunakan CSV, XLSX, atau XLS.");
}

async function generateNoSertifikat(
  eventId: number,
  tx: CertificateNumberExecutor,
): Promise<string> {
  const [event] = await tx
    .select({
      kodeEvent: events.kodeEvent,
      tanggalMulai: events.tanggalMulai,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new Error("Kegiatan tidak ditemukan.");

  const existingCounter = await tx.execute(sql`
    SELECT COALESCE(MAX(CAST(SUBSTRING(no_sertifikat FROM '-([0-9]+)/') AS INTEGER)), 0) AS last_counter
    FROM participants
    WHERE event_id = ${eventId}
  `);
  const seedCounter = Number(existingCounter.rows[0]?.last_counter ?? 0);

  await tx.execute(sql`
    INSERT INTO event_certificate_counters (event_id, last_counter, updated_at)
    VALUES (${eventId}, ${seedCounter}, now())
    ON CONFLICT (event_id) DO NOTHING
  `);

  const incremented = await tx.execute(sql`
    INSERT INTO event_certificate_counters (event_id, last_counter, updated_at)
    VALUES (${eventId}, 1, now())
    ON CONFLICT (event_id) DO UPDATE
      SET last_counter = event_certificate_counters.last_counter + 1,
          updated_at = now()
    RETURNING last_counter
  `);

  const nextCounter = Number(incremented.rows[0]?.last_counter ?? 1);
  const year = Number(String(event.tanggalMulai).slice(0, 4));
  return `${event.kodeEvent}-${String(nextCounter).padStart(3, "0")}/${year}`;
}

export async function listByEvent(
  eventId: number,
  filters: ParticipantFilters = {},
): Promise<ParticipantListResult> {
  await requireSession();
  const parsedEventId = idSchema.parse(eventId);

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = [10, 25, 50].includes(filters.pageSize ?? 25) ? (filters.pageSize ?? 25) : 25;
  const offset = (page - 1) * pageSize;

  const conditions = [
    eq(participants.eventId, parsedEventId),
    sql`${participants.deletedAt} IS NULL`,
  ];

  if (filters.status === "aktif") {
    conditions.push(eq(participants.statusPeserta, "aktif"));
  } else if (filters.status === "dicabut") {
    conditions.push(eq(participants.statusPeserta, "dicabut"));
  } else {
    conditions.push(eq(participants.statusPeserta, "aktif"));
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      sql`(${participants.nama} ILIKE ${term} OR ${participants.noSertifikat} ILIKE ${term})`,
    );
  }

  const where = and(...conditions);

  const [totalRow, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(participants)
      .where(where),
    db
      .select()
      .from(participants)
      .where(where)
      .orderBy(desc(participants.id))
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = totalRow[0]?.total ?? 0;

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listAllByEvent(eventId: number): Promise<ParticipantRow[]> {
  await requireSession();
  const parsedEventId = idSchema.parse(eventId);

  return db
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.eventId, parsedEventId),
        sql`${participants.deletedAt} IS NULL`,
        eq(participants.statusPeserta, "aktif"),
      ),
    )
    .orderBy(asc(participants.id));
}

export async function createParticipant(data: unknown) {
  const parsed = participantInputSchema.parse(data);
  const session = await requirePermission("sertifikat", "manage");

  try {
    const [row] = await db.transaction(async (tx) => {
      const noSertifikat = parsed.noSertifikat?.trim()
        ? parsed.noSertifikat.trim()
        : parsed.autoGenerate
          ? await generateNoSertifikat(parsed.eventId, tx)
          : "";

      if (!noSertifikat) throw new Error("Nomor sertifikat wajib diisi atau gunakan auto-generate.");

      return tx
        .insert(participants)
        .values({
          eventId: parsed.eventId,
          noSertifikat,
          nama: parsed.nama,
          role: normalizeOptionalRole(parsed.role),
          email: normalizeOptionalEmail(parsed.email),
          updatedAt: new Date(),
        })
        .returning();
    });

    if (!row) throw new Error("Gagal menambah peserta.");

    await writeAuditLog({
      userId: session.user.id,
      aksi: "CREATE_SERTIFIKAT_PARTICIPANT",
      entitasType: "sertifikat_participant",
      entitasId: String(row.id),
      detail: {
        eventId: parsed.eventId,
        noSertifikat: row.noSertifikat,
        nama: parsed.nama,
      },
    });

    await logRevision({
      participantId: row.id,
      changedBy: session.user.id,
      changeType: "create",
      after: { noSertifikat: row.noSertifikat, nama: row.nama, role: row.role, email: row.email },
    });

    revalidatePath(`/sertifikat/kegiatan/${parsed.eventId}`);
    revalidatePath(`/verifikasi/${row.noSertifikat}`);
    return { ok: true as const, data: row };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false as const, error: "Nomor sertifikat sudah digunakan." };
    }
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Gagal menambah peserta.",
    };
  }
}

export async function updateParticipant(id: number, data: unknown) {
  const parsedId = idSchema.parse(id);
  const parsed = participantUpdateSchema.parse(data);
  const session = await requirePermission("sertifikat", "manage");

  try {
    const [before] = await db
      .select({
        noSertifikat: participants.noSertifikat,
        nama: participants.nama,
        role: participants.role,
        email: participants.email,
      })
      .from(participants)
      .where(eq(participants.id, parsedId))
      .limit(1);

    const [row] = await db
      .update(participants)
      .set({
        noSertifikat: parsed.noSertifikat,
        nama: parsed.nama,
        role: normalizeOptionalRole(parsed.role),
        email: normalizeOptionalEmail(parsed.email),
        updatedAt: new Date(),
      })
      .where(eq(participants.id, parsedId))
      .returning();

    if (!row) return { ok: false as const, error: "Peserta tidak ditemukan." };

    await writeAuditLog({
      userId: session.user.id,
      aksi: "UPDATE_SERTIFIKAT_PARTICIPANT",
      entitasType: "sertifikat_participant",
      entitasId: String(parsedId),
      detail: { noSertifikat: parsed.noSertifikat, nama: parsed.nama },
    });

    await logRevision({
      participantId: row.id,
      changedBy: session.user.id,
      changeType: "update",
      before,
      after: { noSertifikat: row.noSertifikat, nama: row.nama, role: row.role, email: row.email },
    });

    revalidatePath(`/sertifikat/kegiatan/${row.eventId}`);
    revalidatePath(`/verifikasi/${row.noSertifikat}`);
    return { ok: true as const, data: row };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false as const, error: "Nomor sertifikat sudah digunakan." };
    }
    throw err;
  }
}

export async function deleteParticipant(id: number) {
  const parsedId = idSchema.parse(id);
  const session = await requirePermission("sertifikat", "manage");

  const [existing] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.id, parsedId), sql`${participants.deletedAt} IS NULL`))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Peserta tidak ditemukan." };

  await db
    .update(participants)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(participants.id, parsedId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "SOFT_DELETE_SERTIFIKAT_PARTICIPANT",
    entitasType: "sertifikat_participant",
    entitasId: String(parsedId),
    detail: { noSertifikat: existing.noSertifikat, nama: existing.nama },
  });

  await logRevision({
    participantId: parsedId,
    changedBy: session.user.id,
    changeType: "soft_delete",
    before: { noSertifikat: existing.noSertifikat, nama: existing.nama, statusPeserta: existing.statusPeserta },
  });

  revalidatePath(`/sertifikat/kegiatan/${existing.eventId}`);
  revalidatePath(`/verifikasi/${existing.noSertifikat}`);
  return { ok: true as const };
}

export async function revokeParticipant(
  id: number,
  reason?: string,
): Promise<{ ok: true; data: ParticipantRow } | { ok: false; error: string }> {
  const parsedId = idSchema.parse(id);
  const session = await requirePermission("sertifikat", "configure");

  const [existing] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.id, parsedId), sql`${participants.deletedAt} IS NULL`))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Peserta tidak ditemukan." };
  if (existing.statusPeserta === "dicabut") return { ok: false as const, error: "Sertifikat sudah dicabut." };

  const [row] = await db
    .update(participants)
    .set({
      statusPeserta: "dicabut",
      revokedAt: new Date(),
      revokedBy: session.user.id,
      revokeReason: reason?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(participants.id, parsedId))
    .returning();

  if (!row) return { ok: false as const, error: "Gagal mencabut sertifikat." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "REVOKE_CERTIFICATE",
    entitasType: "sertifikat_participant",
    entitasId: String(parsedId),
    detail: {
      noSertifikat: existing.noSertifikat,
      nama: existing.nama,
      reason: reason ?? null,
    },
  });

  await logRevision({
    participantId: parsedId,
    changedBy: session.user.id,
    changeType: "revoke",
    before: { statusPeserta: "aktif" },
    after: { statusPeserta: "dicabut", revokedAt: row.revokedAt, revokedBy: row.revokedBy },
    note: reason?.trim() || undefined,
  });

  revalidatePath(`/sertifikat/kegiatan/${existing.eventId}`);
  revalidatePath(`/verifikasi/${existing.noSertifikat}`);
  return { ok: true as const, data: row };
}

export async function reactivateParticipant(
  id: number,
): Promise<{ ok: true; data: ParticipantRow } | { ok: false; error: string }> {
  const parsedId = idSchema.parse(id);
  const session = await requirePermission("sertifikat", "configure");

  const [existing] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.id, parsedId), sql`${participants.deletedAt} IS NULL`))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Peserta tidak ditemukan." };
  if (existing.statusPeserta === "aktif") return { ok: false as const, error: "Sertifikat sudah aktif." };

  const [row] = await db
    .update(participants)
    .set({
      statusPeserta: "aktif",
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
      updatedAt: new Date(),
    })
    .where(eq(participants.id, parsedId))
    .returning();

  if (!row) return { ok: false as const, error: "Gagal mengaktifkan kembali sertifikat." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "REACTIVATE_CERTIFICATE",
    entitasType: "sertifikat_participant",
    entitasId: String(parsedId),
    detail: { noSertifikat: existing.noSertifikat, nama: existing.nama },
  });

  await logRevision({
    participantId: parsedId,
    changedBy: session.user.id,
    changeType: "reactivate",
    before: { statusPeserta: "dicabut", revokedAt: existing.revokedAt, revokeReason: existing.revokeReason },
    after: { statusPeserta: "aktif" },
  });

  revalidatePath(`/sertifikat/kegiatan/${existing.eventId}`);
  revalidatePath(`/verifikasi/${existing.noSertifikat}`);
  return { ok: true as const, data: row };
}

// â”€â”€â”€ Global Search (D4) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type GlobalParticipantRow = {
  id: number;
  eventId: number;
  noSertifikat: string;
  nama: string;
  role: string;
  email: string | null;
  statusPeserta: StatusPeserta;
  emailSentAt: Date | null;
  lastPdfGeneratedAt: Date | null;
  createdAt: Date | null;
  eventNamaKegiatan: string;
  eventKodeEvent: string;
  eventTanggalMulai: string;
};

export type GlobalSearchFilters = {
  search?: string;
  status?: StatusPeserta | "all";
  page?: number;
  pageSize?: number;
};

export type GlobalSearchResult = {
  rows: GlobalParticipantRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function searchAllParticipants(
  filters: GlobalSearchFilters = {},
): Promise<GlobalSearchResult> {
  await requirePermission("sertifikat", "manage");

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = [10, 25, 50, 100].includes(filters.pageSize ?? 25) ? (filters.pageSize ?? 25) : 25;
  const offset = (page - 1) * pageSize;
  const search = filters.search?.trim();
  const status = filters.status ?? "all";

  const conditions = [
    sql`${participants.deletedAt} IS NULL`,
    sql`${events.deletedAt} IS NULL`,
  ];

  if (status !== "all") {
    conditions.push(eq(participants.statusPeserta, status));
  }

  if (search && search.length > 0) {
    const term = `%${search}%`;
    conditions.push(
      sql`(${participants.nama} ILIKE ${term} OR ${participants.noSertifikat} ILIKE ${term} OR ${participants.email} ILIKE ${term})`,
    );
  }

  const whereClause = and(...conditions);

  const [totalRow, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(participants)
      .innerJoin(events, eq(participants.eventId, events.id))
      .where(whereClause),
    db
      .select({
        id: participants.id,
        eventId: participants.eventId,
        noSertifikat: participants.noSertifikat,
        nama: participants.nama,
        role: participants.role,
        email: participants.email,
        statusPeserta: participants.statusPeserta,
        emailSentAt: participants.emailSentAt,
        lastPdfGeneratedAt: participants.lastPdfGeneratedAt,
        createdAt: participants.createdAt,
        eventNamaKegiatan: events.namaKegiatan,
        eventKodeEvent: events.kodeEvent,
        eventTanggalMulai: events.tanggalMulai,
      })
      .from(participants)
      .innerJoin(events, eq(participants.eventId, events.id))
      .where(whereClause)
      .orderBy(desc(participants.createdAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = totalRow[0]?.total ?? 0;
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// â”€â”€â”€ Re-issue (C3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const reissueInputSchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi.").max(255),
  role: z.string().trim().max(50).optional(),
  email: z.string().trim().email().max(150).optional().nullable().or(z.literal("")),
  reason: z.string().trim().max(500).optional(),
});

export async function reissueParticipant(
  oldParticipantId: number,
  data: unknown,
): Promise<{ ok: true; data: ParticipantRow } | { ok: false; error: string }> {
  const parsedOldId = idSchema.parse(oldParticipantId);
  const parsed = reissueInputSchema.parse(data);
  const session = await requirePermission("sertifikat", "configure");

  const [old] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.id, parsedOldId), sql`${participants.deletedAt} IS NULL`))
    .limit(1);

  if (!old) return { ok: false as const, error: "Peserta lama tidak ditemukan." };
  if (old.statusPeserta === "dicabut") {
    return { ok: false as const, error: "Sertifikat lama sudah dicabut. Tidak perlu re-issue." };
  }

  try {
    const newRow = await db.transaction(async (tx) => {
      // 1. Revoke old participant
      await tx
        .update(participants)
        .set({
          statusPeserta: "dicabut",
          revokedAt: new Date(),
          revokedBy: session.user.id,
          revokeReason: parsed.reason?.trim() || `Diterbitkan ulang (re-issue)`,
          updatedAt: new Date(),
        })
        .where(eq(participants.id, parsedOldId));

      // 2. Create new participant with new noSertifikat (auto-generate)
      const newNoSertifikat = await generateNoSertifikat(old.eventId, tx);

      const [created] = await tx
        .insert(participants)
        .values({
          eventId: old.eventId,
          noSertifikat: newNoSertifikat,
          nama: parsed.nama,
          role: normalizeOptionalRole(parsed.role ?? old.role),
          email: normalizeOptionalEmail(parsed.email ?? old.email),
          replacesParticipantId: parsedOldId,
          updatedAt: new Date(),
        })
        .returning();

      if (!created) throw new Error("Gagal membuat sertifikat baru.");
      return created;
    });

    await writeAuditLog({
      userId: session.user.id,
      aksi: "REISSUE_CERTIFICATE",
      entitasType: "sertifikat_participant",
      entitasId: String(newRow.id),
      detail: {
        oldParticipantId: parsedOldId,
        oldNoSertifikat: old.noSertifikat,
        newNoSertifikat: newRow.noSertifikat,
        nama: parsed.nama,
        reason: parsed.reason ?? null,
      },
    });

    await logRevision({
      participantId: parsedOldId,
      changedBy: session.user.id,
      changeType: "revoke",
      before: { statusPeserta: "aktif" },
      after: { statusPeserta: "dicabut", reissuedAs: newRow.id },
      note: `Diterbitkan ulang sebagai ${newRow.noSertifikat}`,
    });

    await logRevision({
      participantId: newRow.id,
      changedBy: session.user.id,
      changeType: "reissue",
      before: { replacesParticipantId: parsedOldId, oldNoSertifikat: old.noSertifikat },
      after: { noSertifikat: newRow.noSertifikat, nama: newRow.nama },
      note: parsed.reason?.trim() || undefined,
    });

    revalidatePath(`/sertifikat/kegiatan/${old.eventId}`);
    revalidatePath(`/verifikasi/${old.noSertifikat}`);
    revalidatePath(`/verifikasi/${newRow.noSertifikat}`);
    return { ok: true as const, data: newRow };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false as const, error: "Nomor sertifikat baru sudah dipakai." };
    }
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Gagal melakukan re-issue.",
    };
  }
}

// â”€â”€â”€ Revisions (C2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type ParticipantRevisionRow = {
  id: number;
  participantId: number;
  changedBy: string | null;
  changedByName: string | null;
  changeType: string;
  before: unknown;
  after: unknown;
  note: string | null;
  createdAt: Date | null;
};

export async function listParticipantRevisions(participantId: number): Promise<ParticipantRevisionRow[]> {
  await requirePermission("sertifikat", "manage");
  const parsedId = idSchema.parse(participantId);

  const rows = await db
    .select({
      id: participantRevisions.id,
      participantId: participantRevisions.participantId,
      changedBy: participantRevisions.changedBy,
      changedByName: users.namaLengkap,
      changeType: participantRevisions.changeType,
      before: participantRevisions.before,
      after: participantRevisions.after,
      note: participantRevisions.note,
      createdAt: participantRevisions.createdAt,
    })
    .from(participantRevisions)
    .leftJoin(users, eq(participantRevisions.changedBy, users.id))
    .where(eq(participantRevisions.participantId, parsedId))
    .orderBy(desc(participantRevisions.createdAt));

  return rows;
}

// â”€â”€â”€ Trash / Restore (C1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type DeletedParticipantRow = ParticipantRow & {
  eventNamaKegiatan: string;
  eventKodeEvent: string;
};

export async function listDeletedParticipants(): Promise<DeletedParticipantRow[]> {
  await requirePermission("sertifikat", "configure");
  const rows = await db
    .select({
      id: participants.id,
      eventId: participants.eventId,
      noSertifikat: participants.noSertifikat,
      nama: participants.nama,
      role: participants.role,
      email: participants.email,
      emailSentAt: participants.emailSentAt,
      statusPeserta: participants.statusPeserta,
      revokedAt: participants.revokedAt,
      revokedBy: participants.revokedBy,
      revokeReason: participants.revokeReason,
      deletedAt: participants.deletedAt,
      lastPdfHash: participants.lastPdfHash,
      lastPdfGeneratedAt: participants.lastPdfGeneratedAt,
      createdAt: participants.createdAt,
      updatedAt: participants.updatedAt,
      eventNamaKegiatan: events.namaKegiatan,
      eventKodeEvent: events.kodeEvent,
    })
    .from(participants)
    .innerJoin(events, eq(participants.eventId, events.id))
    .where(sql`${participants.deletedAt} IS NOT NULL`)
    .orderBy(desc(participants.deletedAt));
  return rows as DeletedParticipantRow[];
}

export async function restoreParticipant(id: number) {
  const parsedId = idSchema.parse(id);
  const session = await requirePermission("sertifikat", "configure");

  const [existing] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, parsedId))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Peserta tidak ditemukan." };
  if (!existing.deletedAt) return { ok: false as const, error: "Peserta tidak berada di sampah." };

  // Pre-check: if active record with the same noSertifikat already exists, restore would violate the partial unique index
  const [conflicting] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        eq(participants.noSertifikat, existing.noSertifikat),
        eq(participants.statusPeserta, "aktif"),
        sql`${participants.deletedAt} IS NULL`,
      ),
    )
    .limit(1);
  if (conflicting) {
    return {
      ok: false as const,
      error: `Tidak dapat memulihkan: nomor sertifikat ${existing.noSertifikat} sudah dipakai peserta aktif lain.`,
    };
  }

  await db
    .update(participants)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(participants.id, parsedId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "RESTORE_SERTIFIKAT_PARTICIPANT",
    entitasType: "sertifikat_participant",
    entitasId: String(parsedId),
    detail: { noSertifikat: existing.noSertifikat, nama: existing.nama },
  });

  await logRevision({
    participantId: parsedId,
    changedBy: session.user.id,
    changeType: "restore",
    before: { deletedAt: existing.deletedAt },
    after: { deletedAt: null },
  });

  revalidatePath(`/sertifikat/kegiatan/${existing.eventId}`);
  revalidatePath("/sertifikat/sampah");
  return { ok: true as const };
}

export async function bulkDeleteParticipants(ids: number[]) {
  const parsedIds = z.array(z.coerce.number().int().positive()).min(1).parse(ids);
  const session = await requirePermission("sertifikat", "manage");

  const existing = await db
    .select({ id: participants.id, noSertifikat: participants.noSertifikat, nama: participants.nama, eventId: participants.eventId })
    .from(participants)
    .where(and(inArray(participants.id, parsedIds), sql`${participants.deletedAt} IS NULL`));

  if (existing.length === 0) return { ok: false as const, error: "Tidak ada peserta yang ditemukan." };

  await db
    .update(participants)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(inArray(participants.id, existing.map((row) => row.id)));

  const eventIds = [...new Set(existing.map((row) => row.eventId))];

  await writeAuditLog({
    userId: session.user.id,
    aksi: "BULK_SOFT_DELETE_PARTICIPANTS",
    entitasType: "sertifikat_participant",
    entitasId: existing.map((row) => row.id).join(","),
    detail: { count: existing.length, nos: existing.map((row) => row.noSertifikat) },
  });

  for (const eventId of eventIds) {
    revalidatePath(`/sertifikat/kegiatan/${eventId}`);
  }
  for (const row of existing) {
    revalidatePath(`/verifikasi/${row.noSertifikat}`);
  }

  return { ok: true as const, data: { deleted: existing.length } };
}

export async function bulkRevokeParticipants(ids: number[], reason?: string) {
  const parsedIds = z.array(z.coerce.number().int().positive()).min(1).parse(ids);
  const session = await requirePermission("sertifikat", "configure");

  const existing = await db
    .select({ id: participants.id, noSertifikat: participants.noSertifikat, nama: participants.nama, eventId: participants.eventId })
    .from(participants)
    .where(
      and(
        inArray(participants.id, parsedIds),
        sql`${participants.deletedAt} IS NULL`,
        eq(participants.statusPeserta, "aktif"),
      ),
    );

  if (existing.length === 0) return { ok: false as const, error: "Tidak ada peserta aktif yang ditemukan." };

  await db
    .update(participants)
    .set({
      statusPeserta: "dicabut",
      revokedAt: new Date(),
      revokedBy: session.user.id,
      revokeReason: reason?.trim() || null,
      updatedAt: new Date(),
    })
    .where(inArray(participants.id, existing.map((row) => row.id)));

  const eventIds = [...new Set(existing.map((row) => row.eventId))];

  await writeAuditLog({
    userId: session.user.id,
    aksi: "BULK_REVOKE_CERTIFICATES",
    entitasType: "sertifikat_participant",
    entitasId: existing.map((row) => row.id).join(","),
    detail: { count: existing.length, reason: reason ?? null },
  });

  for (const eventId of eventIds) {
    revalidatePath(`/sertifikat/kegiatan/${eventId}`);
  }
  for (const row of existing) {
    revalidatePath(`/verifikasi/${row.noSertifikat}`);
  }

  return { ok: true as const, data: { revoked: existing.length } };
}

export async function bulkImportParticipants(
  eventId: number,
  formData: FormData,
): Promise<{ ok: true; data: BulkImportResult } | { ok: false; error: string }> {
  const parsedEventId = idSchema.parse(eventId);
  const session = await requirePermission("sertifikat", "manage");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "File import wajib diunggah." };
  }

  const [event] = await db
    .select({ id: events.id, namaKegiatan: events.namaKegiatan })
    .from(events)
    .where(eq(events.id, parsedEventId))
    .limit(1);

  if (!event) return { ok: false as const, error: "Kegiatan tidak ditemukan." };

  const rows = await parseImportFile(file);
  const errors: string[] = [];
  const validRows: {
    lineNumber: number;
    noSertifikat: string | null;
    nama: string;
    role: string;
    email: string | null;
  }[] = [];
  const seenNos = new Map<string, number>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const lineNumber = index + 2;
    const noSertifikat = stringifyCell(
      pickCell(row, ["no_sertifikat", "No Sertifikat", "NO SERTIFIKAT"]),
    );
    const nama = stringifyCell(pickCell(row, ["nama", "Nama", "NAMA"]));
    const role = stringifyCell(pickCell(row, ["role", "Role", "ROLE"]));
    const email = stringifyCell(pickCell(row, ["email", "Email", "EMAIL"]));

    if (rejectFormulaCells(lineNumber, [noSertifikat, nama, role, email], errors)) {
      continue;
    }

    if (!nama) {
      errors.push(`Baris ${lineNumber}: nama wajib diisi.`);
      continue;
    }

    if (email && !z.string().email().safeParse(email).success) {
      errors.push(`Baris ${lineNumber} (${nama}): format email tidak valid.`);
      continue;
    }

    if (noSertifikat) {
      const previousLine = seenNos.get(noSertifikat);
      if (previousLine !== undefined) {
        errors.push(
          `Baris ${lineNumber} (${nama}): nomor sertifikat duplikat dengan baris ${previousLine}.`,
        );
        continue;
      }
      seenNos.set(noSertifikat, lineNumber);
    }

    validRows.push({
      lineNumber,
      noSertifikat: noSertifikat || null,
      nama,
      role: normalizeOptionalRole(role),
      email: normalizeOptionalEmail(email),
    });
  }

  if (validRows.length > 0) {
    const candidateNos = validRows
      .map((row) => row.noSertifikat)
      .filter((no): no is string => Boolean(no));
    if (candidateNos.length > 0) {
      const existing = await db
        .select({ noSertifikat: participants.noSertifikat })
        .from(participants)
        .where(
          and(
            inArray(participants.noSertifikat, candidateNos),
            sql`${participants.deletedAt} IS NULL`,
          ),
        );

      if (existing.length > 0) {
        const existingSet = new Set(existing.map((row) => row.noSertifikat));
        for (let index = validRows.length - 1; index >= 0; index -= 1) {
          const row = validRows[index]!;
          if (row.noSertifikat && existingSet.has(row.noSertifikat)) {
            errors.push(
              `Baris ${row.lineNumber} (${row.nama}): nomor sertifikat ${row.noSertifikat} sudah digunakan di sistem.`,
            );
            validRows.splice(index, 1);
          }
        }
      }
    }
  }

  let successCount = 0;
  if (errors.length === 0 && validRows.length > 0) {
    try {
      await db.transaction(async (tx) => {
        const rowsToInsert = [];
        for (const row of validRows) {
          const noSertifikat =
            row.noSertifikat ?? (await generateNoSertifikat(parsedEventId, tx));
          rowsToInsert.push({
            eventId: parsedEventId,
            noSertifikat,
            nama: row.nama,
            role: row.role,
            email: row.email,
            updatedAt: new Date(),
          });
        }
        await tx.insert(participants).values(rowsToInsert);
      });
      successCount = validRows.length;
    } catch (err) {
      const message = isUniqueViolation(err)
        ? "Nomor sertifikat duplikat terdeteksi saat insert; impor dibatalkan."
        : err instanceof Error
          ? err.message
          : "Gagal menyimpan data peserta.";
      return { ok: false as const, error: message };
    }
  }

  const result: BulkImportResult = {
    totalRows: rows.length,
    successCount,
    errors,
  };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "IMPORT_SERTIFIKAT_PARTICIPANTS",
    entitasType: "sertifikat_event",
    entitasId: String(parsedEventId),
    detail: {
      namaKegiatan: event.namaKegiatan,
      fileName: file.name,
      totalRows: result.totalRows,
      successCount: result.successCount,
      errorCount: result.errors.length,
      committed: result.successCount > 0,
    },
  });

  revalidatePath(`/sertifikat/kegiatan/${parsedEventId}`);
  return { ok: true as const, data: result };
}
