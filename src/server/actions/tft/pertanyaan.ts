"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { pertanyaanTft, jawabanTft } from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type PertanyaanTftRow = {
  id: string;
  periodeId: string;
  label: string;
  deskripsi: string | null;
  tipe: "text" | "textarea" | "radio" | "checkbox" | "select" | "number" | "file";
  wajib: boolean;
  opsi: string[];
  urutan: number;
  createdAt: Date;
};

export type JawabanTftRow = {
  id: string;
  pendaftarId: string;
  pertanyaanId: string;
  nilai: string | null;
  nilaiArray: string[];
  fileStorageKey: string | null;
  fileOriginalName: string | null;
};

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export async function listPertanyaan(periodeId: string): Promise<PertanyaanTftRow[]> {
  const rows = await db
    .select({
      id: pertanyaanTft.id,
      periodeId: pertanyaanTft.periodeId,
      label: pertanyaanTft.label,
      deskripsi: pertanyaanTft.deskripsi,
      tipe: pertanyaanTft.tipe,
      wajib: pertanyaanTft.wajib,
      opsi: pertanyaanTft.opsi,
      urutan: pertanyaanTft.urutan,
      createdAt: pertanyaanTft.createdAt,
    })
    .from(pertanyaanTft)
    .where(eq(pertanyaanTft.periodeId, periodeId))
    .orderBy(asc(pertanyaanTft.urutan));

  return rows as PertanyaanTftRow[];
}

export async function listPertanyaanPublic(periodeId: string): Promise<PertanyaanTftRow[]> {
  // Same query but no auth required (used on public form)
  return listPertanyaan(periodeId);
}

export async function getJawabanByPendaftar(pendaftarId: string): Promise<JawabanTftRow[]> {
  await requireSession();
  const rows = await db
    .select({
      id: jawabanTft.id,
      pendaftarId: jawabanTft.pendaftarId,
      pertanyaanId: jawabanTft.pertanyaanId,
      nilai: jawabanTft.nilai,
      nilaiArray: jawabanTft.nilaiArray,
      fileStorageKey: jawabanTft.fileStorageKey,
      fileOriginalName: jawabanTft.fileOriginalName,
    })
    .from(jawabanTft)
    .where(eq(jawabanTft.pendaftarId, pendaftarId));

  return rows as JawabanTftRow[];
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

export async function createPertanyaan(data: {
  periodeId: string;
  label: string;
  deskripsi?: string;
  tipe: PertanyaanTftRow["tipe"];
  wajib?: boolean;
  opsi?: string[];
  urutan?: number;
}) {
  const session = await requirePermission("tft", "manage");

  const id = nanoid();
  await db.insert(pertanyaanTft).values({
    id,
    periodeId: data.periodeId,
    label: data.label,
    deskripsi: data.deskripsi || null,
    tipe: data.tipe,
    wajib: data.wajib ?? false,
    opsi: data.opsi ?? [],
    urutan: data.urutan ?? 0,
  });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_PERTANYAAN_TFT",
    entitasType: "pertanyaan_tft",
    entitasId: id,
    detail: { label: data.label, tipe: data.tipe },
  });

  revalidatePath(`/jadwal-otomatis/tft/${data.periodeId}`);
  return { ok: true as const, id };
}

export async function updatePertanyaan(data: {
  id: string;
  periodeId: string;
  label: string;
  deskripsi?: string;
  tipe: PertanyaanTftRow["tipe"];
  wajib?: boolean;
  opsi?: string[];
  urutan?: number;
}) {
  const session = await requirePermission("tft", "manage");

  const rows = await db
    .update(pertanyaanTft)
    .set({
      label: data.label,
      deskripsi: data.deskripsi || null,
      tipe: data.tipe,
      wajib: data.wajib ?? false,
      opsi: data.opsi ?? [],
      urutan: data.urutan ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(pertanyaanTft.id, data.id))
    .returning();

  if (!rows[0]) return { ok: false as const, error: "Pertanyaan tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PERTANYAAN_TFT",
    entitasType: "pertanyaan_tft",
    entitasId: data.id,
    detail: { label: data.label },
  });

  revalidatePath(`/jadwal-otomatis/tft/${data.periodeId}`);
  return { ok: true as const };
}

export async function deletePertanyaan(id: string) {
  const session = await requirePermission("tft", "manage");

  const existing = await db
    .select({ periodeId: pertanyaanTft.periodeId, label: pertanyaanTft.label })
    .from(pertanyaanTft)
    .where(eq(pertanyaanTft.id, id));

  if (!existing[0]) return { ok: false as const, error: "Pertanyaan tidak ditemukan." };

  // Cascade will delete related jawaban_tft
  await db.delete(pertanyaanTft).where(eq(pertanyaanTft.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_PERTANYAAN_TFT",
    entitasType: "pertanyaan_tft",
    entitasId: id,
    detail: { label: existing[0].label },
  });

  revalidatePath(`/jadwal-otomatis/tft/${existing[0].periodeId}`);
  return { ok: true as const };
}

// ─── SAVE JAWABAN (called during form submission) ────────────────────────────

export async function saveJawaban(
  pendaftarId: string,
  jawaban: { pertanyaanId: string; nilai?: string; nilaiArray?: string[]; fileStorageKey?: string; fileOriginalName?: string }[],
) {
  for (const j of jawaban) {
    await db.insert(jawabanTft).values({
      id: nanoid(),
      pendaftarId,
      pertanyaanId: j.pertanyaanId,
      nilai: j.nilai || null,
      nilaiArray: j.nilaiArray ?? [],
      fileStorageKey: j.fileStorageKey || null,
      fileOriginalName: j.fileOriginalName || null,
    });
  }
}
