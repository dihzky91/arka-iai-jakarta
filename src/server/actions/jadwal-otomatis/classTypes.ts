"use server";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { classTypes } from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";
import { writeAuditLog } from "@/server/lib/audit";

export async function listClassTypes() {
  await requireSession();
  return db.select().from(classTypes).orderBy(asc(classTypes.name));
}

export async function listAllClassTypes() {
  await requirePermission("jadwalPelatihan", "view");
  return db.select().from(classTypes).orderBy(asc(classTypes.name));
}

const createClassTypeSchema = z.object({
  code: z.string().trim().min(1, "Kode wajib diisi").max(30),
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  activeDays: z.string().trim().min(1, "Hari aktif wajib diisi").max(100),
  slot1Start: z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:MM"),
  slot1End: z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:MM"),
  slot2Start: z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:MM"),
  slot2End: z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:MM"),
});

export async function createClassType(input: unknown) {
  const session = await requirePermission("jadwalPelatihan", "manage");

  const parsed = createClassTypeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const existing = await db
    .select({ id: classTypes.id })
    .from(classTypes)
    .where(eq(classTypes.code, parsed.data.code))
    .then((r) => r[0]);

  if (existing) {
    return { ok: false as const, error: `Kode tipe kelas "${parsed.data.code}" sudah digunakan.` };
  }

  const rows = await db
    .insert(classTypes)
    .values(parsed.data)
    .returning();

  const created = rows[0];
  if (!created) return { ok: false as const, error: "Gagal membuat tipe kelas." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_CLASS_TYPE",
    entitasType: "class_type",
    entitasId: created.id,
    detail: { code: parsed.data.code, name: parsed.data.name },
  });

  revalidatePath("/jadwal-otomatis");
  revalidatePath("/jadwal-otomatis/master-data");
  return { ok: true as const, data: created };
}

const updateClassTypeSchema = z.object({
  id: z.string().min(1),
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(100),
  activeDays: z.string().trim().min(1).max(100),
  slot1Start: z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:MM"),
  slot1End: z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:MM"),
  slot2Start: z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:MM"),
  slot2End: z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:MM"),
});

export async function updateClassType(input: unknown) {
  const session = await requirePermission("jadwalPelatihan", "manage");

  const parsed = updateClassTypeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const duplicate = await db
    .select({ id: classTypes.id })
    .from(classTypes)
    .where(eq(classTypes.code, parsed.data.code))
    .then((r) => r[0]);

  if (duplicate && duplicate.id !== parsed.data.id) {
    return { ok: false as const, error: `Kode tipe kelas "${parsed.data.code}" sudah digunakan.` };
  }

  const updated = await db
    .update(classTypes)
    .set({
      code: parsed.data.code,
      name: parsed.data.name,
      activeDays: parsed.data.activeDays,
      slot1Start: parsed.data.slot1Start,
      slot1End: parsed.data.slot1End,
      slot2Start: parsed.data.slot2Start,
      slot2End: parsed.data.slot2End,
    })
    .where(eq(classTypes.id, parsed.data.id))
    .returning({ id: classTypes.id });

  if (updated.length === 0) {
    return { ok: false as const, error: "Tipe kelas tidak ditemukan." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_CLASS_TYPE",
    entitasType: "class_type",
    entitasId: parsed.data.id,
    detail: { code: parsed.data.code, name: parsed.data.name },
  });

  revalidatePath("/jadwal-otomatis");
  revalidatePath("/jadwal-otomatis/master-data");
  return { ok: true as const };
}
