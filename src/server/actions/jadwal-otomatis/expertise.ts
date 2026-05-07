"use server";

import { eq, and, asc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/server/db";
import {
  instructors,
  instructorExpertise,
  instructorUnavailability,
  sessionAssignments,
  classSessions,
  curriculumTemplate,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";

// ─── EXPERTISE ─────────────────────────────────────────────────────────────

const expertiseCreateSchema = z.object({
  instructorId: z.string().min(1),
  programId: z.string().min(1),
  materiBlock: z.string().trim().min(1).max(100),
  level: z.enum(["basic", "middle", "senior"]).default("middle"),
});

export async function listExpertise(instructorId: string) {
  await requirePermission("jadwalPelatihan", "view");

  return db
    .select()
    .from(instructorExpertise)
    .where(eq(instructorExpertise.instructorId, instructorId))
    .orderBy(asc(instructorExpertise.materiBlock));
}

export async function addExpertise(data: z.infer<typeof expertiseCreateSchema>) {
  const parsed = expertiseCreateSchema.parse(data);
  await requirePermission("jadwalPelatihan", "manage");

  try {
    await db
      .insert(instructorExpertise)
      .values({
        id: nanoid(),
        instructorId: parsed.instructorId,
        programId: parsed.programId,
        materiBlock: parsed.materiBlock,
        level: parsed.level,
      })
      .onConflictDoNothing();
  } catch {
    // skip duplicate
  }

  revalidatePath("/jadwal-otomatis/instruktur");
  return { ok: true as const };
}

export async function removeExpertise(id: string) {
  await requirePermission("jadwalPelatihan", "manage");

  await db.delete(instructorExpertise).where(eq(instructorExpertise.id, id));

  revalidatePath("/jadwal-otomatis/instruktur");
  return { ok: true as const };
}

// ─── UNAVAILABILITY ────────────────────────────────────────────────────────

const unavailabilityCreateSchema = z.object({
  instructorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function listUnavailability(instructorId: string) {
  await requirePermission("jadwalPelatihan", "view");

  return db
    .select()
    .from(instructorUnavailability)
    .where(eq(instructorUnavailability.instructorId, instructorId))
    .orderBy(asc(instructorUnavailability.date));
}

export async function addUnavailability(data: z.infer<typeof unavailabilityCreateSchema>) {
  const parsed = unavailabilityCreateSchema.parse(data);
  await requirePermission("jadwalPelatihan", "manage");

  try {
    await db
      .insert(instructorUnavailability)
      .values({ id: nanoid(), instructorId: parsed.instructorId, date: parsed.date, reason: parsed.reason || null })
      .onConflictDoNothing();
  } catch {
    // skip duplicate
  }

  revalidatePath("/jadwal-otomatis/instruktur");
  return { ok: true as const };
}

export async function removeUnavailability(id: string) {
  await requirePermission("jadwalPelatihan", "manage");

  await db.delete(instructorUnavailability).where(eq(instructorUnavailability.id, id));

  revalidatePath("/jadwal-otomatis/instruktur");
  return { ok: true as const };
}

// ─── AUTO-SUGGEST INSTRUKTUR ───────────────────────────────────────────────

export async function suggestInstructors(programId: string, materiBlock: string, date: string) {
  await requirePermission("jadwalPelatihan", "view");

  const qualifiedRows = await db
    .select({ instructorId: instructorExpertise.instructorId })
    .from(instructorExpertise)
    .where(
      and(
        eq(instructorExpertise.programId, programId),
        eq(instructorExpertise.materiBlock, materiBlock),
      ),
    );
  const qualifiedIds = qualifiedRows.map((r) => r.instructorId);
  if (qualifiedIds.length === 0) return [];

  const unavailableRows = await db
    .select({ instructorId: instructorUnavailability.instructorId })
    .from(instructorUnavailability)
    .where(
      and(
        inArray(instructorUnavailability.instructorId, qualifiedIds),
        eq(instructorUnavailability.date, date),
      ),
    );
  const unavailableIds = unavailableRows.map((r) => r.instructorId);
  const availableIds = qualifiedIds.filter((id) => !unavailableIds.includes(id));
  if (availableIds.length === 0) return [];

  const conflictRows = await db
    .select({ instructorId: sessionAssignments.plannedInstructorId })
    .from(sessionAssignments)
    .innerJoin(classSessions, eq(sessionAssignments.sessionId, classSessions.id))
    .where(
      and(
        inArray(sessionAssignments.plannedInstructorId, availableIds),
        eq(classSessions.scheduledDate, date),
      ),
    );
  const conflictIds = conflictRows.map((r) => r.instructorId);
  const finalAvailableIds = availableIds.filter((id) => !conflictIds.includes(id));
  if (finalAvailableIds.length === 0) return [];

  return db
    .select()
    .from(instructors)
    .where(and(inArray(instructors.id, finalAvailableIds), eq(instructors.isActive, true)))
    .orderBy(asc(instructors.name));
}

// ─── MATERI BLOCKS FOR SUGGEST ──────────────────────────────────────────────

export async function getMateriBlocksByProgram(programId: string) {
  await requirePermission("jadwalPelatihan", "view");

  const rows = await db
    .select({ materiBlock: curriculumTemplate.materiBlock })
    .from(curriculumTemplate)
    .where(eq(curriculumTemplate.programId, programId))
    .groupBy(curriculumTemplate.materiBlock)
    .orderBy(asc(curriculumTemplate.materiBlock));

  return rows.map((r) => r.materiBlock);
}

export async function listProgramMateriBlocks() {
  await requirePermission("jadwalPelatihan", "view");

  return db
    .select({
      programId: curriculumTemplate.programId,
      materiBlock: curriculumTemplate.materiBlock,
    })
    .from(curriculumTemplate)
    .groupBy(curriculumTemplate.programId, curriculumTemplate.materiBlock)
    .orderBy(asc(curriculumTemplate.programId), asc(curriculumTemplate.materiBlock));
}
