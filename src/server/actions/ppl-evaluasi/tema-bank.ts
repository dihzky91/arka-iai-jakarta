"use server";

import { and, count, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  pplKegiatan,
  pplKegiatanNarasumber,
  pplKuesionerLink,
  pplTemaBank,
} from "@/server/db/schema";
import { kategoriPplValues } from "@/lib/validators/ppl-evaluasi";
import { requirePermission } from "@/server/actions/auth";
import type {
  ActionResult,
  CreateTemaInput,
  MateriItem,
  TemaBankDetail,
  TemaBankRow,
  TemaSuggestion,
  UpdateTemaInput,
} from "./types";

// ─── CREATE TEMA ─────────────────────────────────────────────────────────────

export async function createTema(
  data: CreateTemaInput,
): Promise<ActionResult<{ id: number }>> {
  const session = await requirePermission("pplEvaluasi", "manage");

  if (!data.namaTema || data.namaTema.trim().length === 0) {
    return { ok: false, error: "Nama tema wajib diisi" };
  }
  if (data.namaTema.length > 255) {
    return { ok: false, error: "Nama tema maksimal 255 karakter" };
  }

  const [row] = await db
    .insert(pplTemaBank)
    .values({
      namaTema: data.namaTema.trim(),
      kategoriPpl: data.kategoriPpl,
      latarBelakang: data.latarBelakang ?? null,
      susunanMateri: (data.susunanMateri ?? []) as MateriItem[],
      benefit: (data.benefit ?? []) as string[],
      targetPeserta: data.targetPeserta ?? null,
      durasiHari: data.durasiHari ?? 1,
      tipePelaksanaanDefault: (data.tipePelaksanaanDefault ?? null) as typeof data.tipePelaksanaanDefault,
      rekomendasiNarasumberIds: (data.rekomendasiNarasumberIds ?? []) as number[],
      defaultTemplateIds: (data.defaultTemplateIds ?? []) as number[],
      tags: (data.tags ?? []) as string[],
      createdBy: session.user.id,
    })
    .returning({ id: pplTemaBank.id });

  if (!row) {
    return { ok: false, error: "Gagal membuat tema" };
  }

  revalidatePath("/ppl-evaluasi/tema");
  return { ok: true, data: { id: row.id } };
}

// ─── UPDATE TEMA ─────────────────────────────────────────────────────────────

export async function updateTema(
  id: number,
  data: UpdateTemaInput,
): Promise<ActionResult> {
  await requirePermission("pplEvaluasi", "manage");

  const [existing] = await db
    .select({ id: pplTemaBank.id })
    .from(pplTemaBank)
    .where(eq(pplTemaBank.id, id))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Tema tidak ditemukan" };
  }

  if (data.namaTema !== undefined && data.namaTema.trim().length === 0) {
    return { ok: false, error: "Nama tema wajib diisi" };
  }

  const updateData: Record<string, unknown> = {};
  if (data.namaTema !== undefined) updateData.namaTema = data.namaTema.trim();
  if (data.kategoriPpl !== undefined) updateData.kategoriPpl = data.kategoriPpl;
  if (data.latarBelakang !== undefined) updateData.latarBelakang = data.latarBelakang;
  if (data.susunanMateri !== undefined) updateData.susunanMateri = data.susunanMateri as MateriItem[];
  if (data.benefit !== undefined) updateData.benefit = data.benefit as string[];
  if (data.targetPeserta !== undefined) updateData.targetPeserta = data.targetPeserta;
  if (data.durasiHari !== undefined) updateData.durasiHari = data.durasiHari;
  if (data.tipePelaksanaanDefault !== undefined) updateData.tipePelaksanaanDefault = data.tipePelaksanaanDefault;
  if (data.rekomendasiNarasumberIds !== undefined) updateData.rekomendasiNarasumberIds = data.rekomendasiNarasumberIds as number[];
  if (data.defaultTemplateIds !== undefined) updateData.defaultTemplateIds = data.defaultTemplateIds as number[];
  if (data.tags !== undefined) updateData.tags = data.tags as string[];
  updateData.updatedAt = new Date();

  await db
    .update(pplTemaBank)
    .set(updateData)
    .where(eq(pplTemaBank.id, id));

  revalidatePath("/ppl-evaluasi/tema");
  return { ok: true };
}

// ─── DELETE TEMA ─────────────────────────────────────────────────────────────

export async function deleteTema(id: number): Promise<ActionResult> {
  await requirePermission("pplEvaluasi", "manage");

  const [existing] = await db
    .select({ id: pplTemaBank.id })
    .from(pplTemaBank)
    .where(eq(pplTemaBank.id, id))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Tema tidak ditemukan" };
  }

  await db.delete(pplTemaBank).where(eq(pplTemaBank.id, id));

  revalidatePath("/ppl-evaluasi/tema");
  return { ok: true };
}

// ─── GET TEMA ────────────────────────────────────────────────────────────────

export async function getTema(id: number): Promise<TemaBankDetail | null> {
  await requirePermission("pplEvaluasi", "view");

  const [row] = await db
    .select()
    .from(pplTemaBank)
    .where(eq(pplTemaBank.id, id))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    namaTema: row.namaTema,
    kategoriPpl: row.kategoriPpl as TemaBankDetail["kategoriPpl"],
    latarBelakang: row.latarBelakang,
    susunanMateri: row.susunanMateri as MateriItem[],
    benefit: row.benefit as string[],
    targetPeserta: row.targetPeserta,
    durasiHari: row.durasiHari,
    tipePelaksanaanDefault: row.tipePelaksanaanDefault as TemaBankDetail["tipePelaksanaanDefault"],
    rekomendasiNarasumberIds: row.rekomendasiNarasumberIds as number[],
    defaultTemplateIds: row.defaultTemplateIds as number[],
    tags: row.tags as string[],
    usageCount: row.usageCount,
    lastUsedAt: row.lastUsedAt,
    sourceKegiatanId: row.sourceKegiatanId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── LIST TEMA ───────────────────────────────────────────────────────────────

export interface ListTemaOpts {
  search?: string;
  kategori?: string;
  page?: number;
  pageSize?: number;
}

export async function listTema(
  opts: ListTemaOpts = {},
): Promise<{ data: TemaBankRow[]; total: number }> {
  await requirePermission("pplEvaluasi", "view");

  const conditions: SQL[] = [];

  if (opts.search) {
    conditions.push(ilike(pplTemaBank.namaTema, `%${opts.search}%`));
  }
  if (opts.kategori) {
    conditions.push(eq(pplTemaBank.kategoriPpl, opts.kategori as typeof pplTemaBank.kategoriPpl.enumValues[number]));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [totalResult] = await db
    .select({ count: count() })
    .from(pplTemaBank)
    .where(where);

  const rows = await db
    .select()
    .from(pplTemaBank)
    .where(where)
    .orderBy(desc(pplTemaBank.usageCount), desc(pplTemaBank.updatedAt))
    .limit(pageSize)
    .offset(offset);

  return {
    data: rows.map((r) => ({
      id: r.id,
      namaTema: r.namaTema,
      kategoriPpl: r.kategoriPpl as TemaBankRow["kategoriPpl"],
      susunanMateri: r.susunanMateri as MateriItem[],
      benefit: r.benefit as string[],
      tags: r.tags as string[],
      usageCount: r.usageCount,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    total: totalResult?.count ?? 0,
  };
}

// ─── SUGGEST TEMA ────────────────────────────────────────────────────────────

export async function suggestTema(
  query: string,
  kategori?: string,
): Promise<TemaSuggestion[]> {
  await requirePermission("pplEvaluasi", "view");

  if (!query || query.trim().length < 2) return [];

  const conditions: ReturnType<typeof sql>[] = [
    ilike(pplTemaBank.namaTema, `%${query}%`),
  ];

  if (kategori) {
    conditions.push(sql`${pplTemaBank.kategoriPpl} = ${kategori}`);
  }

  const rows = await db
    .select()
    .from(pplTemaBank)
    .where(and(...conditions))
    .orderBy(desc(pplTemaBank.usageCount), desc(pplTemaBank.updatedAt))
    .limit(5);

  return rows.map((r) => {
    const materi = r.susunanMateri as MateriItem[] | null;
    const benefit = r.benefit as string[] | null;
    const rekomNars = r.rekomendasiNarasumberIds as number[] | null;

    return {
      id: r.id,
      namaTema: r.namaTema,
      kategoriPpl: r.kategoriPpl as TemaSuggestion["kategoriPpl"],
      matchScore: computeMatchScore(query, r.namaTema),
      usageCount: r.usageCount,
      lastUsedAt: r.lastUsedAt,
      preview: {
        benefitCount: benefit?.length ?? 0,
        materiCount: materi?.length ?? 0,
        hasNarasumberRekomendasi: (rekomNars?.length ?? 0) > 0,
      },
    };
  });
}

function computeMatchScore(query: string, temaName: string): number {
  const q = query.toLowerCase();
  const t = temaName.toLowerCase();
  if (t === q) return 1;
  if (t.startsWith(q)) return 0.9;
  if (t.includes(q)) return 0.7;
  const words = q.split(/\s+/);
  const matchCount = words.filter((w) => t.includes(w)).length;
  return words.length > 0 ? matchCount / words.length * 0.5 : 0;
}

// ─── SAVE KEGIATAN AS TEMA ───────────────────────────────────────────────────

export async function saveKegiatanAsTema(
  kegiatanId: number,
  overrides?: Partial<CreateTemaInput>,
): Promise<ActionResult<{ id: number }>> {
  await requirePermission("pplEvaluasi", "manage");

  const [kegiatan] = await db
    .select()
    .from(pplKegiatan)
    .where(eq(pplKegiatan.id, kegiatanId))
    .limit(1);

  if (!kegiatan) {
    return { ok: false, error: "Kegiatan tidak ditemukan" };
  }

  // Fetch assigned narasumber
  const narasumberAssignments = await db
    .select({ narasumberId: pplKegiatanNarasumber.narasumberId })
    .from(pplKegiatanNarasumber)
    .where(eq(pplKegiatanNarasumber.kegiatanId, kegiatanId));

  // Fetch linked template IDs
  const links = await db
    .select({ templateId: pplKuesionerLink.templateId })
    .from(pplKuesionerLink)
    .where(eq(pplKuesionerLink.kegiatanId, kegiatanId));

  const durasiHari = (() => {
    const start = new Date(kegiatan.tanggalMulai);
    const end = new Date(kegiatan.tanggalSelesai);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  })();

  const temaData: CreateTemaInput = {
    namaTema: kegiatan.namaKegiatan,
    kategoriPpl: kegiatan.kategoriPpl as CreateTemaInput["kategoriPpl"],
    durasiHari,
    tipePelaksanaanDefault: kegiatan.tipePelaksanaan as CreateTemaInput["tipePelaksanaanDefault"],
    rekomendasiNarasumberIds: narasumberAssignments.map((a) => a.narasumberId),
    defaultTemplateIds: links.map((l) => l.templateId),
    ...(overrides as Record<string, unknown>),
  } as CreateTemaInput;

  return createTema(temaData);
}

// ─── APPLY TEMA TO KEGIATAN ──────────────────────────────────────────────────

export interface ApplyTemaResult {
  namaKegiatan?: string;
  kategoriPpl?: string;
  tipePelaksanaan?: string;
  tanggalMulai?: string;
  tanggalSelesai?: string;
  narasumberAssignments?: Array<{ narasumberId: number; topik?: string }>;
  templateIds?: number[];
}

export async function applyTemaToKegiatan(
  temaId: number,
  tanggalMulai?: string,
): Promise<ActionResult<{ prefill: ApplyTemaResult }>> {
  await requirePermission("pplEvaluasi", "view");

  const tema = await getTema(temaId);
  if (!tema) {
    return { ok: false, error: "Tema tidak ditemukan" };
  }

  const startDate = tanggalMulai ?? new Date().toISOString().slice(0, 10);
  const tanggalSelesai = calculateEndDate(startDate, tema.durasiHari);

  const prefill: ApplyTemaResult = {
    namaKegiatan: tema.namaTema,
    kategoriPpl: tema.kategoriPpl,
    tipePelaksanaan: tema.tipePelaksanaanDefault ?? undefined,
    tanggalMulai: startDate,
    tanggalSelesai,
    narasumberAssignments: tema.rekomendasiNarasumberIds.map((id) => ({
      narasumberId: id,
    })),
    templateIds: tema.defaultTemplateIds,
  };

  return { ok: true, data: { prefill } };
}

function calculateEndDate(startDate: string, durasiHari: number): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + durasiHari - 1);
  return end.toISOString().slice(0, 10);
}

// ─── INCREMENT USAGE COUNT ───────────────────────────────────────────────────

export async function incrementTemaUsage(temaId: number): Promise<ActionResult> {
  await requirePermission("pplEvaluasi", "manage");

  await db
    .update(pplTemaBank)
    .set({
      usageCount: sql`${pplTemaBank.usageCount} + 1`,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pplTemaBank.id, temaId));

  return { ok: true };
}
