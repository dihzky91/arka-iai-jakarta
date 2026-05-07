"use server";

import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  pesertaKelas,
  kelasPelatihan,
  absensiPelatihan,
  absensiUjian,
  nilaiUjian,
  ujianSusulanPeserta,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";

interface EnrollPesertaData {
  nama: string;
  nomorPeserta?: string;
  email?: string;
  telepon?: string;
  catatan?: string;
}

type DuplicateStrategy = "skip" | "update" | "allow";

function normalizeValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePesertaInput(data: EnrollPesertaData[]) {
  return data
    .map((d) => ({
      nama: d.nama?.trim() ?? "",
      nomorPeserta: d.nomorPeserta?.trim() || undefined,
      email: d.email?.trim() || undefined,
      telepon: d.telepon?.trim() || undefined,
      catatan: d.catatan?.trim() || undefined,
    }))
    .filter((d) => d.nama.length > 0);
}

export async function enrollPeserta(
  kelasId: string,
  data: EnrollPesertaData[]
) {
  await requirePermission("jadwalPelatihan", "manage");

  const kelas = await db.query.kelasPelatihan.findFirst({
    where: eq(kelasPelatihan.id, kelasId),
  });
  if (!kelas || kelas.status !== "active") {
    return { ok: false as const, error: "Kelas tidak ditemukan atau tidak aktif." };
  }

  const inserted = await db
    .insert(pesertaKelas)
    .values(
      data.map((d) => ({
        kelasId,
        nama: d.nama,
        nomorPeserta: d.nomorPeserta ?? null,
        email: d.email ?? null,
        telepon: d.telepon ?? null,
        catatan: d.catatan ?? null,
      }))
    )
    .returning();

  revalidatePath(`/jadwal-otomatis/${kelasId}`);
  return { ok: true as const, data: inserted };
}

export async function bulkImportPeserta(
  kelasId: string,
  data: EnrollPesertaData[],
  duplicateStrategy: DuplicateStrategy = "skip",
) {
  await requirePermission("jadwalPelatihan", "manage");

  const kelas = await db.query.kelasPelatihan.findFirst({
    where: eq(kelasPelatihan.id, kelasId),
  });
  if (!kelas || kelas.status !== "active") {
    return { ok: false as const, error: "Kelas tidak ditemukan atau tidak aktif." };
  }

  const normalized = normalizePesertaInput(data);
  if (normalized.length === 0) {
    return { ok: false as const, error: "Tidak ada peserta valid untuk diimport." };
  }

  const existingRows = await db.query.pesertaKelas.findMany({
    where: eq(pesertaKelas.kelasId, kelasId),
  });
  const existingByNomor = new Map(
    existingRows
      .filter((p) => normalizeValue(p.nomorPeserta))
      .map((p) => [normalizeValue(p.nomorPeserta), p]),
  );
  const existingByNama = new Map(existingRows.map((p) => [normalizeValue(p.nama), p]));
  const seenKeys = new Set<string>();
  const toInsert: EnrollPesertaData[] = [];
  const toUpdate: { id: string; data: EnrollPesertaData }[] = [];
  const skipped: { nama: string; reason: string }[] = [];

  for (const row of normalized) {
    const nomorKey = normalizeValue(row.nomorPeserta);
    const namaKey = normalizeValue(row.nama);
    const importKey = nomorKey ? `nomor:${nomorKey}` : `nama:${namaKey}`;

    if (seenKeys.has(importKey) && duplicateStrategy !== "allow") {
      skipped.push({ nama: row.nama, reason: "Duplikat di file import." });
      continue;
    }
    seenKeys.add(importKey);

    const existing = (nomorKey ? existingByNomor.get(nomorKey) : undefined) ?? existingByNama.get(namaKey);
    if (!existing || duplicateStrategy === "allow") {
      toInsert.push(row);
      continue;
    }

    if (duplicateStrategy === "update") {
      toUpdate.push({ id: existing.id, data: row });
    } else {
      skipped.push({ nama: row.nama, reason: "Sudah ada di kelas." });
    }
  }

  const inserted = toInsert.length > 0
    ? await db
        .insert(pesertaKelas)
        .values(
          toInsert.map((d) => ({
            kelasId,
            nama: d.nama,
            nomorPeserta: d.nomorPeserta ?? null,
            email: d.email ?? null,
            telepon: d.telepon ?? null,
            catatan: d.catatan ?? null,
          })),
        )
        .returning()
    : [];

  const updated = [];
  for (const item of toUpdate) {
    const rows = await db
      .update(pesertaKelas)
      .set({
        nama: item.data.nama,
        nomorPeserta: item.data.nomorPeserta ?? null,
        email: item.data.email ?? null,
        telepon: item.data.telepon ?? null,
        catatan: item.data.catatan ?? null,
        statusEnrollment: "aktif",
        updatedAt: new Date(),
      })
      .where(eq(pesertaKelas.id, item.id))
      .returning();

    if (rows[0]) updated.push(rows[0]);
  }

  revalidatePath(`/jadwal-otomatis/${kelasId}`);
  return {
    ok: true as const,
    data: {
      inserted,
      updated,
      skipped,
      totalInput: data.length,
      totalValid: normalized.length,
    },
  };
}

export async function getPesertaByKelas(kelasId: string) {
  await requirePermission("jadwalPelatihan", "view");

  return db.query.pesertaKelas.findMany({
    where: and(
      eq(pesertaKelas.kelasId, kelasId),
      eq(pesertaKelas.statusEnrollment, "aktif")
    ),
    orderBy: (pk, { asc }) => [asc(pk.nama)],
  });
}

export async function updateStatusEnrollment(
  pesertaId: string,
  status: "aktif" | "mengundurkan_diri"
) {
  await requirePermission("jadwalPelatihan", "manage");

  const updated = await db
    .update(pesertaKelas)
    .set({ statusEnrollment: status, updatedAt: new Date() })
    .where(eq(pesertaKelas.id, pesertaId))
    .returning();

  if (updated.length === 0) {
    return { ok: false as const, error: "Peserta tidak ditemukan." };
  }

  revalidatePath(`/jadwal-otomatis/${updated[0]!.kelasId}`);
  return { ok: true as const, data: updated[0]! };
}

export async function bulkUpdateStatusEnrollment(
  pesertaIds: string[],
  status: "aktif" | "mengundurkan_diri",
) {
  await requirePermission("jadwalPelatihan", "manage");

  const uniqueIds = [...new Set(pesertaIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return { ok: false as const, error: "Pilih minimal satu peserta." };
  }

  const updated = await db
    .update(pesertaKelas)
    .set({ statusEnrollment: status, updatedAt: new Date() })
    .where(inArray(pesertaKelas.id, uniqueIds))
    .returning();

  const kelasIds = [...new Set(updated.map((p) => p.kelasId))];
  for (const id of kelasIds) {
    revalidatePath(`/jadwal-otomatis/${id}`);
  }

  return { ok: true as const, data: updated };
}

async function getPesertaUsage(pesertaIds: string[]) {
  const [pelatihan, ujian, nilai, susulan] = await Promise.all([
    db.select({ pesertaId: absensiPelatihan.pesertaId }).from(absensiPelatihan).where(inArray(absensiPelatihan.pesertaId, pesertaIds)),
    db.select({ pesertaId: absensiUjian.pesertaId }).from(absensiUjian).where(inArray(absensiUjian.pesertaId, pesertaIds)),
    db.select({ pesertaId: nilaiUjian.pesertaId }).from(nilaiUjian).where(inArray(nilaiUjian.pesertaId, pesertaIds)),
    db.select({ pesertaId: ujianSusulanPeserta.pesertaId }).from(ujianSusulanPeserta).where(inArray(ujianSusulanPeserta.pesertaId, pesertaIds)),
  ]);

  return new Set([...pelatihan, ...ujian, ...nilai, ...susulan].map((row) => row.pesertaId));
}

export async function bulkMovePesertaToKelas(
  pesertaIds: string[],
  targetKelasId: string,
) {
  await requirePermission("jadwalPelatihan", "manage");

  const uniqueIds = [...new Set(pesertaIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return { ok: false as const, error: "Pilih minimal satu peserta." };
  }

  const targetKelas = await db.query.kelasPelatihan.findFirst({
    where: eq(kelasPelatihan.id, targetKelasId),
  });
  if (!targetKelas || targetKelas.status !== "active") {
    return { ok: false as const, error: "Kelas tujuan tidak ditemukan atau tidak aktif." };
  }

  const pesertaRows = await db.query.pesertaKelas.findMany({
    where: inArray(pesertaKelas.id, uniqueIds),
  });
  const sourceKelasIds = [...new Set(pesertaRows.map((p) => p.kelasId))];
  const blockedIds = await getPesertaUsage(uniqueIds);
  if (blockedIds.size > 0) {
    return {
      ok: false as const,
      error: `${blockedIds.size} peserta sudah memiliki absensi/nilai/ujian susulan. Pindah kelas diblokir untuk menjaga histori.`,
    };
  }

  const updated = await db
    .update(pesertaKelas)
    .set({ kelasId: targetKelasId, statusEnrollment: "aktif", updatedAt: new Date() })
    .where(inArray(pesertaKelas.id, uniqueIds))
    .returning();

  for (const id of [...new Set([...sourceKelasIds, targetKelasId])]) {
    revalidatePath(`/jadwal-otomatis/${id}`);
  }

  return { ok: true as const, data: updated };
}

export async function bulkDeletePesertaIfClean(pesertaIds: string[]) {
  await requirePermission("jadwalPelatihan", "manage");

  const uniqueIds = [...new Set(pesertaIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return { ok: false as const, error: "Pilih minimal satu peserta." };
  }

  const pesertaRows = await db.query.pesertaKelas.findMany({
    where: inArray(pesertaKelas.id, uniqueIds),
  });
  const kelasIds = [...new Set(pesertaRows.map((p) => p.kelasId))];
  const blockedIds = await getPesertaUsage(uniqueIds);
  if (blockedIds.size > 0) {
    return {
      ok: false as const,
      error: `${blockedIds.size} peserta sudah memiliki absensi/nilai/ujian susulan. Hapus permanen diblokir.`,
    };
  }

  const deleted = await db
    .delete(pesertaKelas)
    .where(inArray(pesertaKelas.id, uniqueIds))
    .returning();

  for (const id of kelasIds) {
    revalidatePath(`/jadwal-otomatis/${id}`);
  }

  return { ok: true as const, data: deleted };
}

export async function deletePeserta(pesertaId: string) {
  return updateStatusEnrollment(pesertaId, "mengundurkan_diri");
}
