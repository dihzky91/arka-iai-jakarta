"use server";

import { eq, and, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  pesertaKelas,
  absensiPelatihan,
  nilaiUjian,
  kelasPelatihan,
  classSessions,
  jadwalUjian,
  kelasUjian,
} from "@/server/db/schema";

export async function recomputeStatusPeserta(pesertaId: string) {
  const peserta = await db.query.pesertaKelas.findFirst({
    where: eq(pesertaKelas.id, pesertaId),
  });
  if (!peserta) return;

  const kelas = await db.query.kelasPelatihan.findFirst({
    where: eq(kelasPelatihan.id, peserta.kelasId),
  });
  if (!kelas) return;

  const totalSesi = await db
    .select({ count: sql<number>`count(*)` })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.kelasId, kelas.id),
        eq(classSessions.isExamDay, false),
        sql`${classSessions.status} != 'cancelled'`
      )
    )
    .then((r) => Number(r[0]?.count ?? 0));

  // No sessions yet — leave status as null (dalam_proses)
  if (totalSesi === 0) {
    await db
      .update(pesertaKelas)
      .set({
        statusAkhir: null,
        alasanStatus: null,
        statusComputedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pesertaKelas.id, pesertaId));
    return;
  }

  const hadirSesi = await db
    .select({ count: sql<number>`count(*)` })
    .from(absensiPelatihan)
    .innerJoin(classSessions, eq(classSessions.id, absensiPelatihan.sessionId))
    .where(
      and(
        eq(absensiPelatihan.pesertaId, pesertaId),
        eq(absensiPelatihan.hadir, true),
        eq(classSessions.kelasId, kelas.id),
        eq(classSessions.isExamDay, false),
        sql`${classSessions.status} != 'cancelled'`
      )
    )
    .then((r) => Number(r[0]?.count ?? 0));

  const pctKehadiran = (hadirSesi / totalSesi) * 100;

  if (pctKehadiran < 60) {
    await db
      .update(pesertaKelas)
      .set({
        statusAkhir: "telah_mengikuti",
        alasanStatus: "kehadiran",
        statusComputedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pesertaKelas.id, pesertaId));
    return;
  }

  const allNilaiD = await db.query.nilaiUjian.findMany({
    where: and(
      eq(nilaiUjian.pesertaId, pesertaId),
      eq(nilaiUjian.nilai, "D"),
      eq(nilaiUjian.isPerbaikan, false)
    ),
  });

  for (const nd of allNilaiD) {
    const perbaikan = await db.query.nilaiUjian.findFirst({
      where: and(
        eq(nilaiUjian.pesertaId, pesertaId),
        eq(nilaiUjian.mataPelajaran, nd.mataPelajaran),
        eq(nilaiUjian.isPerbaikan, true),
        eq(nilaiUjian.perbaikanDariId, nd.id),
        sql`${nilaiUjian.nilai} IN ('A', 'B', 'C')`
      ),
    });

    if (!perbaikan) {
      await db
        .update(pesertaKelas)
        .set({
          statusAkhir: "telah_mengikuti",
          alasanStatus: "nilai",
          statusComputedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pesertaKelas.id, pesertaId));
      return;
    }
  }

  const kelasUjianRow = await db.query.kelasUjian.findFirst({
    where: eq(kelasUjian.kelasPelatihanId, kelas.id),
  });

  const allJadwalUjian = kelasUjianRow
    ? await db.query.jadwalUjian.findMany({
        where: eq(jadwalUjian.kelasId, kelasUjianRow.id),
      })
    : [];

  for (const ju of allJadwalUjian) {
    const mapelList = ju.mataPelajaran as string[] | null;
    if (!mapelList || mapelList.length === 0) continue;

    for (const mapel of mapelList) {
      const existingNilai = await db.query.nilaiUjian.findFirst({
        where: and(
          eq(nilaiUjian.pesertaId, pesertaId),
          eq(nilaiUjian.jadwalUjianId, ju.id),
          eq(nilaiUjian.mataPelajaran, mapel),
          eq(nilaiUjian.isPerbaikan, false)
        ),
      });

      if (!existingNilai) {
        await db
          .update(pesertaKelas)
          .set({
            statusAkhir: null,
            alasanStatus: null,
            statusComputedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(pesertaKelas.id, pesertaId));
        return;
      }
    }
  }

  await db
    .update(pesertaKelas)
    .set({
      statusAkhir: "lulus",
      alasanStatus: null,
      statusComputedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pesertaKelas.id, pesertaId));
}

export async function recomputeStatusPesertaByKelas(kelasId: string) {
  const pesertaList = await db.query.pesertaKelas.findMany({
    where: and(
      eq(pesertaKelas.kelasId, kelasId),
      eq(pesertaKelas.statusEnrollment, "aktif")
    ),
    columns: { id: true },
  });

  for (const peserta of pesertaList) {
    try {
      await recomputeStatusPeserta(peserta.id);
    } catch (e) {
      console.error("recomputeStatusPeserta failed for", peserta.id, e);
    }
  }
}
