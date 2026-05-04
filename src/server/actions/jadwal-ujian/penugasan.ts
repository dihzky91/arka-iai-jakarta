"use server";

import { asc, eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { penugasanPengawas, jadwalUjian, pengawas, kelasUjian, auditLog } from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";
import {
  syncPenugasanPengawasEvent,
  removePenugasanPengawasEvent,
} from "@/server/actions/calendar";
import {
  assignPengawasSchema,
  type AssignPengawasInput,
} from "@/lib/validators/jadwalUjian.schema";

export type PenugasanRow = {
  id: string;
  ujianId: string;
  mataPelajaran: string[];
  tanggalUjian: string;
  jamMulai: string;
  jamSelesai: string;
  namaKelas: string;
  program: string;
  pengawasId: string;
  namaPengawas: string;
  konflik: boolean;
  createdAt: Date;
};

// â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  // Overlap jika A.mulai < B.selesai DAN A.selesai > B.mulai
  return aStart < bEnd && aEnd > bStart;
}

async function detectConflict(
  pengawasId: string,
  tanggalUjian: string,
  jamMulai: string,
  jamSelesai: string,
  excludeUjianId?: string,
): Promise<boolean> {
  // Ambil semua ujian yang sudah ditugaskan ke pengawas ini pada tanggal yang sama
  const existing = await db
    .select({
      ujianId: penugasanPengawas.ujianId,
      jamMulai: jadwalUjian.jamMulai,
      jamSelesai: jadwalUjian.jamSelesai,
    })
    .from(penugasanPengawas)
    .leftJoin(jadwalUjian, eq(penugasanPengawas.ujianId, jadwalUjian.id))
    .where(
      and(
        eq(penugasanPengawas.pengawasId, pengawasId),
        eq(jadwalUjian.tanggalUjian, tanggalUjian),
      ),
    );

  return existing.some((e) => {
    if (excludeUjianId && e.ujianId === excludeUjianId) return false;
    if (!e.jamMulai || !e.jamSelesai) return false;
    return timesOverlap(jamMulai, jamSelesai, e.jamMulai, e.jamSelesai);
  });
}

// â”€â”€â”€ QUERIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getPenugasanByUjian(ujianId: string): Promise<PenugasanRow[]> {
  await requireSession();

  const rows = await db
    .select({
      id: penugasanPengawas.id,
      ujianId: penugasanPengawas.ujianId,
      mataPelajaran: jadwalUjian.mataPelajaran,
      tanggalUjian: jadwalUjian.tanggalUjian,
      jamMulai: jadwalUjian.jamMulai,
      jamSelesai: jadwalUjian.jamSelesai,
      namaKelas: kelasUjian.namaKelas,
      program: kelasUjian.program,
      pengawasId: penugasanPengawas.pengawasId,
      namaPengawas: pengawas.nama,
      konflik: penugasanPengawas.konflik,
      createdAt: penugasanPengawas.createdAt,
    })
    .from(penugasanPengawas)
    .leftJoin(jadwalUjian, eq(penugasanPengawas.ujianId, jadwalUjian.id))
    .leftJoin(kelasUjian, eq(jadwalUjian.kelasId, kelasUjian.id))
    .leftJoin(pengawas, eq(penugasanPengawas.pengawasId, pengawas.id))
    .where(eq(penugasanPengawas.ujianId, ujianId))
    .orderBy(asc(pengawas.nama));

  return rows as PenugasanRow[];
}

export type JadwalPengawasRow = {
  penugasanId: string;
  pengawasId: string;
  namaPengawas: string;
  ujianId: string;
  mataPelajaran: string[];
  tanggalUjian: string;
  jamMulai: string;
  jamSelesai: string;
  namaKelas: string;
  program: string;
  tipe: string;
  lokasi: string | null;
  konflik: boolean;
};

export type JadwalPengawasFilter = {
  pengawasId?: string;
  tanggalMulai?: string;
  tanggalSelesai?: string;
};

export async function getPenugasanByPengawas(
  filter: JadwalPengawasFilter = {},
): Promise<JadwalPengawasRow[]> {
  await requireSession();

  const conditions = [];
  if (filter.pengawasId) conditions.push(eq(penugasanPengawas.pengawasId, filter.pengawasId));
  if (filter.tanggalMulai) {
    const { gte } = await import("drizzle-orm");
    conditions.push(gte(jadwalUjian.tanggalUjian, filter.tanggalMulai));
  }
  if (filter.tanggalSelesai) {
    const { lte } = await import("drizzle-orm");
    conditions.push(lte(jadwalUjian.tanggalUjian, filter.tanggalSelesai));
  }

  const rows = await db
    .select({
      penugasanId: penugasanPengawas.id,
      pengawasId: penugasanPengawas.pengawasId,
      namaPengawas: pengawas.nama,
      ujianId: penugasanPengawas.ujianId,
      mataPelajaran: jadwalUjian.mataPelajaran,
      tanggalUjian: jadwalUjian.tanggalUjian,
      jamMulai: jadwalUjian.jamMulai,
      jamSelesai: jadwalUjian.jamSelesai,
      namaKelas: kelasUjian.namaKelas,
      program: kelasUjian.program,
      tipe: kelasUjian.tipe,
      lokasi: kelasUjian.lokasi,
      konflik: penugasanPengawas.konflik,
    })
    .from(penugasanPengawas)
    .leftJoin(jadwalUjian, eq(penugasanPengawas.ujianId, jadwalUjian.id))
    .leftJoin(kelasUjian, eq(jadwalUjian.kelasId, kelasUjian.id))
    .leftJoin(pengawas, eq(penugasanPengawas.pengawasId, pengawas.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(jadwalUjian.tanggalUjian), asc(jadwalUjian.jamMulai));

  return rows as JadwalPengawasRow[];
}

// â”€â”€â”€ MUTATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function assignPengawas(data: AssignPengawasInput) {
  const parsed = assignPengawasSchema.parse(data);
  const session = await requirePermission("jadwalUjian", "manage");

  // Ambil data ujian untuk pengecekan konflik
  const ujianRows = await db
    .select({
      tanggalUjian: jadwalUjian.tanggalUjian,
      jamMulai: jadwalUjian.jamMulai,
      jamSelesai: jadwalUjian.jamSelesai,
      mataPelajaran: jadwalUjian.mataPelajaran,
    })
    .from(jadwalUjian)
    .where(eq(jadwalUjian.id, parsed.ujianId));

  const ujian = ujianRows[0];
  if (!ujian) return { ok: false as const, error: "Jadwal ujian tidak ditemukan." };

  const konflik = await detectConflict(
    parsed.pengawasId,
    ujian.tanggalUjian,
    ujian.jamMulai,
    ujian.jamSelesai,
    parsed.ujianId,
  );

  try {
    const id = nanoid();
    const rows = await db
      .insert(penugasanPengawas)
      .values({
        id,
        ujianId: parsed.ujianId,
        pengawasId: parsed.pengawasId,
        konflik,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Gagal menyimpan penugasan");

    await writeAuditLog({
      userId: session.user.id,
      aksi: "ASSIGN_PENGAWAS",
      entitasType: "penugasan_pengawas",
      entitasId: id,
      detail: {
        ujianId: parsed.ujianId,
        pengawasId: parsed.pengawasId,
        mataPelajaran: ujian.mataPelajaran,
        konflik,
      },
    });

    // Sync to calendar
    const [ppKelas] = await db
      .select({ namaKelas: kelasUjian.namaKelas })
      .from(kelasUjian)
      .innerJoin(jadwalUjian, eq(jadwalUjian.kelasId, kelasUjian.id))
      .where(eq(jadwalUjian.id, parsed.ujianId));
    const [ppNama] = await db
      .select({ nama: pengawas.nama })
      .from(pengawas)
      .where(eq(pengawas.id, parsed.pengawasId));
    if (ppKelas && ppNama) {
      await syncPenugasanPengawasEvent(id, ppNama.nama, ujian.mataPelajaran, ppKelas.namaKelas, ujian.tanggalUjian, ujian.jamMulai, ujian.jamSelesai);
    }

    revalidatePath("/jadwal-ujian");
    revalidatePath(`/jadwal-ujian/${parsed.ujianId}`);
    revalidatePath("/jadwal-ujian/penugasan");
    revalidatePath("/kalender");

    return { ok: true as const, data: row, konflik };
  } catch (err) {
    if (err instanceof Error && err.message.includes("uniq_ujian_pengawas")) {
      return { ok: false as const, error: "Pengawas sudah ditugaskan di ujian ini." };
    }
    throw err;
  }
}

export async function unassignPengawas(penugasanId: string) {
  const session = await requirePermission("jadwalUjian", "manage");

  const existing = await db
    .select({ ujianId: penugasanPengawas.ujianId, pengawasId: penugasanPengawas.pengawasId })
    .from(penugasanPengawas)
    .where(eq(penugasanPengawas.id, penugasanId));

  if (!existing[0]) return { ok: false as const, error: "Penugasan tidak ditemukan." };

  await removePenugasanPengawasEvent(penugasanId);
  await db.delete(penugasanPengawas).where(eq(penugasanPengawas.id, penugasanId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UNASSIGN_PENGAWAS",
    entitasType: "penugasan_pengawas",
    entitasId: penugasanId,
    detail: { ujianId: existing[0].ujianId, pengawasId: existing[0].pengawasId },
  });

  revalidatePath("/jadwal-ujian");
  revalidatePath(`/jadwal-ujian/${existing[0].ujianId}`);
  revalidatePath("/jadwal-ujian/penugasan");
  revalidatePath("/kalender");

  return { ok: true as const };
}
