"use server";

import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  nilaiUjian,
  pesertaKelas,
  jadwalUjian,
  kelasUjian,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { recomputeStatusPeserta } from "./recompute-status";

interface NilaiInput {
  pesertaId: string;
  mataPelajaran: string;
  nilai: "A" | "B" | "C" | "D";
}

async function getKelasPelatihanIdFromJadwal(jadwalUjianId: string) {
  const jadwal = await db.query.jadwalUjian.findFirst({
    where: eq(jadwalUjian.id, jadwalUjianId),
  });
  if (!jadwal) return null;
  const ku = await db.query.kelasUjian.findFirst({
    where: eq(kelasUjian.id, jadwal.kelasId),
  });
  return ku?.kelasPelatihanId ?? null;
}

export async function inputNilaiUjian(
  jadwalUjianId: string,
  nilaiList: NilaiInput[],
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const userId = session.user.id;

  await db.transaction(async (tx) => {
    for (const n of nilaiList) {
      await tx
        .insert(nilaiUjian)
        .values({
          pesertaId: n.pesertaId,
          jadwalUjianId,
          mataPelajaran: n.mataPelajaran,
          nilai: n.nilai,
          isPerbaikan: false,
          inputBy: userId,
        })
        .onConflictDoUpdate({
          target: [
            nilaiUjian.pesertaId,
            nilaiUjian.jadwalUjianId,
            nilaiUjian.mataPelajaran,
            nilaiUjian.isPerbaikan,
          ],
          set: {
            nilai: n.nilai,
            inputBy: userId,
            updatedAt: new Date(),
          },
        });
    }
  });

  const pesertaIds = [...new Set(nilaiList.map((n) => n.pesertaId))];
  for (const pid of pesertaIds) {
    try {
      await recomputeStatusPeserta(pid);
    } catch (e) {
      console.error("recomputeStatusPeserta failed for", pid, e);
    }
  }

  const kelasPelatihanId = await getKelasPelatihanIdFromJadwal(jadwalUjianId);
  if (kelasPelatihanId) {
    revalidatePath(`/jadwal-otomatis/${kelasPelatihanId}`);
  }

  return { ok: true as const };
}

export async function inputNilaiPerbaikan(
  pesertaId: string,
  jadwalUjianId: string,
  mataPelajaran: string,
  nilaiBaru: "A" | "B" | "C",
  perbaikanDariId: string,
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const userId = session.user.id;

  const inserted = await db
    .insert(nilaiUjian)
    .values({
      pesertaId,
      jadwalUjianId,
      mataPelajaran,
      nilai: nilaiBaru,
      isPerbaikan: true,
      perbaikanDariId,
      inputBy: userId,
    })
    .onConflictDoUpdate({
      target: [
        nilaiUjian.pesertaId,
        nilaiUjian.jadwalUjianId,
        nilaiUjian.mataPelajaran,
        nilaiUjian.isPerbaikan,
      ],
      set: {
        nilai: nilaiBaru,
        perbaikanDariId,
        inputBy: userId,
        updatedAt: new Date(),
      },
    })
    .returning();

  try {
    await recomputeStatusPeserta(pesertaId);
  } catch (e) {
    console.error("recomputeStatusPeserta failed for", pesertaId, e);
  }

  const kelasPelatihanId = await getKelasPelatihanIdFromJadwal(jadwalUjianId);
  if (kelasPelatihanId) {
    revalidatePath(`/jadwal-otomatis/${kelasPelatihanId}`);
  }

  return { ok: true as const, data: inserted[0] };
}

export async function getNilaiByKelas(kelasId: string) {
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
    return { pesertaList: [], ujianList, nilaiList: [] };
  }

  const nilaiList = await db.query.nilaiUjian.findMany({
    where: inArray(
      nilaiUjian.pesertaId,
      pesertaList.map((p) => p.id)
    ),
  });

  return { pesertaList, ujianList, nilaiList };
}
