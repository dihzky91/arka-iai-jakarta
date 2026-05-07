"use server";

import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  ujianSusulanPeserta,
  absensiUjian,
  pesertaKelas,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";

interface AjukanSusulanData {
  pesertaId: string;
  jadwalUjianOriginalId: string;
  tanggalUsulan?: string;
  alasanPermohonan?: string;
}

async function getKelasIdFromPeserta(pesertaId: string) {
  const peserta = await db.query.pesertaKelas.findFirst({
    where: eq(pesertaKelas.id, pesertaId),
  });
  return peserta?.kelasId ?? null;
}

export async function ajukanUjianSusulan(data: AjukanSusulanData) {
  await requirePermission("jadwalPelatihan", "manage");

  if (data.tanggalUsulan && !/^\d{4}-\d{2}-\d{2}$/.test(data.tanggalUsulan)) {
    return { ok: false as const, error: "Format tanggal tidak valid. Gunakan YYYY-MM-DD." };
  }

  const inserted = await db
    .insert(ujianSusulanPeserta)
    .values({
      pesertaId: data.pesertaId,
      jadwalUjianOriginalId: data.jadwalUjianOriginalId,
      tanggalUsulan: data.tanggalUsulan ?? null,
      alasanPermohonan: data.alasanPermohonan ?? null,
      status: "pending",
    })
    .returning();

  await db
    .update(absensiUjian)
    .set({ status: "susulan", updatedAt: new Date() })
    .where(
      and(
        eq(absensiUjian.pesertaId, data.pesertaId),
        eq(absensiUjian.jadwalUjianId, data.jadwalUjianOriginalId)
      )
    );

  const kelasId = await getKelasIdFromPeserta(data.pesertaId);
  if (kelasId) revalidatePath(`/jadwal-otomatis/${kelasId}`);

  return { ok: true as const, data: inserted[0] };
}

export async function approveUjianSusulan(
  susulanId: string,
  tanggalDisepakati: string,
  jamMulai?: string,
  jamSelesai?: string,
) {
  const session = await requirePermission("jadwalPelatihan", "manage");

  const updated = await db
    .update(ujianSusulanPeserta)
    .set({
      status: "disetujui",
      tanggalDisepakati,
      jamMulai: jamMulai ?? null,
      jamSelesai: jamSelesai ?? null,
      approvedBy: session.user.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(ujianSusulanPeserta.id, susulanId),
        eq(ujianSusulanPeserta.status, "pending")
      )
    )
    .returning();

  if (updated.length === 0) {
    return { ok: false as const, error: "Permohonan tidak ditemukan atau status bukan 'pending'." };
  }

  const kelasId = await getKelasIdFromPeserta(updated[0]!.pesertaId);
  if (kelasId) revalidatePath(`/jadwal-otomatis/${kelasId}`);

  return { ok: true as const, data: updated[0]! };
}

export async function selesaikanUjianSusulan(susulanId: string) {
  await requirePermission("jadwalPelatihan", "manage");

  const updated = await db
    .update(ujianSusulanPeserta)
    .set({ status: "selesai", updatedAt: new Date() })
    .where(
      and(
        eq(ujianSusulanPeserta.id, susulanId),
        eq(ujianSusulanPeserta.status, "disetujui")
      )
    )
    .returning();

  if (updated.length === 0) {
    return { ok: false as const, error: "Permohonan tidak ditemukan atau belum disetujui." };
  }

  const kelasId = await getKelasIdFromPeserta(updated[0]!.pesertaId);
  if (kelasId) revalidatePath(`/jadwal-otomatis/${kelasId}`);

  return { ok: true as const, data: updated[0]! };
}

export async function batalkanUjianSusulan(susulanId: string) {
  await requirePermission("jadwalPelatihan", "manage");

  const updated = await db
    .update(ujianSusulanPeserta)
    .set({ status: "dibatalkan", updatedAt: new Date() })
    .where(
      and(
        eq(ujianSusulanPeserta.id, susulanId),
        inArray(ujianSusulanPeserta.status, ["pending", "disetujui"])
      )
    )
    .returning();

  if (updated.length === 0) {
    return { ok: false as const, error: "Permohonan tidak ditemukan atau sudah selesai/dibatalkan." };
  }

  const kelasId = await getKelasIdFromPeserta(updated[0]!.pesertaId);
  if (kelasId) revalidatePath(`/jadwal-otomatis/${kelasId}`);

  return { ok: true as const, data: updated[0]! };
}

export async function getUjianSusulanByPeserta(pesertaId: string) {
  await requirePermission("jadwalPelatihan", "view");

  return db.query.ujianSusulanPeserta.findMany({
    where: eq(ujianSusulanPeserta.pesertaId, pesertaId),
    orderBy: (usp, { desc }) => [desc(usp.createdAt)],
  });
}

export async function listUjianSusulanPending() {
  await requirePermission("jadwalPelatihan", "manage");

  return db.query.ujianSusulanPeserta.findMany({
    where: eq(ujianSusulanPeserta.status, "pending"),
    orderBy: (usp, { desc }) => [desc(usp.createdAt)],
  });
}
