"use server";

import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  absensiUjian,
  pesertaKelas,
  jadwalUjian,
  kelasUjian,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { recomputeStatusPeserta } from "./recompute-status";

interface AbsensiUjianInput {
  pesertaId: string;
  status: "hadir" | "tidak_hadir" | "susulan";
  catatan?: string;
}

export async function inputAbsensiUjian(
  jadwalUjianId: string,
  absensiList: AbsensiUjianInput[],
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const userId = session.user.id;

  const jadwal = await db.query.jadwalUjian.findFirst({
    where: eq(jadwalUjian.id, jadwalUjianId),
  });
  if (!jadwal) {
    return { ok: false as const, error: "Jadwal ujian tidak ditemukan." };
  }

  await db.transaction(async (tx) => {
    for (const a of absensiList) {
      await tx
        .insert(absensiUjian)
        .values({
          pesertaId: a.pesertaId,
          jadwalUjianId,
          status: a.status,
          catatan: a.catatan ?? null,
          inputBy: userId,
        })
        .onConflictDoUpdate({
          target: [absensiUjian.pesertaId, absensiUjian.jadwalUjianId],
          set: {
            status: a.status,
            catatan: a.catatan,
            inputBy: userId,
            updatedAt: new Date(),
          },
        });
    }
  });

  const pesertaIds = absensiList.map((a) => a.pesertaId);
  for (const pid of pesertaIds) {
    try {
      await recomputeStatusPeserta(pid);
    } catch (e) {
      console.error("recomputeStatusPeserta failed for", pid, e);
    }
  }

  const kelasUjianRow = await db.query.kelasUjian.findFirst({
    where: eq(kelasUjian.id, jadwal.kelasId),
  });
  if (kelasUjianRow?.kelasPelatihanId) {
    revalidatePath(`/jadwal-otomatis/${kelasUjianRow.kelasPelatihanId}`);
  }

  return { ok: true as const };
}

export async function getAbsensiUjianByKelas(kelasId: string) {
  await requirePermission("jadwalPelatihan", "view");

  const pesertaList = await db.query.pesertaKelas.findMany({
    where: and(
      eq(pesertaKelas.kelasId, kelasId),
      eq(pesertaKelas.statusEnrollment, "aktif")
    ),
    orderBy: (pk, { asc }) => [asc(pk.nama)],
  });

  const kelasUjianRow = await db.query.kelasUjian.findFirst({
    where: eq(kelasUjian.kelasPelatihanId, kelasId),
  });

  const ujianList = kelasUjianRow
    ? await db.query.jadwalUjian.findMany({
        where: eq(jadwalUjian.kelasId, kelasUjianRow.id),
        orderBy: (ju, { asc }) => [asc(ju.tanggalUjian)],
      })
    : [];

  if (pesertaList.length === 0) {
    return { pesertaList: [], ujianList, absensiList: [] };
  }

  const absensiList = await db.query.absensiUjian.findMany({
    where: inArray(
      absensiUjian.pesertaId,
      pesertaList.map((p) => p.id)
    ),
  });

  return { pesertaList, ujianList, absensiList };
}
