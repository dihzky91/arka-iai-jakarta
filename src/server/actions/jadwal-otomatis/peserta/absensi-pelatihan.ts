"use server";

import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  absensiPelatihan,
  pesertaKelas,
  classSessions,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { recomputeStatusPeserta } from "./recompute-status";

interface AbsensiInput {
  pesertaId: string;
  hadir: boolean;
  catatan?: string;
}

export async function inputAbsensiPelatihan(
  sessionId: string,
  absensiList: AbsensiInput[],
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const userId = session.user.id;

  const sesi = await db.query.classSessions.findFirst({
    where: eq(classSessions.id, sessionId),
  });
  if (!sesi) {
    return { ok: false as const, error: "Sesi tidak ditemukan." };
  }

  const values = absensiList.map((a) => ({
    pesertaId: a.pesertaId,
    sessionId,
    hadir: a.hadir,
    catatan: a.catatan ?? null,
    inputBy: userId,
  }));

  for (const v of values) {
    await db
      .insert(absensiPelatihan)
      .values(v)
      .onConflictDoUpdate({
        target: [absensiPelatihan.pesertaId, absensiPelatihan.sessionId],
        set: { hadir: v.hadir, catatan: v.catatan, inputBy: userId, updatedAt: new Date() },
      });
  }

  const pesertaIds = absensiList.map((a) => a.pesertaId);
  for (const pid of pesertaIds) {
    try {
      await recomputeStatusPeserta(pid);
    } catch (e) {
      console.error("recomputeStatusPeserta failed for", pid, e);
    }
  }

  revalidatePath(`/jadwal-otomatis/${sesi.kelasId}`);
  return { ok: true as const };
}

export async function getAbsensiByKelas(kelasId: string) {
  await requirePermission("jadwalPelatihan", "view");

  const pesertaList = await db.query.pesertaKelas.findMany({
    where: and(
      eq(pesertaKelas.kelasId, kelasId),
      eq(pesertaKelas.statusEnrollment, "aktif")
    ),
    orderBy: (pk, { asc }) => [asc(pk.nama)],
  });

  const sesiList = await db.query.classSessions.findMany({
    where: and(
      eq(classSessions.kelasId, kelasId),
      eq(classSessions.isExamDay, false)
    ),
    orderBy: (cs, { asc }) => [asc(cs.scheduledDate)],
  });

  if (pesertaList.length === 0) {
    return { pesertaList: [], sesiList, absensiList: [] };
  }

  const absensiList = await db.query.absensiPelatihan.findMany({
    where: inArray(
      absensiPelatihan.pesertaId,
      pesertaList.map((p) => p.id)
    ),
  });

  return { pesertaList, sesiList, absensiList };
}

export async function getAbsensiBySession(sessionId: string) {
  await requirePermission("jadwalPelatihan", "view");

  const sesi = await db.query.classSessions.findFirst({
    where: eq(classSessions.id, sessionId),
  });
  if (!sesi) return null;

  const pesertaList = await db.query.pesertaKelas.findMany({
    where: and(
      eq(pesertaKelas.kelasId, sesi.kelasId),
      eq(pesertaKelas.statusEnrollment, "aktif")
    ),
    orderBy: (pk, { asc }) => [asc(pk.nama)],
  });

  const absensiList = await db.query.absensiPelatihan.findMany({
    where: eq(absensiPelatihan.sessionId, sessionId),
  });

  return { session: sesi, pesertaList, absensiList };
}
