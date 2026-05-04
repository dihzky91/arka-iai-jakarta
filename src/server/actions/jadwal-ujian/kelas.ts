"use server";

import { asc, eq, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { kelasUjian, jadwalUjian, auditLog } from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";
import {
  kelasCreateSchema,
  kelasUpdateSchema,
  type KelasCreateInput,
  type KelasUpdateInput,
} from "@/lib/validators/jadwalUjian.schema";

export type KelasRow = {
  id: string;
  namaKelas: string;
  program: "Brevet AB" | "Brevet C" | "BFA" | "Lainnya";
  tipe: "Reguler Pagi" | "Reguler Siang" | "Reguler Sore" | "Weekend";
  mode: "Offline" | "Online";
  lokasi: string | null;
  catatan: string | null;
  jumlahUjian: number;
  kelasPelatihanId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type KelasFilter = {
  program?: "Brevet AB" | "Brevet C" | "BFA" | "Lainnya";
  tipe?: "Reguler Pagi" | "Reguler Siang" | "Reguler Sore" | "Weekend";
  mode?: "Offline" | "Online";
};

export async function listKelas(filter: KelasFilter = {}): Promise<KelasRow[]> {
  await requireSession();

  const conditions = [];
  if (filter.program) conditions.push(eq(kelasUjian.program, filter.program));
  if (filter.tipe) conditions.push(eq(kelasUjian.tipe, filter.tipe));
  if (filter.mode) conditions.push(eq(kelasUjian.mode, filter.mode));

  const rows = await db
    .select({
      id: kelasUjian.id,
      namaKelas: kelasUjian.namaKelas,
      program: kelasUjian.program,
      tipe: kelasUjian.tipe,
      mode: kelasUjian.mode,
      lokasi: kelasUjian.lokasi,
      catatan: kelasUjian.catatan,
      jumlahUjian: sql<number>`count(${jadwalUjian.id})::int`.as("jumlah_ujian"),
      kelasPelatihanId: kelasUjian.kelasPelatihanId,
      createdAt: kelasUjian.createdAt,
      updatedAt: kelasUjian.updatedAt,
    })
    .from(kelasUjian)
    .leftJoin(jadwalUjian, eq(jadwalUjian.kelasId, kelasUjian.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(kelasUjian.id)
    .orderBy(asc(kelasUjian.namaKelas));

  return rows as KelasRow[];
}

export async function createKelas(data: KelasCreateInput) {
  const parsed = kelasCreateSchema.parse(data);
  const session = await requirePermission("jadwalUjian", "manage");

  const id = nanoid();
  const rows = await db
    .insert(kelasUjian)
    .values({
      id,
      namaKelas: parsed.namaKelas,
      program: parsed.program,
      tipe: parsed.tipe,
      mode: parsed.mode,
      lokasi: parsed.lokasi || null,
      catatan: parsed.catatan || null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Gagal membuat kelas");

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_KELAS_UJIAN",
    entitasType: "kelas_ujian",
    entitasId: id,
    detail: { namaKelas: parsed.namaKelas, program: parsed.program },
  });

  revalidatePath("/jadwal-ujian/kelas");
  return { ok: true as const, data: row };
}

export async function updateKelas(data: KelasUpdateInput) {
  const parsed = kelasUpdateSchema.parse(data);
  const session = await requirePermission("jadwalUjian", "manage");

  const rows = await db
    .update(kelasUjian)
    .set({
      namaKelas: parsed.namaKelas,
      program: parsed.program,
      tipe: parsed.tipe,
      mode: parsed.mode,
      lokasi: parsed.lokasi || null,
      catatan: parsed.catatan || null,
      updatedAt: new Date(),
    })
    .where(eq(kelasUjian.id, parsed.id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false as const, error: "Kelas tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_KELAS_UJIAN",
    entitasType: "kelas_ujian",
    entitasId: parsed.id,
    detail: { namaKelas: parsed.namaKelas, program: parsed.program },
  });

  revalidatePath("/jadwal-ujian/kelas");
  return { ok: true as const, data: row };
}

export async function deleteKelas(id: string) {
  const session = await requirePermission("jadwalUjian", "configure");

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jadwalUjian)
    .where(eq(jadwalUjian.kelasId, id));
  const count = countResult[0]?.count ?? 0;

  if (count > 0) {
    return {
      ok: false as const,
      error: `Tidak bisa dihapus: kelas masih memiliki ${count} jadwal ujian.`,
    };
  }

  await db.delete(kelasUjian).where(eq(kelasUjian.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_KELAS_UJIAN",
    entitasType: "kelas_ujian",
    entitasId: id,
    detail: null,
  });

  revalidatePath("/jadwal-ujian/kelas");
  return { ok: true as const };
}
