"use server";

import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireCapability,
  requirePermission,
} from "@/server/actions/auth";
import { db } from "@/server/db";
import {
  honorariumAuditLogs,
  honorariumBatches,
  honorariumDeductions,
  instructors,
} from "@/server/db/schema";
import {
  addDeductionSchema,
  removeDeductionSchema,
  toNumber,
} from "./honorarium-utils";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type DeductionRow = {
  id: string;
  instructorId: string;
  instructorName: string;
  deductionType: string;
  description: string;
  amount: number;
  createdAt: Date;
};

// ─── FUNCTIONS ────────────────────────────────────────────────────────────────

export async function addHonorariumDeduction(
  data: z.infer<typeof addDeductionSchema>,
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = addDeductionSchema.parse(data);

  const [batch] = await db
    .select({ status: honorariumBatches.status })
    .from(honorariumBatches)
    .where(eq(honorariumBatches.id, parsed.batchId))
    .limit(1);

  if (!batch) throw new Error("Batch tidak ditemukan.");
  if (batch.status !== "draft")
    throw new Error("Potongan hanya bisa ditambahkan saat batch status draft.");

  const id = nanoid();
  await db.insert(honorariumDeductions).values({
    id,
    batchId: parsed.batchId,
    instructorId: parsed.instructorId,
    deductionType: parsed.deductionType,
    description: parsed.description,
    amount: parsed.amount.toFixed(2),
  });

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId: parsed.batchId,
    actorId: session.user.id,
    action: "deduction_added",
    payload: {
      deductionId: id,
      instructorId: parsed.instructorId,
      type: parsed.deductionType,
      amount: parsed.amount,
    },
  });

  revalidatePath(`/jadwal-otomatis/honorarium/${parsed.batchId}`);
  return { ok: true as const, deductionId: id };
}

export async function removeHonorariumDeduction(
  data: z.infer<typeof removeDeductionSchema>,
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = removeDeductionSchema.parse(data);

  const [deduction] = await db
    .select({
      id: honorariumDeductions.id,
      batchId: honorariumDeductions.batchId,
    })
    .from(honorariumDeductions)
    .where(eq(honorariumDeductions.id, parsed.deductionId))
    .limit(1);

  if (!deduction) throw new Error("Potongan tidak ditemukan.");

  const [batch] = await db
    .select({ status: honorariumBatches.status })
    .from(honorariumBatches)
    .where(eq(honorariumBatches.id, deduction.batchId))
    .limit(1);

  if (!batch || batch.status !== "draft")
    throw new Error("Potongan hanya bisa dihapus saat batch status draft.");

  await db
    .delete(honorariumDeductions)
    .where(eq(honorariumDeductions.id, parsed.deductionId));

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId: deduction.batchId,
    actorId: session.user.id,
    action: "deduction_removed",
    payload: { deductionId: parsed.deductionId },
  });

  revalidatePath(`/jadwal-otomatis/honorarium/${deduction.batchId}`);
  return { ok: true as const };
}

export async function listHonorariumDeductions(
  batchId: string,
): Promise<DeductionRow[]> {
  await requirePermission("jadwalPelatihan", "view").catch(() =>
    requireCapability("keuangan:view"),
  );

  const rows = await db
    .select({
      id: honorariumDeductions.id,
      instructorId: honorariumDeductions.instructorId,
      instructorName: instructors.name,
      deductionType: honorariumDeductions.deductionType,
      description: honorariumDeductions.description,
      amount: honorariumDeductions.amount,
      createdAt: honorariumDeductions.createdAt,
    })
    .from(honorariumDeductions)
    .innerJoin(
      instructors,
      eq(honorariumDeductions.instructorId, instructors.id),
    )
    .where(eq(honorariumDeductions.batchId, batchId))
    .orderBy(asc(honorariumDeductions.createdAt));

  return rows.map((row) => ({
    ...row,
    amount: toNumber(row.amount),
  }));
}
