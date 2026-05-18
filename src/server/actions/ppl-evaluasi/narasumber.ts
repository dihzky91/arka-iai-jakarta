"use server";

import { and, count, eq, ilike, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  pplNarasumber,
  pplKegiatanNarasumber,
  pplKegiatan,
} from "@/server/db/schema";
import { narasumberSchema } from "@/lib/validators/ppl-evaluasi";
import { requireSession } from "@/server/actions/auth";
import { calculateHonorarium } from "@/lib/ppl-honorarium";
import type {
  ActionResult,
  CreateNarasumberInput,
  UpdateNarasumberInput,
  ListNarasumberOpts,
  PaginatedResult,
  NarasumberRow,
  AssignNarasumberInput,
} from "./types";

// ─── CREATE NARASUMBER ───────────────────────────────────────────────────────

export async function createNarasumber(
  data: CreateNarasumberInput,
): Promise<ActionResult<{ id: number }>> {
  await requireSession();

  const parsed = narasumberSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return {
      ok: false,
      error: firstError?.message ?? "Data tidak valid",
    };
  }

  const input = parsed.data;

  // Check email uniqueness
  const [existing] = await db
    .select({ id: pplNarasumber.id })
    .from(pplNarasumber)
    .where(eq(pplNarasumber.email, input.email))
    .limit(1);

  if (existing) {
    return { ok: false, error: "Email sudah digunakan oleh narasumber lain" };
  }

  const [row] = await db
    .insert(pplNarasumber)
    .values({
      nama: input.nama,
      email: input.email,
      noTelepon: input.noTelepon ?? null,
      isActive: input.isActive ?? true,
      feePerSkp: input.feePerSkp,
    })
    .returning({ id: pplNarasumber.id });

  if (!row) {
    return { ok: false, error: "Gagal membuat narasumber" };
  }

  revalidatePath("/ppl-evaluasi/narasumber");
  return { ok: true, data: { id: row.id } };
}

// ─── UPDATE NARASUMBER ───────────────────────────────────────────────────────

export async function updateNarasumber(
  id: number,
  data: UpdateNarasumberInput,
): Promise<ActionResult> {
  await requireSession();

  // Check if narasumber exists
  const [existing] = await db
    .select({ id: pplNarasumber.id })
    .from(pplNarasumber)
    .where(eq(pplNarasumber.id, id))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Narasumber tidak ditemukan" };
  }

  // Validate the update data
  const parsed = narasumberSchema.partial().safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return {
      ok: false,
      error: firstError?.message ?? "Data tidak valid",
    };
  }

  const input = parsed.data;

  // Check email uniqueness if email is being updated
  if (input.email) {
    const [duplicate] = await db
      .select({ id: pplNarasumber.id })
      .from(pplNarasumber)
      .where(and(eq(pplNarasumber.email, input.email), ne(pplNarasumber.id, id)))
      .limit(1);

    if (duplicate) {
      return { ok: false, error: "Email sudah digunakan oleh narasumber lain" };
    }
  }

  // Build the update set
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };

  if (input.nama !== undefined) updateSet.nama = input.nama;
  if (input.email !== undefined) updateSet.email = input.email;
  if (input.noTelepon !== undefined) updateSet.noTelepon = input.noTelepon;
  if (input.isActive !== undefined) updateSet.isActive = input.isActive;
  if (input.feePerSkp !== undefined) updateSet.feePerSkp = input.feePerSkp;

  await db.update(pplNarasumber).set(updateSet).where(eq(pplNarasumber.id, id));

  revalidatePath("/ppl-evaluasi/narasumber");
  return { ok: true };
}

// ─── DEACTIVATE NARASUMBER ───────────────────────────────────────────────────

export async function deactivateNarasumber(id: number): Promise<ActionResult> {
  await requireSession();

  // Check if narasumber exists
  const [existing] = await db
    .select({ id: pplNarasumber.id })
    .from(pplNarasumber)
    .where(eq(pplNarasumber.id, id))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Narasumber tidak ditemukan" };
  }

  // Check if narasumber is referenced by any kegiatan assignments
  const [assignmentCount] = await db
    .select({ count: count() })
    .from(pplKegiatanNarasumber)
    .where(eq(pplKegiatanNarasumber.narasumberId, id));

  if ((assignmentCount?.count ?? 0) > 0) {
    // Soft-delete: deactivate instead of deleting
    await db
      .update(pplNarasumber)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(pplNarasumber.id, id));

    revalidatePath("/ppl-evaluasi/narasumber");
    return { ok: true };
  }

  // If no references, still deactivate (not hard delete) per requirement 2.7
  await db
    .update(pplNarasumber)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(pplNarasumber.id, id));

  revalidatePath("/ppl-evaluasi/narasumber");
  return { ok: true };
}

// ─── LIST NARASUMBER ─────────────────────────────────────────────────────────

export async function listNarasumber(
  opts: ListNarasumberOpts = {},
): Promise<PaginatedResult<NarasumberRow>> {
  await requireSession();

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 10;
  const offset = (page - 1) * pageSize;

  // Build where conditions
  const conditions = [];

  if (opts.isActive !== undefined) {
    conditions.push(eq(pplNarasumber.isActive, opts.isActive));
  }

  if (opts.search) {
    conditions.push(
      ilike(pplNarasumber.nama, `%${opts.search}%`),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(pplNarasumber)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  // Get paginated data
  const rows = await db
    .select({
      id: pplNarasumber.id,
      nama: pplNarasumber.nama,
      email: pplNarasumber.email,
      noTelepon: pplNarasumber.noTelepon,
      isActive: pplNarasumber.isActive,
      feePerSkp: pplNarasumber.feePerSkp,
    })
    .from(pplNarasumber)
    .where(whereClause)
    .orderBy(pplNarasumber.nama)
    .limit(pageSize)
    .offset(offset);

  return {
    data: rows as NarasumberRow[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ─── ASSIGN NARASUMBER TO KEGIATAN ───────────────────────────────────────────

export async function assignNarasumberToKegiatan(
  data: AssignNarasumberInput,
): Promise<ActionResult> {
  await requireSession();

  // Validate topik length
  if (data.topik && data.topik.length > 200) {
    return { ok: false, error: "Topik assignment maksimal 200 karakter" };
  }

  // Check if narasumber exists and is active
  const [narasumber] = await db
    .select({ id: pplNarasumber.id, feePerSkp: pplNarasumber.feePerSkp, isActive: pplNarasumber.isActive })
    .from(pplNarasumber)
    .where(eq(pplNarasumber.id, data.narasumberId))
    .limit(1);

  if (!narasumber) {
    return { ok: false, error: "Narasumber tidak ditemukan" };
  }

  if (!narasumber.isActive) {
    return { ok: false, error: "Narasumber tidak aktif" };
  }

  // Check if kegiatan exists
  const [kegiatan] = await db
    .select({ id: pplKegiatan.id, skp: pplKegiatan.skp, statusEvent: pplKegiatan.statusEvent })
    .from(pplKegiatan)
    .where(eq(pplKegiatan.id, data.kegiatanId))
    .limit(1);

  if (!kegiatan) {
    return { ok: false, error: "Kegiatan tidak ditemukan" };
  }

  if (kegiatan.statusEvent === "archived") {
    return { ok: false, error: "Kegiatan yang diarsipkan tidak dapat diubah" };
  }

  // Auto-calculate total honorarium: feePerSkp × SKP kegiatan
  const totalHonorarium = calculateHonorarium(narasumber.feePerSkp, kegiatan.skp);

  await db.insert(pplKegiatanNarasumber).values({
    kegiatanId: data.kegiatanId,
    narasumberId: data.narasumberId,
    topik: data.topik ?? null,
    totalHonorarium,
  });

  revalidatePath("/ppl-evaluasi/narasumber");
  revalidatePath(`/ppl-evaluasi/${data.kegiatanId}`);
  return { ok: true };
}
