"use server";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { programs } from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";
import { writeAuditLog } from "@/server/lib/audit";

export async function listPrograms() {
  await requireSession();
  return db.select().from(programs).where(eq(programs.isActive, true)).orderBy(asc(programs.name));
}

export async function listAllPrograms() {
  await requirePermission("jadwalPelatihan", "view");
  return db.select().from(programs).orderBy(asc(programs.name));
}

export async function getProgram(id: string) {
  await requireSession();
  const rows = await db.select().from(programs).where(eq(programs.id, id));
  return rows[0] ?? null;
}

const createProgramSchema = z.object({
  code: z.string().trim().min(1, "Kode wajib diisi").max(20),
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  totalSessions: z.number().int().min(1, "Total sesi minimal 1"),
  totalMeetings: z.number().int().min(1, "Total pertemuan minimal 1"),
});

export async function createProgram(input: unknown) {
  const session = await requirePermission("jadwalPelatihan", "manage");

  const parsed = createProgramSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const existing = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.code, parsed.data.code))
    .then((r) => r[0]);

  if (existing) {
    return { ok: false as const, error: `Kode program "${parsed.data.code}" sudah digunakan.` };
  }

  const rows = await db
    .insert(programs)
    .values({
      code: parsed.data.code,
      name: parsed.data.name,
      totalSessions: parsed.data.totalSessions,
      totalMeetings: parsed.data.totalMeetings,
    })
    .returning();

  const created = rows[0];
  if (!created) return { ok: false as const, error: "Gagal membuat program." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_PROGRAM",
    entitasType: "program",
    entitasId: created.id,
    detail: { code: parsed.data.code, name: parsed.data.name },
  });

  revalidatePath("/jadwal-otomatis");
  revalidatePath("/jadwal-otomatis/master-data");
  return { ok: true as const, data: created };
}

const updateProgramSchema = z.object({
  id: z.string().min(1),
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(100),
  totalSessions: z.number().int().min(1),
  totalMeetings: z.number().int().min(1),
});

export async function updateProgram(input: unknown) {
  const session = await requirePermission("jadwalPelatihan", "manage");

  const parsed = updateProgramSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const duplicate = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.code, parsed.data.code))
    .then((r) => r[0]);

  if (duplicate && duplicate.id !== parsed.data.id) {
    return { ok: false as const, error: `Kode program "${parsed.data.code}" sudah digunakan.` };
  }

  const updated = await db
    .update(programs)
    .set({
      code: parsed.data.code,
      name: parsed.data.name,
      totalSessions: parsed.data.totalSessions,
      totalMeetings: parsed.data.totalMeetings,
      updatedAt: new Date(),
    })
    .where(eq(programs.id, parsed.data.id))
    .returning({ id: programs.id });

  if (updated.length === 0) {
    return { ok: false as const, error: "Program tidak ditemukan." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PROGRAM",
    entitasType: "program",
    entitasId: parsed.data.id,
    detail: { code: parsed.data.code, name: parsed.data.name },
  });

  revalidatePath("/jadwal-otomatis");
  revalidatePath("/jadwal-otomatis/master-data");
  return { ok: true as const };
}

export async function archiveProgram(id: string) {
  const session = await requirePermission("jadwalPelatihan", "manage");

  const existing = await db
    .select({ id: programs.id, isActive: programs.isActive, name: programs.name })
    .from(programs)
    .where(eq(programs.id, id))
    .then((r) => r[0]);

  if (!existing) {
    return { ok: false as const, error: "Program tidak ditemukan." };
  }

  const newIsActive = !existing.isActive;

  await db
    .update(programs)
    .set({ isActive: newIsActive, updatedAt: new Date() })
    .where(eq(programs.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: newIsActive ? "ACTIVATE_PROGRAM" : "ARCHIVE_PROGRAM",
    entitasType: "program",
    entitasId: id,
    detail: { name: existing.name, isActive: newIsActive },
  });

  revalidatePath("/jadwal-otomatis");
  revalidatePath("/jadwal-otomatis/master-data");
  return { ok: true as const, isActive: newIsActive };
}

const updateProgramFinanceContactSchema = z.object({
  programId: z.string().min(1),
  financeContactName: z.string().trim().max(200).optional().or(z.literal("")),
  financeWhatsappNumber: z.string().trim().max(30).optional().or(z.literal("")),
});

export async function updateProgramFinanceContact(input: unknown) {
  await requirePermission("jadwalPelatihan", "configure");

  const parsed = updateProgramFinanceContactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const updated = await db
    .update(programs)
    .set({
      financeContactName: parsed.data.financeContactName?.trim() || null,
      financeWhatsappNumber: parsed.data.financeWhatsappNumber?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(programs.id, parsed.data.programId))
    .returning({ id: programs.id });

  if (updated.length === 0) {
    return { ok: false as const, error: "Program tidak ditemukan." };
  }

  revalidatePath("/jadwal-otomatis");
  revalidatePath("/jadwal-otomatis/buat");
  return { ok: true as const };
}
