"use server";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { programs } from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";

export async function listPrograms() {
  await requireSession();
  return db.select().from(programs).where(eq(programs.isActive, true)).orderBy(asc(programs.name));
}

export async function getProgram(id: string) {
  await requireSession();
  const rows = await db.select().from(programs).where(eq(programs.id, id));
  return rows[0] ?? null;
}

const updateProgramFinanceContactSchema = z.object({
  programId: z.string().min(1),
  financeContactName: z.string().trim().max(200).optional().or(z.literal("")),
  financeWhatsappNumber: z.string().trim().max(30).optional().or(z.literal("")),
});

export async function updateProgramFinanceContact(input: unknown) {
  await requirePermission("jadwalUjian", "configure");

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
