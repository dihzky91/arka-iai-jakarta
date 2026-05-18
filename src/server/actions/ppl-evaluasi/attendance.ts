"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { pplKegiatan } from "@/server/db/schema";
import { attendanceSchema } from "@/lib/validators/ppl-evaluasi";
import { requirePermission } from "@/server/actions/auth";
import type { ActionResult, AttendanceInput } from "./types";

// ─── UPDATE ATTENDANCE ───────────────────────────────────────────────────────

export async function updateAttendance(
  kegiatanId: number,
  data: AttendanceInput,
): Promise<ActionResult> {
  await requirePermission("pplEvaluasi", "manage");

  // Validate input
  const parsed = attendanceSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return {
      ok: false,
      error: firstError?.message ?? "Data tidak valid",
    };
  }

  const { pendaftar, realisasiHadir } = parsed.data;

  // Check if kegiatan exists and is not archived
  const [existing] = await db
    .select({ id: pplKegiatan.id, statusEvent: pplKegiatan.statusEvent })
    .from(pplKegiatan)
    .where(eq(pplKegiatan.id, kegiatanId))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Kegiatan tidak ditemukan" };
  }

  if (existing.statusEvent === "archived") {
    return {
      ok: false,
      error: "Kegiatan yang diarsipkan tidak dapat diubah",
    };
  }

  // Update pendaftar and realisasiHadir values
  await db
    .update(pplKegiatan)
    .set({
      pendaftar,
      realisasiHadir,
      updatedAt: new Date(),
    })
    .where(eq(pplKegiatan.id, kegiatanId));

  revalidatePath("/ppl-evaluasi");
  revalidatePath(`/ppl-evaluasi/${kegiatanId}`);
  return { ok: true };
}
