"use server";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { curriculumTemplate, curriculumExamPoints } from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { writeAuditLog } from "@/server/lib/audit";

export async function getCurriculumByProgram(programId: string) {
  await requirePermission("jadwalPelatihan", "view");

  const template = await db
    .select()
    .from(curriculumTemplate)
    .where(eq(curriculumTemplate.programId, programId))
    .orderBy(asc(curriculumTemplate.sessionNumber));

  const examPoints = await db
    .select()
    .from(curriculumExamPoints)
    .where(eq(curriculumExamPoints.programId, programId))
    .orderBy(asc(curriculumExamPoints.afterSessionNumber));

  return { template, examPoints };
}

const upsertCurriculumTemplateSchema = z.object({
  programId: z.string().min(1),
  items: z.array(
    z.object({
      sessionNumber: z.number().int().min(1),
      materiBlock: z.string().trim().min(1).max(100),
      materiName: z.string().trim().min(1).max(200),
      slot: z.number().int().min(1).max(2),
    }),
  ),
});

export async function upsertCurriculumTemplate(input: unknown) {
  const session = await requirePermission("jadwalPelatihan", "manage");

  const parsed = upsertCurriculumTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  await db
    .delete(curriculumTemplate)
    .where(eq(curriculumTemplate.programId, parsed.data.programId));

  if (parsed.data.items.length > 0) {
    await db.insert(curriculumTemplate).values(
      parsed.data.items.map((item) => ({
        id: nanoid(),
        programId: parsed.data.programId,
        sessionNumber: item.sessionNumber,
        materiBlock: item.materiBlock,
        materiName: item.materiName,
        slot: item.slot,
      })),
    );
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPSERT_CURRICULUM_TEMPLATE",
    entitasType: "program",
    entitasId: parsed.data.programId,
    detail: { itemCount: parsed.data.items.length },
  });

  revalidatePath("/jadwal-otomatis/master-data");
  return { ok: true as const };
}

const upsertCurriculumExamPointsSchema = z.object({
  programId: z.string().min(1),
  items: z.array(
    z.object({
      afterSessionNumber: z.number().int().min(1),
      isMixedDay: z.boolean().default(false),
      examSlotCount: z.number().int().min(1).max(2),
      examSubjects: z.array(z.string().trim().min(1)),
      hasExam: z.boolean().default(true),
    }),
  ),
});

export async function upsertCurriculumExamPoints(input: unknown) {
  const session = await requirePermission("jadwalPelatihan", "manage");

  const parsed = upsertCurriculumExamPointsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  await db
    .delete(curriculumExamPoints)
    .where(eq(curriculumExamPoints.programId, parsed.data.programId));

  if (parsed.data.items.length > 0) {
    await db.insert(curriculumExamPoints).values(
      parsed.data.items.map((item) => ({
        id: nanoid(),
        programId: parsed.data.programId,
        afterSessionNumber: item.afterSessionNumber,
        isMixedDay: item.isMixedDay,
        examSlotCount: item.examSlotCount,
        examSubjects: item.examSubjects,
        hasExam: item.hasExam,
      })),
    );
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPSERT_CURRICULUM_EXAM_POINTS",
    entitasType: "program",
    entitasId: parsed.data.programId,
    detail: { itemCount: parsed.data.items.length },
  });

  revalidatePath("/jadwal-otomatis/master-data");
  return { ok: true as const };
}
