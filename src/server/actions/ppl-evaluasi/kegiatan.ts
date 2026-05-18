"use server";

import { and, count, eq, ilike, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/server/db";
import {
  pplKegiatan,
  pplKuesionerLink,
  pplKuesionerResponse,
} from "@/server/db/schema";
import { createKegiatanSchema } from "@/lib/validators/ppl-evaluasi";
import { computeConversionRate } from "@/lib/ppl-conversion-rate";
import { requireSession } from "@/server/actions/auth";
import type {
  ActionResult,
  CreateKegiatanInput,
  UpdateKegiatanInput,
  ListKegiatanOpts,
  PaginatedResult,
  KegiatanRow,
  KegiatanDetail,
} from "./types";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function calculateSkp(tanggalMulai: string, tanggalSelesai: string): number {
  const start = new Date(tanggalMulai);
  const end = new Date(tanggalSelesai);
  const days = differenceInCalendarDays(end, start) + 1;
  return days * 8;
}

// ─── CREATE KEGIATAN ─────────────────────────────────────────────────────────

export async function createKegiatan(
  data: CreateKegiatanInput,
): Promise<ActionResult<{ id: number }>> {
  const session = await requireSession();

  const parsed = createKegiatanSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return {
      ok: false,
      error: firstError?.message ?? "Data tidak valid",
    };
  }

  const input = parsed.data;

  // Auto-calculate SKP if not manually provided
  const skp = input.skp ?? calculateSkp(input.tanggalMulai, input.tanggalSelesai);

  const [row] = await db
    .insert(pplKegiatan)
    .values({
      namaKegiatan: input.namaKegiatan,
      kategoriPpl: input.kategoriPpl,
      tipePelaksanaan: input.tipePelaksanaan,
      tanggalMulai: input.tanggalMulai,
      tanggalSelesai: input.tanggalSelesai,
      lokasi: input.lokasi ?? null,
      skp,
      createdBy: session.user.id,
    })
    .returning({ id: pplKegiatan.id });

  if (!row) {
    return { ok: false, error: "Gagal membuat kegiatan" };
  }

  revalidatePath("/ppl-evaluasi");
  return { ok: true, data: { id: row.id } };
}

// ─── UPDATE KEGIATAN ─────────────────────────────────────────────────────────

export async function updateKegiatan(
  id: number,
  data: UpdateKegiatanInput,
): Promise<ActionResult> {
  await requireSession();

  // Check if kegiatan exists and is not archived
  const [existing] = await db
    .select({ id: pplKegiatan.id, statusEvent: pplKegiatan.statusEvent })
    .from(pplKegiatan)
    .where(eq(pplKegiatan.id, id))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Kegiatan tidak ditemukan" };
  }

  if (existing.statusEvent === "archived") {
    return { ok: false, error: "Kegiatan yang diarsipkan tidak dapat diubah" };
  }

  // Validate the update data if date fields are provided
  // Build a merged object for validation when dates are involved
  if (data.tanggalMulai || data.tanggalSelesai) {
    const [current] = await db
      .select({
        tanggalMulai: pplKegiatan.tanggalMulai,
        tanggalSelesai: pplKegiatan.tanggalSelesai,
      })
      .from(pplKegiatan)
      .where(eq(pplKegiatan.id, id))
      .limit(1);

    const tanggalMulai = data.tanggalMulai ?? current!.tanggalMulai;
    const tanggalSelesai = data.tanggalSelesai ?? current!.tanggalSelesai;

    if (tanggalSelesai < tanggalMulai) {
      return {
        ok: false,
        error: "Tanggal selesai harus sama atau setelah tanggal mulai",
      };
    }

    // Recalculate SKP if dates changed and no manual SKP provided
    if (!data.skp) {
      data = { ...data, skp: calculateSkp(tanggalMulai, tanggalSelesai) };
    }
  }

  // Build the update set
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };

  if (data.namaKegiatan !== undefined) updateSet.namaKegiatan = data.namaKegiatan;
  if (data.kategoriPpl !== undefined) updateSet.kategoriPpl = data.kategoriPpl;
  if (data.tipePelaksanaan !== undefined) updateSet.tipePelaksanaan = data.tipePelaksanaan;
  if (data.tanggalMulai !== undefined) updateSet.tanggalMulai = data.tanggalMulai;
  if (data.tanggalSelesai !== undefined) updateSet.tanggalSelesai = data.tanggalSelesai;
  if (data.lokasi !== undefined) updateSet.lokasi = data.lokasi;
  if (data.skp !== undefined) updateSet.skp = data.skp;

  await db.update(pplKegiatan).set(updateSet).where(eq(pplKegiatan.id, id));

  revalidatePath("/ppl-evaluasi");
  revalidatePath(`/ppl-evaluasi/${id}`);
  return { ok: true };
}

// ─── DELETE KEGIATAN ─────────────────────────────────────────────────────────

export async function deleteKegiatan(id: number): Promise<ActionResult> {
  await requireSession();

  const [existing] = await db
    .select({ id: pplKegiatan.id })
    .from(pplKegiatan)
    .where(eq(pplKegiatan.id, id))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Kegiatan tidak ditemukan" };
  }

  // Check if kegiatan has associated responses or attendance records
  const [responseCount] = await db
    .select({ count: count() })
    .from(pplKuesionerResponse)
    .innerJoin(pplKuesionerLink, eq(pplKuesionerResponse.linkId, pplKuesionerLink.id))
    .where(eq(pplKuesionerLink.kegiatanId, id));

  const [kegiatanData] = await db
    .select({
      pendaftar: pplKegiatan.pendaftar,
      realisasiHadir: pplKegiatan.realisasiHadir,
    })
    .from(pplKegiatan)
    .where(eq(pplKegiatan.id, id))
    .limit(1);

  const hasResponses = (responseCount?.count ?? 0) > 0;
  const hasAttendance =
    (kegiatanData?.pendaftar ?? 0) > 0 || (kegiatanData?.realisasiHadir ?? 0) > 0;

  if (hasResponses || hasAttendance) {
    // Soft-delete: archive instead of deleting
    await db
      .update(pplKegiatan)
      .set({ statusEvent: "archived", updatedAt: new Date() })
      .where(eq(pplKegiatan.id, id));

    revalidatePath("/ppl-evaluasi");
    return { ok: true };
  }

  // Hard delete when no associated data
  await db.delete(pplKegiatan).where(eq(pplKegiatan.id, id));

  revalidatePath("/ppl-evaluasi");
  return { ok: true };
}

// ─── LIST KEGIATAN ───────────────────────────────────────────────────────────

export async function listKegiatan(
  opts: ListKegiatanOpts = {},
): Promise<PaginatedResult<KegiatanRow>> {
  await requireSession();

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 10;
  const offset = (page - 1) * pageSize;

  // Build where conditions
  const conditions = [];

  // Default: show only active kegiatan unless status filter is specified
  if (opts.status) {
    conditions.push(eq(pplKegiatan.statusEvent, opts.status));
  } else {
    conditions.push(eq(pplKegiatan.statusEvent, "aktif"));
  }

  if (opts.kategori) {
    conditions.push(eq(pplKegiatan.kategoriPpl, opts.kategori));
  }

  if (opts.search) {
    conditions.push(ilike(pplKegiatan.namaKegiatan, `%${opts.search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(pplKegiatan)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  // Get paginated data
  const rows = await db
    .select({
      id: pplKegiatan.id,
      namaKegiatan: pplKegiatan.namaKegiatan,
      kategoriPpl: pplKegiatan.kategoriPpl,
      tipePelaksanaan: pplKegiatan.tipePelaksanaan,
      statusEvent: pplKegiatan.statusEvent,
      tanggalMulai: pplKegiatan.tanggalMulai,
      tanggalSelesai: pplKegiatan.tanggalSelesai,
      lokasi: pplKegiatan.lokasi,
      skp: pplKegiatan.skp,
      pendaftar: pplKegiatan.pendaftar,
      realisasiHadir: pplKegiatan.realisasiHadir,
    })
    .from(pplKegiatan)
    .where(whereClause)
    .orderBy(sql`${pplKegiatan.tanggalMulai} DESC`)
    .limit(pageSize)
    .offset(offset);

  return {
    data: rows as KegiatanRow[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ─── GET KEGIATAN ────────────────────────────────────────────────────────────

export async function getKegiatan(id: number): Promise<KegiatanDetail | null> {
  await requireSession();

  const [row] = await db
    .select({
      id: pplKegiatan.id,
      namaKegiatan: pplKegiatan.namaKegiatan,
      kategoriPpl: pplKegiatan.kategoriPpl,
      tipePelaksanaan: pplKegiatan.tipePelaksanaan,
      statusEvent: pplKegiatan.statusEvent,
      tanggalMulai: pplKegiatan.tanggalMulai,
      tanggalSelesai: pplKegiatan.tanggalSelesai,
      lokasi: pplKegiatan.lokasi,
      skp: pplKegiatan.skp,
      pendaftar: pplKegiatan.pendaftar,
      realisasiHadir: pplKegiatan.realisasiHadir,
      createdBy: pplKegiatan.createdBy,
      createdAt: pplKegiatan.createdAt,
      updatedAt: pplKegiatan.updatedAt,
    })
    .from(pplKegiatan)
    .where(eq(pplKegiatan.id, id))
    .limit(1);

  if (!row) return null;

  // Calculate conversion rate
  const conversionRate = computeConversionRate(row.pendaftar, row.realisasiHadir);

  return {
    ...row,
    conversionRate,
  } as KegiatanDetail;
}
