"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  auditLog,
  pejabatPenandatangan,
  suratKeluar,
  suratKeputusan,
  suratMou,
  users,
} from "@/server/db/schema";
import {
  pejabatCreateSchema,
  pejabatDeleteSchema,
  pejabatUpdateSchema,
} from "@/lib/validators/pejabat.schema";
import { requirePermission, requireSession } from "./auth";

export type PejabatRow = {
  id: number;
  userId: string | null;
  namaJabatan: string;
  wilayah: string | null;
  ttdUrl: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
  userNama: string | null;
  userEmail: string | null;
};

export async function listPejabat(): Promise<PejabatRow[]> {
  await requireSession();
  return db
    .select({
      id: pejabatPenandatangan.id,
      userId: pejabatPenandatangan.userId,
      namaJabatan: pejabatPenandatangan.namaJabatan,
      wilayah: pejabatPenandatangan.wilayah,
      ttdUrl: pejabatPenandatangan.ttdUrl,
      isActive: pejabatPenandatangan.isActive,
      createdAt: pejabatPenandatangan.createdAt,
      userNama: users.namaLengkap,
      userEmail: users.email,
    })
    .from(pejabatPenandatangan)
    .leftJoin(users, eq(pejabatPenandatangan.userId, users.id))
    .orderBy(desc(pejabatPenandatangan.isActive), desc(pejabatPenandatangan.createdAt));
}

export async function createPejabat(data: unknown) {
  const parsed = pejabatCreateSchema.parse(data);
  const session = await requirePermission("pejabat", "create");

  const [row] = await db
    .insert(pejabatPenandatangan)
    .values({
      userId: parsed.userId,
      namaJabatan: parsed.namaJabatan,
      wilayah: parsed.wilayah || null,
      ttdUrl: parsed.ttdUrl || null,
      isActive: parsed.isActive ?? true,
    })
    .returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_PEJABAT_PENANDATANGAN",
    entitasType: "pejabat_penandatangan",
    entitasId: String(row!.id),
    detail: { namaJabatan: parsed.namaJabatan },
  });

  revalidatePath("/pejabat");
  revalidatePath("/surat-keluar");
  return { ok: true as const, data: row! };
}

export async function updatePejabat(data: unknown) {
  const parsed = pejabatUpdateSchema.parse(data);
  const session = await requirePermission("pejabat", "update");

  const [row] = await db
    .update(pejabatPenandatangan)
    .set({
      userId: parsed.userId,
      namaJabatan: parsed.namaJabatan,
      wilayah: parsed.wilayah || null,
      ttdUrl: parsed.ttdUrl || null,
      isActive: parsed.isActive ?? true,
    })
    .where(eq(pejabatPenandatangan.id, parsed.id))
    .returning();

  if (!row) {
    return { ok: false as const, error: "Data pejabat tidak ditemukan." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PEJABAT_PENANDATANGAN",
    entitasType: "pejabat_penandatangan",
    entitasId: String(parsed.id),
    detail: { namaJabatan: parsed.namaJabatan },
  });

  revalidatePath("/pejabat");
  revalidatePath("/surat-keluar");
  return { ok: true as const, data: row };
}

export async function deletePejabat(data: unknown) {
  const parsed = pejabatDeleteSchema.parse(data);
  const session = await requirePermission("pejabat", "delete");

  const [existing] = await db
    .select({
      id: pejabatPenandatangan.id,
      namaJabatan: pejabatPenandatangan.namaJabatan,
    })
    .from(pejabatPenandatangan)
    .where(eq(pejabatPenandatangan.id, parsed.id));

  if (!existing) {
    return { ok: false as const, error: "Data pejabat tidak ditemukan." };
  }

  const [usedInSuratKeluar] = await db
    .select({ id: suratKeluar.id })
    .from(suratKeluar)
    .where(eq(suratKeluar.pejabatId, parsed.id))
    .limit(1);
  const [usedInSk] = await db
    .select({ id: suratKeputusan.id })
    .from(suratKeputusan)
    .where(eq(suratKeputusan.pejabatId, parsed.id))
    .limit(1);
  const [usedInMou] = await db
    .select({ id: suratMou.id })
    .from(suratMou)
    .where(eq(suratMou.pejabatId, parsed.id))
    .limit(1);

  if (usedInSuratKeluar || usedInSk || usedInMou) {
    return {
      ok: false as const,
      error: "Pejabat masih dipakai pada dokumen. Nonaktifkan jika tidak ingin digunakan lagi.",
    };
  }

  await db
    .delete(pejabatPenandatangan)
    .where(eq(pejabatPenandatangan.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_PEJABAT_PENANDATANGAN",
    entitasType: "pejabat_penandatangan",
    entitasId: String(parsed.id),
    detail: { namaJabatan: existing.namaJabatan },
  });

  revalidatePath("/pejabat");
  revalidatePath("/surat-keluar");
  return { ok: true as const };
}
