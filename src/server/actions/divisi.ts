"use server";

import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { divisi, users, auditLog } from "@/server/db/schema";
import {
  divisiCreateSchema,
  divisiUpdateSchema,
  divisiDeleteSchema,
  normalizeKode,
  type DivisiCreateInput,
  type DivisiUpdateInput,
} from "@/lib/validators/divisi.schema";
import { requirePermission, requireSession } from "./auth";

export type DivisiRow = {
  id: number;
  nama: string;
  kode: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  jumlahPegawai: number;
};

export async function listDivisi(): Promise<DivisiRow[]> {
  await requireSession();
  const rows = await db
    .select({
      id: divisi.id,
      nama: divisi.nama,
      kode: divisi.kode,
      createdAt: divisi.createdAt,
      updatedAt: divisi.updatedAt,
      jumlahPegawai: sql<number>`count(${users.id})::int`.as("jumlah_pegawai"),
    })
    .from(divisi)
    .leftJoin(users, eq(users.divisiId, divisi.id))
    .groupBy(divisi.id)
    .orderBy(asc(divisi.nama));
  return rows;
}

export async function createDivisi(data: DivisiCreateInput) {
  const parsed = divisiCreateSchema.parse(data);
  const session = await requirePermission("divisi", "create");

  try {
    const kode = normalizeKode(parsed.kode);
    const rows = await db
      .insert(divisi)
      .values({ nama: parsed.nama, kode })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Gagal membuat divisi");

    await writeAuditLog({
      userId: session.user.id,
      aksi: "CREATE_DIVISI",
      entitasType: "divisi",
      entitasId: String(row.id),
      detail: { nama: parsed.nama, kode },
    });

    revalidatePath("/divisi");
    return { ok: true as const, data: row };
  } catch (err) {
    if (err instanceof Error && err.message.includes("unique")) {
      return { ok: false as const, error: "Kode divisi sudah digunakan." };
    }
    throw err;
  }
}

export async function updateDivisi(data: DivisiUpdateInput) {
  const parsed = divisiUpdateSchema.parse(data);
  const session = await requirePermission("divisi", "update");

  try {
    const kode = normalizeKode(parsed.kode);
    const rows = await db
      .update(divisi)
      .set({ nama: parsed.nama, kode, updatedAt: new Date() })
      .where(eq(divisi.id, parsed.id))
      .returning();
    const row = rows[0];

    if (!row) {
      return { ok: false as const, error: "Divisi tidak ditemukan." };
    }

    await writeAuditLog({
      userId: session.user.id,
      aksi: "UPDATE_DIVISI",
      entitasType: "divisi",
      entitasId: String(parsed.id),
      detail: { nama: parsed.nama, kode },
    });

    revalidatePath("/divisi");
    return { ok: true as const, data: row };
  } catch (err) {
    if (err instanceof Error && err.message.includes("unique")) {
      return { ok: false as const, error: "Kode divisi sudah digunakan." };
    }
    throw err;
  }
}

export async function deleteDivisi(data: { id: number }) {
  const parsed = divisiDeleteSchema.parse(data);
  const session = await requirePermission("divisi", "delete");

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.divisiId, parsed.id));
  const count = countResult[0]?.count ?? 0;

  if (count > 0) {
    return {
      ok: false as const,
      error: `Tidak bisa dihapus: masih ada ${count} pegawai terdaftar di divisi ini.`,
    };
  }

  await db.delete(divisi).where(eq(divisi.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_DIVISI",
    entitasType: "divisi",
    entitasId: String(parsed.id),
    detail: null,
  });

  revalidatePath("/divisi");
  return { ok: true as const };
}
