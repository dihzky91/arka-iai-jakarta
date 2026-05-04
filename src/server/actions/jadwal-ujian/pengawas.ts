"use server";

import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { pengawas, penugasanPengawas, auditLog } from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";
import {
  pengawasCreateSchema,
  pengawasUpdateSchema,
  type PengawasCreateInput,
  type PengawasUpdateInput,
} from "@/lib/validators/jadwalUjian.schema";

export type PengawasRow = {
  id: string;
  nama: string;
  catatan: string | null;
  jumlahTugas: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function listPengawas(): Promise<PengawasRow[]> {
  await requireSession();
  const rows = await db
    .select({
      id: pengawas.id,
      nama: pengawas.nama,
      catatan: pengawas.catatan,
      jumlahTugas: sql<number>`count(${penugasanPengawas.id})::int`.as("jumlah_tugas"),
      createdAt: pengawas.createdAt,
      updatedAt: pengawas.updatedAt,
    })
    .from(pengawas)
    .leftJoin(penugasanPengawas, eq(penugasanPengawas.pengawasId, pengawas.id))
    .groupBy(pengawas.id)
    .orderBy(asc(pengawas.nama));
  return rows;
}

export async function createPengawas(data: PengawasCreateInput) {
  const parsed = pengawasCreateSchema.parse(data);
  const session = await requirePermission("jadwalUjian", "manage");

  const id = nanoid();
  const rows = await db
    .insert(pengawas)
    .values({
      id,
      nama: parsed.nama,
      catatan: parsed.catatan || null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Gagal membuat pengawas");

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_PENGAWAS",
    entitasType: "pengawas",
    entitasId: id,
    detail: { nama: parsed.nama },
  });

  revalidatePath("/jadwal-ujian/pengawas");
  return { ok: true as const, data: row };
}

export async function updatePengawas(data: PengawasUpdateInput) {
  const parsed = pengawasUpdateSchema.parse(data);
  const session = await requirePermission("jadwalUjian", "manage");

  const rows = await db
    .update(pengawas)
    .set({
      nama: parsed.nama,
      catatan: parsed.catatan || null,
      updatedAt: new Date(),
    })
    .where(eq(pengawas.id, parsed.id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false as const, error: "Pengawas tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PENGAWAS",
    entitasType: "pengawas",
    entitasId: parsed.id,
    detail: { nama: parsed.nama },
  });

  revalidatePath("/jadwal-ujian/pengawas");
  return { ok: true as const, data: row };
}

export async function deletePengawas(id: string) {
  const session = await requirePermission("jadwalUjian", "configure");

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(penugasanPengawas)
    .where(eq(penugasanPengawas.pengawasId, id));
  const count = countResult[0]?.count ?? 0;

  if (count > 0) {
    return {
      ok: false as const,
      error: `Tidak bisa dihapus: pengawas masih memiliki ${count} penugasan aktif.`,
    };
  }

  await db.delete(pengawas).where(eq(pengawas.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_PENGAWAS",
    entitasType: "pengawas",
    entitasId: id,
    detail: null,
  });

  revalidatePath("/jadwal-ujian/pengawas");
  return { ok: true as const };
}
