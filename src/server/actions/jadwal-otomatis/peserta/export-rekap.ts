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
import { requirePermission } from "@/server/actions/auth";

export interface RekapRow {
  nama: string;
  nomorPeserta: string | null;
  persentaseHadir: number;
  totalSesi: number;
  hadirSesi: number;
  nilaiPerMapel: { mapel: string; nilai: string }[];
  statusAkhir: string | null;
  alasanStatus: string | null;
}

export async function exportRekapKelas(kelasId: string): Promise<{ ok: false; error: string } | { ok: true; data: RekapRow[] }> {
  await requirePermission("jadwalPelatihan", "view");

  const kelas = await db.query.kelasPelatihan.findFirst({
    where: eq(kelasPelatihan.id, kelasId),
  });
  if (!kelas) return { ok: false, error: "Kelas tidak ditemukan." };

  const pesertaList = await db.query.pesertaKelas.findMany({
    where: and(
      eq(pesertaKelas.kelasId, kelasId),
      eq(pesertaKelas.statusEnrollment, "aktif")
    ),
    orderBy: (pk, { asc }) => [asc(pk.nama)],
  });

  const totalSesi = await db
    .select({ count: sql<number>`count(*)` })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.kelasId, kelasId),
        eq(classSessions.isExamDay, false),
        sql`${classSessions.status} != 'cancelled'`
      )
    )
    .then((r) => Number(r[0]?.count ?? 0));

  const kelasUjianRow = await db.query.kelasUjian.findFirst({
    where: eq(kelasUjian.kelasPelatihanId, kelasId),
  });

  const allJadwalUjian = kelasUjianRow
    ? await db.query.jadwalUjian.findMany({
        where: eq(jadwalUjian.kelasId, kelasUjianRow.id),
      })
    : [];

  const result: RekapRow[] = [];

  for (const peserta of pesertaList) {
    const hadirSesi = await db
      .select({ count: sql<number>`count(*)` })
      .from(absensiPelatihan)
      .innerJoin(classSessions, eq(classSessions.id, absensiPelatihan.sessionId))
      .where(
        and(
          eq(absensiPelatihan.pesertaId, peserta.id),
          eq(absensiPelatihan.hadir, true),
          eq(classSessions.kelasId, kelasId),
          eq(classSessions.isExamDay, false),
          sql`${classSessions.status} != 'cancelled'`
        )
      )
      .then((r) => Number(r[0]?.count ?? 0));

    const pct = totalSesi > 0 ? Math.round((hadirSesi / totalSesi) * 100) : 0;

    const nilaiPerMapel: { mapel: string; nilai: string }[] = [];
    for (const ju of allJadwalUjian) {
      const mapelList = ju.mataPelajaran as string[] | null;
      if (!mapelList) continue;
      for (const mapel of mapelList) {
        const n = await db.query.nilaiUjian.findFirst({
          where: and(
            eq(nilaiUjian.pesertaId, peserta.id),
            eq(nilaiUjian.jadwalUjianId, ju.id),
            eq(nilaiUjian.mataPelajaran, mapel),
            eq(nilaiUjian.isPerbaikan, false)
          ),
        });
        if (n) {
          const perbaikan = await db.query.nilaiUjian.findFirst({
            where: and(
              eq(nilaiUjian.pesertaId, peserta.id),
              eq(nilaiUjian.mataPelajaran, mapel),
              eq(nilaiUjian.isPerbaikan, true),
              eq(nilaiUjian.perbaikanDariId, n.id)
            ),
          });
          nilaiPerMapel.push({ mapel, nilai: perbaikan ? perbaikan.nilai : n.nilai });
        } else {
          nilaiPerMapel.push({ mapel, nilai: "-" });
        }
      }
    }

    result.push({
      nama: peserta.nama,
      nomorPeserta: peserta.nomorPeserta,
      persentaseHadir: pct,
      totalSesi,
      hadirSesi,
      nilaiPerMapel,
      statusAkhir: peserta.statusAkhir,
      alasanStatus: peserta.alasanStatus,
    });
  }

  return { ok: true, data: result };
}
