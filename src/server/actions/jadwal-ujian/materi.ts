"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { materiUjian, auditLog } from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";
import {
  materiCreateSchema,
  materiUpdateSchema,
  type MateriCreateInput,
  type MateriUpdateInput,
} from "@/lib/validators/jadwalUjian.schema";

export type MateriRow = {
  id: string;
  nama: string;
  program: string;
  urutan: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function listMateri(): Promise<MateriRow[]> {
  await requireSession();
  return db
    .select({
      id: materiUjian.id,
      nama: materiUjian.nama,
      program: materiUjian.program,
      urutan: materiUjian.urutan,
      createdAt: materiUjian.createdAt,
      updatedAt: materiUjian.updatedAt,
    })
    .from(materiUjian)
    .orderBy(asc(materiUjian.program), asc(materiUjian.urutan), asc(materiUjian.nama));
}

export async function createMateri(data: MateriCreateInput) {
  const parsed = materiCreateSchema.parse(data);
  const session = await requirePermission("jadwalUjian", "manage");

  const id = nanoid();
  const rows = await db
    .insert(materiUjian)
    .values({ id, nama: parsed.nama, program: parsed.program, urutan: parsed.urutan ?? 0 })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Gagal membuat materi ujian");

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_MATERI_UJIAN",
    entitasType: "materi_ujian",
    entitasId: id,
    detail: { nama: parsed.nama },
  });

  revalidatePath("/jadwal-ujian");
  return { ok: true as const, data: row };
}

export async function updateMateri(data: MateriUpdateInput) {
  const parsed = materiUpdateSchema.parse(data);
  const session = await requirePermission("jadwalUjian", "manage");

  const rows = await db
    .update(materiUjian)
    .set({ nama: parsed.nama, program: parsed.program, urutan: parsed.urutan ?? 0, updatedAt: new Date() })
    .where(eq(materiUjian.id, parsed.id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false as const, error: "Materi ujian tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_MATERI_UJIAN",
    entitasType: "materi_ujian",
    entitasId: parsed.id,
    detail: { nama: parsed.nama },
  });

  revalidatePath("/jadwal-ujian");
  return { ok: true as const, data: row };
}

export async function deleteMateri(id: string) {
  const session = await requirePermission("jadwalUjian", "configure");

  const rows = await db
    .select({ nama: materiUjian.nama })
    .from(materiUjian)
    .where(eq(materiUjian.id, id));
  if (!rows[0]) return { ok: false as const, error: "Materi ujian tidak ditemukan." };

  await db.delete(materiUjian).where(eq(materiUjian.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_MATERI_UJIAN",
    entitasType: "materi_ujian",
    entitasId: id,
    detail: { nama: rows[0].nama },
  });

  revalidatePath("/jadwal-ujian");
  return { ok: true as const };
}
