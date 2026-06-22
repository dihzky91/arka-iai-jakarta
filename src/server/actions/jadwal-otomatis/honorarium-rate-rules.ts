"use server";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/actions/auth";
import { db } from "@/server/db";
import {
  honorariumRateRules,
  instructorRates,
  programs,
} from "@/server/db/schema";
import {
  toNumber,
  normalizeMode,
  upsertRateSchema,
  upsertRateRuleSchema,
} from "./honorarium-utils";

export async function listInstructorRates(instructorId: string) {
  await requirePermission("jadwalPelatihan", "view");

  if (!instructorId) return [];

  return db
    .select({
      id: instructorRates.id,
      instructorId: instructorRates.instructorId,
      programId: instructorRates.programId,
      programName: programs.name,
      materiBlock: instructorRates.materiBlock,
      mode: instructorRates.mode,
      rateAmount: instructorRates.rateAmount,
      updatedAt: instructorRates.updatedAt,
    })
    .from(instructorRates)
    .innerJoin(programs, eq(instructorRates.programId, programs.id))
    .where(eq(instructorRates.instructorId, instructorId))
    .orderBy(
      asc(programs.name),
      asc(instructorRates.materiBlock),
      asc(instructorRates.mode),
    );
}

export async function upsertInstructorRate(
  data: z.infer<typeof upsertRateSchema>,
) {
  await requirePermission("jadwalPelatihan", "manage");
  const parsed = upsertRateSchema.parse(data);

  const existing = await db
    .select({ id: instructorRates.id })
    .from(instructorRates)
    .where(
      and(
        eq(instructorRates.instructorId, parsed.instructorId),
        eq(instructorRates.programId, parsed.programId),
        eq(instructorRates.materiBlock, parsed.materiBlock),
        eq(instructorRates.mode, parsed.mode),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(instructorRates)
      .set({
        rateAmount: parsed.rateAmount.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(instructorRates.id, existing[0].id));
  } else {
    await db.insert(instructorRates).values({
      id: nanoid(),
      instructorId: parsed.instructorId,
      programId: parsed.programId,
      materiBlock: parsed.materiBlock,
      mode: parsed.mode,
      rateAmount: parsed.rateAmount.toFixed(2),
    });
  }

  revalidatePath("/jadwal-otomatis/instruktur");
  return { ok: true as const };
}

export async function removeInstructorRate(id: string) {
  await requirePermission("jadwalPelatihan", "manage");

  await db.delete(instructorRates).where(eq(instructorRates.id, id));

  revalidatePath("/jadwal-otomatis/instruktur");
  return { ok: true as const };
}

export async function listHonorariumRateRules(programId?: string) {
  await requirePermission("jadwalPelatihan", "view");

  const rows = await db
    .select({
      id: honorariumRateRules.id,
      programId: honorariumRateRules.programId,
      programName: programs.name,
      level: honorariumRateRules.level,
      mode: honorariumRateRules.mode,
      honorPerSession: honorariumRateRules.honorPerSession,
      transportAmount: honorariumRateRules.transportAmount,
      effectiveFrom: honorariumRateRules.effectiveFrom,
      effectiveTo: honorariumRateRules.effectiveTo,
      locationScope: honorariumRateRules.locationScope,
      isActive: honorariumRateRules.isActive,
      notes: honorariumRateRules.notes,
      updatedAt: honorariumRateRules.updatedAt,
    })
    .from(honorariumRateRules)
    .innerJoin(programs, eq(honorariumRateRules.programId, programs.id))
    .where(
      programId
        ? and(
            eq(honorariumRateRules.programId, programId),
            eq(honorariumRateRules.isActive, true),
          )
        : eq(honorariumRateRules.isActive, true),
    )
    .orderBy(
      asc(programs.name),
      asc(honorariumRateRules.level),
      asc(honorariumRateRules.mode),
      desc(honorariumRateRules.effectiveFrom),
    );

  return rows.map((row) => ({
    ...row,
    honorPerSession: toNumber(row.honorPerSession),
    transportAmount: toNumber(row.transportAmount),
  }));
}

export async function upsertHonorariumRateRule(
  data: z.infer<typeof upsertRateRuleSchema>,
) {
  await requirePermission("jadwalPelatihan", "manage");
  const parsed = upsertRateRuleSchema.parse(data);

  if (parsed.effectiveTo && parsed.effectiveTo < parsed.effectiveFrom) {
    throw new Error("effective_to harus >= effective_from.");
  }

  if (parsed.id) {
    await db
      .update(honorariumRateRules)
      .set({
        programId: parsed.programId,
        level: parsed.level,
        mode: parsed.mode,
        honorPerSession: parsed.honorPerSession.toFixed(2),
        transportAmount: parsed.transportAmount.toFixed(2),
        effectiveFrom: parsed.effectiveFrom,
        effectiveTo: parsed.effectiveTo || null,
        locationScope: parsed.locationScope || "",
        notes: parsed.notes || null,
        isActive: parsed.isActive,
        updatedAt: new Date(),
      })
      .where(eq(honorariumRateRules.id, parsed.id));
  } else {
    await db.insert(honorariumRateRules).values({
      id: nanoid(),
      programId: parsed.programId,
      level: parsed.level,
      mode: parsed.mode,
      honorPerSession: parsed.honorPerSession.toFixed(2),
      transportAmount: parsed.transportAmount.toFixed(2),
      effectiveFrom: parsed.effectiveFrom,
      effectiveTo: parsed.effectiveTo || null,
      locationScope: parsed.locationScope || "",
      notes: parsed.notes || null,
      isActive: parsed.isActive,
    });
  }

  revalidatePath("/jadwal-otomatis/honorarium");
  return { ok: true as const };
}

export async function removeHonorariumRateRule(id: string) {
  await requirePermission("jadwalPelatihan", "manage");

  await db
    .update(honorariumRateRules)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(honorariumRateRules.id, id));

  revalidatePath("/jadwal-otomatis/honorarium");
  return { ok: true as const };
}
