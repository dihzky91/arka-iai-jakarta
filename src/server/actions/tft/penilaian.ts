"use server";

import { asc, eq, and, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  kriteriaPenilaianTft,
  penilaiTft,
  nilaiTft,
  pendaftarTft,
} from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";
import {
  kriteriaTftCreateSchema,
  kriteriaTftUpdateSchema,
  penilaiTftCreateSchema,
  penilaiTftUpdateSchema,
  nilaiTftInputSchema,
  type KriteriaTftCreateInput,
  type KriteriaTftUpdateInput,
  type PenilaiTftCreateInput,
  type PenilaiTftUpdateInput,
  type NilaiTftInputData,
} from "@/lib/validators/tft.schema";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type KriteriaTftRow = {
  id: string;
  periodeId: string;
  nama: string;
  deskripsi: string | null;
  bobot: string;
  skorMin: string;
  skorMax: string;
  urutan: number;
  createdAt: Date;
};

export type PenilaiTftRow = {
  id: string;
  periodeId: string;
  nama: string;
  jabatan: string | null;
  instansi: string | null;
  catatan: string | null;
  finalizedAt: Date | null;
  createdAt: Date;
};

export type NilaiTftRow = {
  id: string;
  pendaftarId: string;
  penilaiId: string;
  kriteriaId: string;
  skor: string;
  catatan: string | null;
};

// ─── KRITERIA QUERIES ────────────────────────────────────────────────────────

export async function listKriteria(periodeId: string): Promise<KriteriaTftRow[]> {
  await requireSession();
  const rows = await db
    .select({
      id: kriteriaPenilaianTft.id,
      periodeId: kriteriaPenilaianTft.periodeId,
      nama: kriteriaPenilaianTft.nama,
      deskripsi: kriteriaPenilaianTft.deskripsi,
      bobot: kriteriaPenilaianTft.bobot,
      skorMin: kriteriaPenilaianTft.skorMin,
      skorMax: kriteriaPenilaianTft.skorMax,
      urutan: kriteriaPenilaianTft.urutan,
      createdAt: kriteriaPenilaianTft.createdAt,
    })
    .from(kriteriaPenilaianTft)
    .where(eq(kriteriaPenilaianTft.periodeId, periodeId))
    .orderBy(asc(kriteriaPenilaianTft.urutan));

  return rows as KriteriaTftRow[];
}

export async function createKriteria(data: KriteriaTftCreateInput) {
  const parsed = kriteriaTftCreateSchema.parse(data);
  const session = await requirePermission("tft", "manage");

  const id = nanoid();
  await db.insert(kriteriaPenilaianTft).values({
    id,
    periodeId: parsed.periodeId,
    nama: parsed.nama,
    deskripsi: parsed.deskripsi || null,
    bobot: String(parsed.bobot),
    skorMin: String(parsed.skorMin),
    skorMax: String(parsed.skorMax),
    urutan: parsed.urutan,
  });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_KRITERIA_TFT",
    entitasType: "kriteria_penilaian_tft",
    entitasId: id,
    detail: { nama: parsed.nama, bobot: parsed.bobot },
  });

  revalidatePath(`/jadwal-otomatis/tft/${parsed.periodeId}`);
  return { ok: true as const, id };
}

export async function updateKriteria(data: KriteriaTftUpdateInput) {
  const parsed = kriteriaTftUpdateSchema.parse(data);
  const session = await requirePermission("tft", "manage");

  const rows = await db
    .update(kriteriaPenilaianTft)
    .set({
      nama: parsed.nama,
      deskripsi: parsed.deskripsi || null,
      bobot: String(parsed.bobot),
      skorMin: String(parsed.skorMin),
      skorMax: String(parsed.skorMax),
      urutan: parsed.urutan,
      updatedAt: new Date(),
    })
    .where(eq(kriteriaPenilaianTft.id, parsed.id))
    .returning();

  if (!rows[0]) return { ok: false as const, error: "Kriteria tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_KRITERIA_TFT",
    entitasType: "kriteria_penilaian_tft",
    entitasId: parsed.id,
    detail: { nama: parsed.nama },
  });

  revalidatePath(`/jadwal-otomatis/tft/${parsed.periodeId}`);
  return { ok: true as const };
}

export async function deleteKriteria(id: string) {
  const session = await requirePermission("tft", "manage");

  const existing = await db
    .select({ periodeId: kriteriaPenilaianTft.periodeId, nama: kriteriaPenilaianTft.nama })
    .from(kriteriaPenilaianTft)
    .where(eq(kriteriaPenilaianTft.id, id));

  if (!existing[0]) return { ok: false as const, error: "Kriteria tidak ditemukan." };

  // Check if there are existing scores using this criteria
  const nilaiCount = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(nilaiTft)
    .where(eq(nilaiTft.kriteriaId, id));

  if (nilaiCount[0] && nilaiCount[0].total > 0) {
    return {
      ok: false as const,
      error: `Kriteria "${existing[0].nama}" sudah memiliki ${nilaiCount[0].total} nilai. Hapus nilai terlebih dahulu atau gunakan force delete.`,
      hasNilai: true,
      count: nilaiCount[0].total,
    };
  }

  await db.delete(kriteriaPenilaianTft).where(eq(kriteriaPenilaianTft.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_KRITERIA_TFT",
    entitasType: "kriteria_penilaian_tft",
    entitasId: id,
    detail: { nama: existing[0].nama },
  });

  revalidatePath(`/jadwal-otomatis/tft/${existing[0].periodeId}`);
  return { ok: true as const };
}

export async function forceDeleteKriteria(id: string) {
  const session = await requirePermission("tft", "manage");

  const existing = await db
    .select({ periodeId: kriteriaPenilaianTft.periodeId, nama: kriteriaPenilaianTft.nama })
    .from(kriteriaPenilaianTft)
    .where(eq(kriteriaPenilaianTft.id, id));

  if (!existing[0]) return { ok: false as const, error: "Kriteria tidak ditemukan." };

  // Cascade will delete related nilai_tft rows
  await db.delete(kriteriaPenilaianTft).where(eq(kriteriaPenilaianTft.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "FORCE_DELETE_KRITERIA_TFT",
    entitasType: "kriteria_penilaian_tft",
    entitasId: id,
    detail: { nama: existing[0].nama },
  });

  revalidatePath(`/jadwal-otomatis/tft/${existing[0].periodeId}`);
  return { ok: true as const };
}

export async function copyKriteriaFromPeriode(sourcePeriodeId: string, targetPeriodeId: string) {
  const session = await requirePermission("tft", "manage");

  const sourceKriteria = await db
    .select()
    .from(kriteriaPenilaianTft)
    .where(eq(kriteriaPenilaianTft.periodeId, sourcePeriodeId))
    .orderBy(asc(kriteriaPenilaianTft.urutan));

  if (sourceKriteria.length === 0) {
    return { ok: false as const, error: "Periode sumber tidak memiliki kriteria." };
  }

  const values = sourceKriteria.map((k) => ({
    id: nanoid(),
    periodeId: targetPeriodeId,
    nama: k.nama,
    deskripsi: k.deskripsi,
    bobot: k.bobot,
    skorMin: k.skorMin,
    skorMax: k.skorMax,
    urutan: k.urutan,
  }));

  await db.insert(kriteriaPenilaianTft).values(values);

  await writeAuditLog({
    userId: session.user.id,
    aksi: "COPY_KRITERIA_TFT",
    entitasType: "kriteria_penilaian_tft",
    entitasId: targetPeriodeId,
    detail: { sourcePeriodeId, count: values.length },
  });

  revalidatePath(`/jadwal-otomatis/tft/${targetPeriodeId}`);
  return { ok: true as const, count: values.length };
}

// ─── PENILAI QUERIES ─────────────────────────────────────────────────────────

export async function listPenilai(periodeId: string): Promise<PenilaiTftRow[]> {
  await requireSession();
  const rows = await db
    .select({
      id: penilaiTft.id,
      periodeId: penilaiTft.periodeId,
      nama: penilaiTft.nama,
      jabatan: penilaiTft.jabatan,
      instansi: penilaiTft.instansi,
      catatan: penilaiTft.catatan,
      finalizedAt: penilaiTft.finalizedAt,
      createdAt: penilaiTft.createdAt,
    })
    .from(penilaiTft)
    .where(eq(penilaiTft.periodeId, periodeId))
    .orderBy(asc(penilaiTft.nama));

  return rows as PenilaiTftRow[];
}

export async function createPenilai(data: PenilaiTftCreateInput) {
  const parsed = penilaiTftCreateSchema.parse(data);
  const session = await requirePermission("tft", "manage");

  const id = nanoid();
  await db.insert(penilaiTft).values({
    id,
    periodeId: parsed.periodeId,
    nama: parsed.nama,
    jabatan: parsed.jabatan || null,
    instansi: parsed.instansi || null,
    catatan: parsed.catatan || null,
  });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_PENILAI_TFT",
    entitasType: "penilai_tft",
    entitasId: id,
    detail: { nama: parsed.nama },
  });

  revalidatePath(`/jadwal-otomatis/tft/${parsed.periodeId}`);
  return { ok: true as const, id };
}

export async function updatePenilai(data: PenilaiTftUpdateInput) {
  const parsed = penilaiTftUpdateSchema.parse(data);
  const session = await requirePermission("tft", "manage");

  const rows = await db
    .update(penilaiTft)
    .set({
      nama: parsed.nama,
      jabatan: parsed.jabatan || null,
      instansi: parsed.instansi || null,
      catatan: parsed.catatan || null,
    })
    .where(eq(penilaiTft.id, parsed.id))
    .returning();

  if (!rows[0]) return { ok: false as const, error: "Penilai tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PENILAI_TFT",
    entitasType: "penilai_tft",
    entitasId: parsed.id,
    detail: { nama: parsed.nama },
  });

  revalidatePath(`/jadwal-otomatis/tft/${parsed.periodeId}`);
  return { ok: true as const };
}

export async function deletePenilai(id: string) {
  const session = await requirePermission("tft", "manage");

  const existing = await db
    .select({ periodeId: penilaiTft.periodeId, nama: penilaiTft.nama })
    .from(penilaiTft)
    .where(eq(penilaiTft.id, id));

  if (!existing[0]) return { ok: false as const, error: "Penilai tidak ditemukan." };

  // Cascade delete will handle nilai_tft
  await db.delete(penilaiTft).where(eq(penilaiTft.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_PENILAI_TFT",
    entitasType: "penilai_tft",
    entitasId: id,
    detail: { nama: existing[0].nama },
  });

  revalidatePath(`/jadwal-otomatis/tft/${existing[0].periodeId}`);
  return { ok: true as const };
}

// ─── NILAI ───────────────────────────────────────────────────────────────────

export async function getNilaiByPenilai(periodeId: string, penilaiId: string): Promise<NilaiTftRow[]> {
  await requireSession();

  const rows = await db
    .select({
      id: nilaiTft.id,
      pendaftarId: nilaiTft.pendaftarId,
      penilaiId: nilaiTft.penilaiId,
      kriteriaId: nilaiTft.kriteriaId,
      skor: nilaiTft.skor,
      catatan: nilaiTft.catatan,
    })
    .from(nilaiTft)
    .where(and(eq(nilaiTft.periodeId, periodeId), eq(nilaiTft.penilaiId, penilaiId)));

  return rows as NilaiTftRow[];
}

export async function getAllNilai(periodeId: string): Promise<NilaiTftRow[]> {
  await requireSession();

  const rows = await db
    .select({
      id: nilaiTft.id,
      pendaftarId: nilaiTft.pendaftarId,
      penilaiId: nilaiTft.penilaiId,
      kriteriaId: nilaiTft.kriteriaId,
      skor: nilaiTft.skor,
      catatan: nilaiTft.catatan,
    })
    .from(nilaiTft)
    .where(eq(nilaiTft.periodeId, periodeId));

  return rows as NilaiTftRow[];
}

export async function saveNilai(data: NilaiTftInputData) {
  const parsed = nilaiTftInputSchema.parse(data);
  const session = await requirePermission("tft", "manage");

  // Upsert each nilai entry
  for (const item of parsed.nilai) {
    const existing = await db
      .select({ id: nilaiTft.id })
      .from(nilaiTft)
      .where(
        and(
          eq(nilaiTft.pendaftarId, item.pendaftarId),
          eq(nilaiTft.penilaiId, parsed.penilaiId),
          eq(nilaiTft.kriteriaId, item.kriteriaId),
        ),
      );

    if (existing[0]) {
      await db
        .update(nilaiTft)
        .set({
          skor: String(item.skor),
          catatan: item.catatan || null,
          inputBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(nilaiTft.id, existing[0].id));
    } else {
      await db.insert(nilaiTft).values({
        id: nanoid(),
        periodeId: parsed.periodeId,
        pendaftarId: item.pendaftarId,
        penilaiId: parsed.penilaiId,
        kriteriaId: item.kriteriaId,
        skor: String(item.skor),
        catatan: item.catatan || null,
        inputBy: session.user.id,
      });
    }
  }

  // Recalculate skor_akhir for affected pendaftar
  const affectedPendaftarIds = [...new Set(parsed.nilai.map((n) => n.pendaftarId))];
  await recalculateSkorAkhir(parsed.periodeId, affectedPendaftarIds);

  await writeAuditLog({
    userId: session.user.id,
    aksi: "INPUT_NILAI_TFT",
    entitasType: "nilai_tft",
    entitasId: parsed.periodeId,
    detail: { penilaiId: parsed.penilaiId, count: parsed.nilai.length },
  });

  revalidatePath(`/jadwal-otomatis/tft/${parsed.periodeId}`);
  return { ok: true as const };
}

// ─── RECALCULATE SKOR AKHIR ──────────────────────────────────────────────────

async function recalculateSkorAkhir(periodeId: string, pendaftarIds: string[]) {
  // Get all kriteria with bobot
  const kriteria = await db
    .select({ id: kriteriaPenilaianTft.id, bobot: kriteriaPenilaianTft.bobot })
    .from(kriteriaPenilaianTft)
    .where(eq(kriteriaPenilaianTft.periodeId, periodeId));

  if (kriteria.length === 0) return;

  const totalBobot = kriteria.reduce((sum, k) => sum + Number(k.bobot), 0);
  if (totalBobot === 0) return;

  // Get all penilai for this periode
  const penilaiList = await db
    .select({ id: penilaiTft.id })
    .from(penilaiTft)
    .where(eq(penilaiTft.periodeId, periodeId));

  const jumlahPenilai = penilaiList.length;
  if (jumlahPenilai === 0) return;

  for (const pendaftarId of pendaftarIds) {
    // Get all nilai for this pendaftar
    const nilai = await db
      .select({
        kriteriaId: nilaiTft.kriteriaId,
        penilaiId: nilaiTft.penilaiId,
        skor: nilaiTft.skor,
      })
      .from(nilaiTft)
      .where(
        and(eq(nilaiTft.periodeId, periodeId), eq(nilaiTft.pendaftarId, pendaftarId)),
      );

    if (nilai.length === 0) {
      await db
        .update(pendaftarTft)
        .set({ skorAkhir: null, updatedAt: new Date() })
        .where(eq(pendaftarTft.id, pendaftarId));
      continue;
    }

    // Calculate weighted average per penilai, then average across penilai
    let totalSkorWeighted = 0;
    let penilaiWithScores = 0;

    for (const penilai of penilaiList) {
      const penilaiNilai = nilai.filter((n) => n.penilaiId === penilai.id);
      if (penilaiNilai.length === 0) continue;

      let weightedSum = 0;
      let bobotUsed = 0;

      for (const k of kriteria) {
        const nilaiForKriteria = penilaiNilai.find((n) => n.kriteriaId === k.id);
        if (nilaiForKriteria) {
          weightedSum += Number(nilaiForKriteria.skor) * Number(k.bobot);
          bobotUsed += Number(k.bobot);
        }
      }

      if (bobotUsed > 0) {
        totalSkorWeighted += weightedSum / bobotUsed;
        penilaiWithScores++;
      }
    }

    const skorAkhir = penilaiWithScores > 0
      ? (totalSkorWeighted / penilaiWithScores).toFixed(2)
      : null;

    await db
      .update(pendaftarTft)
      .set({ skorAkhir, updatedAt: new Date() })
      .where(eq(pendaftarTft.id, pendaftarId));
  }
}

export { recalculateSkorAkhir };

// ─── FINALISASI PENILAI ──────────────────────────────────────────────────────

export async function finalizePenilai(penilaiId: string) {
  const session = await requirePermission("tft", "manage");

  const existing = await db
    .select({ id: penilaiTft.id, periodeId: penilaiTft.periodeId, nama: penilaiTft.nama })
    .from(penilaiTft)
    .where(eq(penilaiTft.id, penilaiId));

  if (!existing[0]) return { ok: false as const, error: "Penilai tidak ditemukan." };

  await db
    .update(penilaiTft)
    .set({ finalizedAt: new Date() })
    .where(eq(penilaiTft.id, penilaiId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "FINALIZE_PENILAI_TFT",
    entitasType: "penilai_tft",
    entitasId: penilaiId,
    detail: { nama: existing[0].nama },
  });

  revalidatePath(`/jadwal-otomatis/tft/${existing[0].periodeId}`);
  return { ok: true as const };
}

export async function unfinalizePenilai(penilaiId: string) {
  const session = await requirePermission("tft", "manage");

  const existing = await db
    .select({ id: penilaiTft.id, periodeId: penilaiTft.periodeId, nama: penilaiTft.nama })
    .from(penilaiTft)
    .where(eq(penilaiTft.id, penilaiId));

  if (!existing[0]) return { ok: false as const, error: "Penilai tidak ditemukan." };

  await db
    .update(penilaiTft)
    .set({ finalizedAt: null })
    .where(eq(penilaiTft.id, penilaiId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UNFINALIZE_PENILAI_TFT",
    entitasType: "penilai_tft",
    entitasId: penilaiId,
    detail: { nama: existing[0].nama },
  });

  revalidatePath(`/jadwal-otomatis/tft/${existing[0].periodeId}`);
  return { ok: true as const };
}
