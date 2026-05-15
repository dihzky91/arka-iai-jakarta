"use server";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  penilaianTemplate,
  penilaianTemplateItem,
  penilaianPeriode,
  penilaianKinerja,
  penilaianKinerjaDetail,
  divisi,
  users,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import {
  templateCreateSchema,
  templateUpdateSchema,
  templateDeleteSchema,
  templateItemCreateSchema,
  templateItemUpdateSchema,
  templateItemDeleteSchema,
  templateItemBulkCreateSchema,
  periodeCreateSchema,
  periodeUpdateSchema,
  penilaianCreateSchema,
  penilaianSubmitSchema,
  penilaianApproveSchema,
} from "@/lib/validators/penilaianKinerja.schema";
import { requireSession } from "./auth";
import { writeAuditLog } from "@/server/lib/audit";

// ─── TEMPLATE CRUD ────────────────────────────────────────────────────────────

export type TemplateRow = {
  id: number;
  nama: string;
  tipe: "tugas" | "perilaku";
  divisiId: number | null;
  divisiNama: string | null;
  jabatan: string | null;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  itemCount: number;
};

export async function listTemplates(opts?: {
  tipe?: "tugas" | "perilaku";
}): Promise<TemplateRow[]> {
  // Allow users with 'create' capability to list templates (needed for input form)
  await requirePermission("penilaianKinerja", "create");

  const conditions = [];
  if (opts?.tipe) {
    conditions.push(eq(penilaianTemplate.tipe, opts.tipe));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: penilaianTemplate.id,
      nama: penilaianTemplate.nama,
      tipe: penilaianTemplate.tipe,
      divisiId: penilaianTemplate.divisiId,
      divisiNama: divisi.nama,
      jabatan: penilaianTemplate.jabatan,
      isDefault: penilaianTemplate.isDefault,
      createdBy: penilaianTemplate.createdBy,
      createdAt: penilaianTemplate.createdAt,
      updatedAt: penilaianTemplate.updatedAt,
      itemCount: sql<number>`(
        SELECT count(*)::int FROM penilaian_template_item
        WHERE penilaian_template_item.template_id = ${penilaianTemplate.id}
      )`,
    })
    .from(penilaianTemplate)
    .leftJoin(divisi, eq(penilaianTemplate.divisiId, divisi.id))
    .where(where)
    .orderBy(asc(penilaianTemplate.tipe), asc(penilaianTemplate.nama));

  return rows;
}

export async function getTemplate(id: number) {
  await requirePermission("penilaianKinerja", "manage");

  const [template] = await db
    .select({
      id: penilaianTemplate.id,
      nama: penilaianTemplate.nama,
      tipe: penilaianTemplate.tipe,
      divisiId: penilaianTemplate.divisiId,
      divisiNama: divisi.nama,
      jabatan: penilaianTemplate.jabatan,
      isDefault: penilaianTemplate.isDefault,
      createdBy: penilaianTemplate.createdBy,
      createdAt: penilaianTemplate.createdAt,
      updatedAt: penilaianTemplate.updatedAt,
    })
    .from(penilaianTemplate)
    .leftJoin(divisi, eq(penilaianTemplate.divisiId, divisi.id))
    .where(eq(penilaianTemplate.id, id))
    .limit(1);

  if (!template) return null;

  const items = await db
    .select()
    .from(penilaianTemplateItem)
    .where(eq(penilaianTemplateItem.templateId, id))
    .orderBy(asc(penilaianTemplateItem.nomor));

  return { ...template, items };
}

export async function createTemplate(data: unknown) {
  const session = await requirePermission("penilaianKinerja", "manage");
  const parsed = templateCreateSchema.parse(data);

  const [row] = await db
    .insert(penilaianTemplate)
    .values({
      nama: parsed.nama,
      tipe: parsed.tipe,
      divisiId: parsed.divisiId ?? null,
      jabatan: parsed.jabatan ?? null,
      isDefault: parsed.isDefault ?? false,
      createdBy: session.user.id,
    })
    .returning({ id: penilaianTemplate.id });

  revalidatePath("/penilaian-kinerja/template");
  return { ok: true, id: row!.id };
}

export async function updateTemplate(data: unknown) {
  await requirePermission("penilaianKinerja", "manage");
  const parsed = templateUpdateSchema.parse(data);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.nama !== undefined) updateData.nama = parsed.nama;
  if (parsed.tipe !== undefined) updateData.tipe = parsed.tipe;
  if (parsed.divisiId !== undefined) updateData.divisiId = parsed.divisiId;
  if (parsed.jabatan !== undefined) updateData.jabatan = parsed.jabatan;
  if (parsed.isDefault !== undefined) updateData.isDefault = parsed.isDefault;

  await db
    .update(penilaianTemplate)
    .set(updateData)
    .where(eq(penilaianTemplate.id, parsed.id));

  revalidatePath("/penilaian-kinerja/template");
  return { ok: true };
}

export async function deleteTemplate(data: unknown) {
  await requirePermission("penilaianKinerja", "manage");
  const parsed = templateDeleteSchema.parse(data);

  await db
    .delete(penilaianTemplate)
    .where(eq(penilaianTemplate.id, parsed.id));

  revalidatePath("/penilaian-kinerja/template");
  return { ok: true };
}

export async function duplicateTemplate(id: number) {
  const session = await requirePermission("penilaianKinerja", "manage");

  const original = await getTemplate(id);
  if (!original) return { ok: false, error: "Template tidak ditemukan" };

  // Create new template
  const [newTemplate] = await db
    .insert(penilaianTemplate)
    .values({
      nama: `${original.nama} (Copy)`,
      tipe: original.tipe,
      divisiId: original.divisiId,
      jabatan: original.jabatan,
      isDefault: false,
      createdBy: session.user.id,
    })
    .returning({ id: penilaianTemplate.id });

  // Copy items
  if (original.items.length > 0) {
    await db.insert(penilaianTemplateItem).values(
      original.items.map((item) => ({
        templateId: newTemplate!.id,
        nomor: item.nomor,
        keterangan: item.keterangan,
        bobot: item.bobot,
      })),
    );
  }

  revalidatePath("/penilaian-kinerja/template");
  return { ok: true, id: newTemplate!.id };
}

// ─── TEMPLATE ITEM CRUD ───────────────────────────────────────────────────────

export async function addTemplateItem(data: unknown) {
  await requirePermission("penilaianKinerja", "manage");
  const parsed = templateItemCreateSchema.parse(data);

  const [row] = await db
    .insert(penilaianTemplateItem)
    .values({
      templateId: parsed.templateId,
      nomor: parsed.nomor,
      keterangan: parsed.keterangan,
      bobot: String(parsed.bobot),
    })
    .returning({ id: penilaianTemplateItem.id });

  // Update template updatedAt
  await db
    .update(penilaianTemplate)
    .set({ updatedAt: new Date() })
    .where(eq(penilaianTemplate.id, parsed.templateId));

  revalidatePath("/penilaian-kinerja/template");
  return { ok: true, id: row!.id };
}

export async function updateTemplateItem(data: unknown) {
  await requirePermission("penilaianKinerja", "manage");
  const parsed = templateItemUpdateSchema.parse(data);

  const updateData: Record<string, unknown> = {};
  if (parsed.nomor !== undefined) updateData.nomor = parsed.nomor;
  if (parsed.keterangan !== undefined) updateData.keterangan = parsed.keterangan;
  if (parsed.bobot !== undefined) updateData.bobot = String(parsed.bobot);

  await db
    .update(penilaianTemplateItem)
    .set(updateData)
    .where(eq(penilaianTemplateItem.id, parsed.id));

  revalidatePath("/penilaian-kinerja/template");
  return { ok: true };
}

export async function deleteTemplateItem(data: unknown) {
  await requirePermission("penilaianKinerja", "manage");
  const parsed = templateItemDeleteSchema.parse(data);

  await db
    .delete(penilaianTemplateItem)
    .where(eq(penilaianTemplateItem.id, parsed.id));

  revalidatePath("/penilaian-kinerja/template");
  return { ok: true };
}

export async function bulkCreateTemplateItems(data: unknown) {
  await requirePermission("penilaianKinerja", "manage");
  const parsed = templateItemBulkCreateSchema.parse(data);

  // Delete existing items for this template
  await db
    .delete(penilaianTemplateItem)
    .where(eq(penilaianTemplateItem.templateId, parsed.templateId));

  // Insert new items
  if (parsed.items.length > 0) {
    await db.insert(penilaianTemplateItem).values(
      parsed.items.map((item) => ({
        templateId: parsed.templateId,
        nomor: item.nomor,
        keterangan: item.keterangan,
        bobot: String(item.bobot),
      })),
    );
  }

  // Update template updatedAt
  await db
    .update(penilaianTemplate)
    .set({ updatedAt: new Date() })
    .where(eq(penilaianTemplate.id, parsed.templateId));

  revalidatePath("/penilaian-kinerja/template");
  return { ok: true };
}

// ─── PERIODE CRUD ─────────────────────────────────────────────────────────────

export type PeriodeRow = {
  id: number;
  nama: string;
  tahun: number;
  kuartal: number;
  tanggalMulai: string;
  tanggalSelesai: string;
  status: "open" | "closed";
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export async function listPeriode(): Promise<PeriodeRow[]> {
  await requireSession();

  const rows = await db
    .select()
    .from(penilaianPeriode)
    .orderBy(desc(penilaianPeriode.tahun), desc(penilaianPeriode.kuartal));

  return rows;
}

export async function createPeriode(data: unknown) {
  const session = await requirePermission("penilaianKinerja", "manage");
  const parsed = periodeCreateSchema.parse(data);

  const [row] = await db
    .insert(penilaianPeriode)
    .values({
      nama: parsed.nama,
      tahun: parsed.tahun,
      kuartal: parsed.kuartal,
      tanggalMulai: parsed.tanggalMulai,
      tanggalSelesai: parsed.tanggalSelesai,
      status: "open",
      createdBy: session.user.id,
    })
    .returning({ id: penilaianPeriode.id });

  revalidatePath("/penilaian-kinerja");
  return { ok: true, id: row!.id };
}

export async function updatePeriode(data: unknown) {
  await requirePermission("penilaianKinerja", "manage");
  const parsed = periodeUpdateSchema.parse(data);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.nama !== undefined) updateData.nama = parsed.nama;
  if (parsed.tahun !== undefined) updateData.tahun = parsed.tahun;
  if (parsed.kuartal !== undefined) updateData.kuartal = parsed.kuartal;
  if (parsed.tanggalMulai !== undefined) updateData.tanggalMulai = parsed.tanggalMulai;
  if (parsed.tanggalSelesai !== undefined) updateData.tanggalSelesai = parsed.tanggalSelesai;
  if (parsed.status !== undefined) updateData.status = parsed.status;

  await db
    .update(penilaianPeriode)
    .set(updateData)
    .where(eq(penilaianPeriode.id, parsed.id));

  revalidatePath("/penilaian-kinerja");
  return { ok: true };
}

export async function closePeriode(id: number) {
  await requirePermission("penilaianKinerja", "manage");

  await db
    .update(penilaianPeriode)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(penilaianPeriode.id, id));

  revalidatePath("/penilaian-kinerja");
  return { ok: true };
}

// ─── HELPER: Get total bobot for a template ───────────────────────────────────

export async function getTemplateTotalBobot(templateId: number): Promise<number> {
  const [result] = await db
    .select({
      total: sql<string>`COALESCE(SUM(bobot::numeric), 0)`,
    })
    .from(penilaianTemplateItem)
    .where(eq(penilaianTemplateItem.templateId, templateId));

  return parseFloat(result?.total ?? "0");
}

// ─── PENILAIAN KINERJA CRUD ───────────────────────────────────────────────────

export type PenilaianListRow = {
  id: string;
  periodeId: number;
  periodeNama: string;
  userId: string;
  namaKaryawan: string;
  jabatan: string | null;
  divisiNama: string | null;
  penilaiId: string;
  namaPenilai: string;
  totalNilaiTugas: string | null;
  totalNilaiPerilaku: string | null;
  nilaiAkhir: string | null;
  status: "draft" | "submitted" | "reviewed" | "finalized";
  createdAt: Date;
  updatedAt: Date;
};

export async function listPenilaian(opts?: {
  periodeId?: number;
  userId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: PenilaianListRow[]; total: number }> {
  // Only users with view_all can access penilaian data
  await requirePermission("penilaianKinerja", "create");

  const conditions = [];
  if (opts?.periodeId) {
    conditions.push(eq(penilaianKinerja.periodeId, opts.periodeId));
  }
  if (opts?.status) {
    conditions.push(eq(penilaianKinerja.status, opts.status as any));
  }
  if (opts?.userId) {
    conditions.push(eq(penilaianKinerja.userId, opts.userId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = opts?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const [totalRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(penilaianKinerja)
      .where(where),
    db
      .select({
        id: penilaianKinerja.id,
        periodeId: penilaianKinerja.periodeId,
        periodeNama: penilaianPeriode.nama,
        userId: penilaianKinerja.userId,
        namaKaryawan: users.namaLengkap,
        jabatan: users.jabatan,
        divisiNama: divisi.nama,
        penilaiId: penilaianKinerja.penilaiId,
        namaPenilai: sql<string>`(SELECT nama_lengkap FROM users WHERE id = ${penilaianKinerja.penilaiId})`,
        totalNilaiTugas: penilaianKinerja.totalNilaiTugas,
        totalNilaiPerilaku: penilaianKinerja.totalNilaiPerilaku,
        nilaiAkhir: penilaianKinerja.nilaiAkhir,
        status: penilaianKinerja.status,
        createdAt: penilaianKinerja.createdAt,
        updatedAt: penilaianKinerja.updatedAt,
      })
      .from(penilaianKinerja)
      .innerJoin(users, eq(penilaianKinerja.userId, users.id))
      .innerJoin(penilaianPeriode, eq(penilaianKinerja.periodeId, penilaianPeriode.id))
      .leftJoin(divisi, eq(users.divisiId, divisi.id))
      .where(where)
      .orderBy(desc(penilaianKinerja.createdAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  return {
    rows: rows as PenilaianListRow[],
    total: totalRow[0]?.count ?? 0,
  };
}

export async function createPenilaian(data: unknown) {
  const session = await requirePermission("penilaianKinerja", "create");
  const parsed = penilaianCreateSchema.parse(data);

  // Verify periode is open
  const [periode] = await db
    .select({ status: penilaianPeriode.status })
    .from(penilaianPeriode)
    .where(eq(penilaianPeriode.id, parsed.periodeId))
    .limit(1);

  if (!periode || periode.status !== "open") {
    return { ok: false, error: "Periode sudah ditutup atau tidak ditemukan" };
  }

  // Check if penilaian already exists for this user+periode
  const [existing] = await db
    .select({ id: penilaianKinerja.id })
    .from(penilaianKinerja)
    .where(
      and(
        eq(penilaianKinerja.userId, parsed.userId),
        eq(penilaianKinerja.periodeId, parsed.periodeId),
      ),
    )
    .limit(1);

  if (existing) {
    return { ok: false, error: "Penilaian untuk karyawan ini pada periode tersebut sudah ada" };
  }

  const id = crypto.randomUUID();

  await db.insert(penilaianKinerja).values({
    id,
    periodeId: parsed.periodeId,
    userId: parsed.userId,
    penilaiId: session.user.id,
    templateTugasId: parsed.templateTugasId ?? null,
    templatePerilakuId: parsed.templatePerilakuId ?? null,
    status: "draft",
  });

  revalidatePath("/penilaian-kinerja");
  return { ok: true, id };
}

export type PenilaianDetailFull = {
  id: string;
  periodeId: number;
  periodeNama: string;
  userId: string;
  namaKaryawan: string;
  jabatan: string | null;
  divisiNama: string | null;
  penilaiId: string;
  namaPenilai: string;
  templateTugasId: number | null;
  templatePerilakuId: number | null;
  totalNilaiTugas: string | null;
  totalNilaiPerilaku: string | null;
  nilaiAkhir: string | null;
  status: "draft" | "submitted" | "reviewed" | "finalized";
  catatan: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: number;
    templateItemId: number;
    tipe: "tugas" | "perilaku";
    nilai: number;
    bobot: string;
    nilaiTerbobot: string;
    keterangan: string | null;
    itemKeterangan: string;
    itemNomor: number;
  }[];
};

export async function getPenilaianDetail(id: string): Promise<PenilaianDetailFull | null> {
  // Only users with create/manage capability can view penilaian details
  await requirePermission("penilaianKinerja", "create");

  const [row] = await db
    .select({
      id: penilaianKinerja.id,
      periodeId: penilaianKinerja.periodeId,
      periodeNama: penilaianPeriode.nama,
      userId: penilaianKinerja.userId,
      namaKaryawan: users.namaLengkap,
      jabatan: users.jabatan,
      divisiNama: divisi.nama,
      penilaiId: penilaianKinerja.penilaiId,
      namaPenilai: sql<string>`(SELECT nama_lengkap FROM users WHERE id = ${penilaianKinerja.penilaiId})`,
      templateTugasId: penilaianKinerja.templateTugasId,
      templatePerilakuId: penilaianKinerja.templatePerilakuId,
      totalNilaiTugas: penilaianKinerja.totalNilaiTugas,
      totalNilaiPerilaku: penilaianKinerja.totalNilaiPerilaku,
      nilaiAkhir: penilaianKinerja.nilaiAkhir,
      status: penilaianKinerja.status,
      catatan: penilaianKinerja.catatan,
      reviewedBy: penilaianKinerja.reviewedBy,
      reviewedAt: penilaianKinerja.reviewedAt,
      finalizedAt: penilaianKinerja.finalizedAt,
      createdAt: penilaianKinerja.createdAt,
      updatedAt: penilaianKinerja.updatedAt,
    })
    .from(penilaianKinerja)
    .innerJoin(users, eq(penilaianKinerja.userId, users.id))
    .innerJoin(penilaianPeriode, eq(penilaianKinerja.periodeId, penilaianPeriode.id))
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .where(eq(penilaianKinerja.id, id))
    .limit(1);

  if (!row) return null;

  // Get detail items
  const items = await db
    .select({
      id: penilaianKinerjaDetail.id,
      templateItemId: penilaianKinerjaDetail.templateItemId,
      tipe: penilaianKinerjaDetail.tipe,
      nilai: penilaianKinerjaDetail.nilai,
      bobot: penilaianKinerjaDetail.bobot,
      nilaiTerbobot: penilaianKinerjaDetail.nilaiTerbobot,
      keterangan: penilaianKinerjaDetail.keterangan,
      itemKeterangan: penilaianTemplateItem.keterangan,
      itemNomor: penilaianTemplateItem.nomor,
    })
    .from(penilaianKinerjaDetail)
    .innerJoin(
      penilaianTemplateItem,
      eq(penilaianKinerjaDetail.templateItemId, penilaianTemplateItem.id),
    )
    .where(eq(penilaianKinerjaDetail.penilaianId, id))
    .orderBy(asc(penilaianKinerjaDetail.tipe), asc(penilaianTemplateItem.nomor));

  return { ...(row as any), items } as PenilaianDetailFull;
}

export async function submitPenilaian(data: unknown) {
  const session = await requirePermission("penilaianKinerja", "create");
  const parsed = penilaianSubmitSchema.parse(data);

  // Verify penilaian exists and is draft
  const [existing] = await db
    .select({
      status: penilaianKinerja.status,
      penilaiId: penilaianKinerja.penilaiId,
    })
    .from(penilaianKinerja)
    .where(eq(penilaianKinerja.id, parsed.id))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Penilaian tidak ditemukan" };
  }
  if (existing.status !== "draft") {
    return { ok: false, error: "Penilaian sudah disubmit sebelumnya" };
  }

  // Delete existing details (in case of re-save draft)
  await db
    .delete(penilaianKinerjaDetail)
    .where(eq(penilaianKinerjaDetail.penilaianId, parsed.id));

  // Insert detail items
  await db.insert(penilaianKinerjaDetail).values(
    parsed.items.map((item) => ({
      penilaianId: parsed.id,
      templateItemId: item.templateItemId,
      tipe: item.tipe,
      nilai: item.nilai,
      bobot: String(item.bobot),
      nilaiTerbobot: String(
        parseFloat((item.nilai * item.bobot).toFixed(2)),
      ),
      keterangan: item.keterangan ?? null,
    })),
  );

  // Calculate totals
  const tugasItems = parsed.items.filter((i) => i.tipe === "tugas");
  const perilakuItems = parsed.items.filter((i) => i.tipe === "perilaku");

  const totalTugas = tugasItems.reduce(
    (sum, i) => sum + i.nilai * i.bobot,
    0,
  );
  const totalPerilaku = perilakuItems.reduce(
    (sum, i) => sum + i.nilai * i.bobot,
    0,
  );

  // Hitung nilai akhir berdasarkan komponen yang terisi
  const componentCount = (tugasItems.length > 0 ? 1 : 0) + (perilakuItems.length > 0 ? 1 : 0);
  const nilaiAkhir = componentCount > 0 ? (totalTugas + totalPerilaku) / componentCount : 0;

  // Update penilaian header
  await db
    .update(penilaianKinerja)
    .set({
      totalNilaiTugas: String(totalTugas.toFixed(2)),
      totalNilaiPerilaku: String(totalPerilaku.toFixed(2)),
      nilaiAkhir: String(nilaiAkhir.toFixed(2)),
      status: "submitted",
      catatan: parsed.catatan ?? null,
      updatedAt: new Date(),
    })
    .where(eq(penilaianKinerja.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "submit_penilaian",
    entitasType: "penilaian_kinerja",
    entitasId: parsed.id,
    detail: { nilaiAkhir: nilaiAkhir.toFixed(2) },
  });

  revalidatePath("/penilaian-kinerja");
  return { ok: true };
}

export async function savePenilaianDraft(data: unknown) {
  await requirePermission("penilaianKinerja", "create");
  const parsed = penilaianSubmitSchema.parse(data);

  // Verify penilaian exists and is draft
  const [existing] = await db
    .select({ status: penilaianKinerja.status })
    .from(penilaianKinerja)
    .where(eq(penilaianKinerja.id, parsed.id))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Penilaian tidak ditemukan" };
  }
  if (existing.status !== "draft") {
    return { ok: false, error: "Penilaian sudah tidak bisa diedit" };
  }

  // Delete existing details
  await db
    .delete(penilaianKinerjaDetail)
    .where(eq(penilaianKinerjaDetail.penilaianId, parsed.id));

  // Insert detail items
  if (parsed.items.length > 0) {
    await db.insert(penilaianKinerjaDetail).values(
      parsed.items.map((item) => ({
        penilaianId: parsed.id,
        templateItemId: item.templateItemId,
        tipe: item.tipe,
        nilai: item.nilai,
        bobot: String(item.bobot),
        nilaiTerbobot: String(
          parseFloat((item.nilai * item.bobot).toFixed(2)),
        ),
        keterangan: item.keterangan ?? null,
      })),
    );
  }

  // Calculate totals
  const tugasItems = parsed.items.filter((i) => i.tipe === "tugas");
  const perilakuItems = parsed.items.filter((i) => i.tipe === "perilaku");

  const totalTugas = tugasItems.reduce(
    (sum, i) => sum + i.nilai * i.bobot,
    0,
  );
  const totalPerilaku = perilakuItems.reduce(
    (sum, i) => sum + i.nilai * i.bobot,
    0,
  );

  // Hitung nilai akhir berdasarkan komponen yang terisi
  const componentCount = (tugasItems.length > 0 ? 1 : 0) + (perilakuItems.length > 0 ? 1 : 0);
  const nilaiAkhir = componentCount > 0 ? (totalTugas + totalPerilaku) / componentCount : 0;

  await db
    .update(penilaianKinerja)
    .set({
      totalNilaiTugas: String(totalTugas.toFixed(2)),
      totalNilaiPerilaku: String(totalPerilaku.toFixed(2)),
      nilaiAkhir: String(nilaiAkhir.toFixed(2)),
      catatan: parsed.catatan ?? null,
      updatedAt: new Date(),
    })
    .where(eq(penilaianKinerja.id, parsed.id));

  revalidatePath("/penilaian-kinerja");
  return { ok: true };
}

export async function approvePenilaian(data: unknown) {
  const session = await requirePermission("penilaianKinerja", "approve");
  const parsed = penilaianApproveSchema.parse(data);

  const [existing] = await db
    .select({
      status: penilaianKinerja.status,
      userId: penilaianKinerja.userId,
    })
    .from(penilaianKinerja)
    .where(eq(penilaianKinerja.id, parsed.id))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Penilaian tidak ditemukan" };
  }

  if (parsed.action === "review") {
    if (existing.status !== "submitted") {
      return { ok: false, error: "Penilaian belum disubmit" };
    }
    await db
      .update(penilaianKinerja)
      .set({
        status: "reviewed",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        catatan: parsed.catatan ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(penilaianKinerja.id, parsed.id));
  } else if (parsed.action === "finalize") {
    if (existing.status !== "reviewed" && existing.status !== "submitted") {
      return { ok: false, error: "Penilaian belum di-review" };
    }
    await db
      .update(penilaianKinerja)
      .set({
        status: "finalized",
        reviewedBy: existing.status === "submitted" ? session.user.id : undefined,
        reviewedAt: existing.status === "submitted" ? new Date() : undefined,
        finalizedAt: new Date(),
        catatan: parsed.catatan ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(penilaianKinerja.id, parsed.id));
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: parsed.action === "review" ? "review_penilaian" : "finalize_penilaian",
    entitasType: "penilaian_kinerja",
    entitasId: parsed.id,
    detail: { action: parsed.action },
  });

  revalidatePath("/penilaian-kinerja");
  return { ok: true };
}

export async function deletePenilaian(id: string) {
  const session = await requirePermission("penilaianKinerja", "manage");

  const [existing] = await db
    .select({ status: penilaianKinerja.status })
    .from(penilaianKinerja)
    .where(eq(penilaianKinerja.id, id))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Penilaian tidak ditemukan" };
  }
  if (existing.status === "finalized") {
    return { ok: false, error: "Penilaian yang sudah final tidak bisa dihapus" };
  }

  await db.delete(penilaianKinerja).where(eq(penilaianKinerja.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "delete_penilaian",
    entitasType: "penilaian_kinerja",
    entitasId: id,
    detail: { previousStatus: existing.status },
  });

  revalidatePath("/penilaian-kinerja");
  return { ok: true };
}

// ─── HELPER: List karyawan for penilaian input ────────────────────────────────

export type KaryawanOption = {
  id: string;
  namaLengkap: string;
  jabatan: string | null;
  divisiNama: string | null;
};

export async function listKaryawanForPenilaian(): Promise<KaryawanOption[]> {
  await requirePermission("penilaianKinerja", "create");

  const rows = await db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
      jabatan: users.jabatan,
      divisiNama: divisi.nama,
    })
    .from(users)
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .where(eq(users.isActive, true))
    .orderBy(asc(users.namaLengkap));

  return rows;
}

// ─── HELPER: Get template items for penilaian form ────────────────────────────

export async function getTemplateItemsForForm(templateId: number) {
  await requireSession();

  const items = await db
    .select()
    .from(penilaianTemplateItem)
    .where(eq(penilaianTemplateItem.templateId, templateId))
    .orderBy(asc(penilaianTemplateItem.nomor));

  return items;
}


// ─── REKAP & LAPORAN ──────────────────────────────────────────────────────────

export type RekapPerDivisi = {
  divisiId: number | null;
  divisiNama: string;
  jumlahKaryawan: number;
  rataRataTugas: number;
  rataRataPerilaku: number;
  rataRataNilaiAkhir: number;
};

export async function getRekapPerDivisi(periodeId: number): Promise<RekapPerDivisi[]> {
  await requirePermission("penilaianKinerja", "export");

  const rows = await db
    .select({
      divisiId: users.divisiId,
      divisiNama: sql<string>`COALESCE(${divisi.nama}, 'Tanpa Divisi')`,
      jumlahKaryawan: sql<number>`count(DISTINCT ${penilaianKinerja.userId})::int`,
      rataRataTugas: sql<number>`COALESCE(AVG(${penilaianKinerja.totalNilaiTugas}::numeric), 0)::float`,
      rataRataPerilaku: sql<number>`COALESCE(AVG(${penilaianKinerja.totalNilaiPerilaku}::numeric), 0)::float`,
      rataRataNilaiAkhir: sql<number>`COALESCE(AVG(${penilaianKinerja.nilaiAkhir}::numeric), 0)::float`,
    })
    .from(penilaianKinerja)
    .innerJoin(users, eq(penilaianKinerja.userId, users.id))
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .where(
      and(
        eq(penilaianKinerja.periodeId, periodeId),
        eq(penilaianKinerja.status, "finalized"),
      ),
    )
    .groupBy(users.divisiId, divisi.nama);

  return rows;
}

export type RekapPerKaryawan = {
  userId: string;
  namaKaryawan: string;
  jabatan: string | null;
  divisiNama: string | null;
  totalNilaiTugas: number;
  totalNilaiPerilaku: number;
  nilaiAkhir: number;
};

export async function getRekapPerKaryawan(periodeId: number): Promise<RekapPerKaryawan[]> {
  await requirePermission("penilaianKinerja", "export");

  const rows = await db
    .select({
      userId: penilaianKinerja.userId,
      namaKaryawan: users.namaLengkap,
      jabatan: users.jabatan,
      divisiNama: divisi.nama,
      totalNilaiTugas: sql<number>`COALESCE(${penilaianKinerja.totalNilaiTugas}::numeric, 0)::float`,
      totalNilaiPerilaku: sql<number>`COALESCE(${penilaianKinerja.totalNilaiPerilaku}::numeric, 0)::float`,
      nilaiAkhir: sql<number>`COALESCE(${penilaianKinerja.nilaiAkhir}::numeric, 0)::float`,
    })
    .from(penilaianKinerja)
    .innerJoin(users, eq(penilaianKinerja.userId, users.id))
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .where(
      and(
        eq(penilaianKinerja.periodeId, periodeId),
        eq(penilaianKinerja.status, "finalized"),
      ),
    )
    .orderBy(sql`${penilaianKinerja.nilaiAkhir}::numeric DESC`);

  return rows;
}

export type TrendPenilaian = {
  periodeId: number;
  periodeNama: string;
  kuartal: number;
  tahun: number;
  nilaiAkhir: number;
};

export async function getTrendPenilaian(userId: string): Promise<TrendPenilaian[]> {
  await requirePermission("penilaianKinerja", "export");

  const rows = await db
    .select({
      periodeId: penilaianKinerja.periodeId,
      periodeNama: penilaianPeriode.nama,
      kuartal: penilaianPeriode.kuartal,
      tahun: penilaianPeriode.tahun,
      nilaiAkhir: sql<number>`COALESCE(${penilaianKinerja.nilaiAkhir}::numeric, 0)::float`,
    })
    .from(penilaianKinerja)
    .innerJoin(penilaianPeriode, eq(penilaianKinerja.periodeId, penilaianPeriode.id))
    .where(
      and(
        eq(penilaianKinerja.userId, userId),
        eq(penilaianKinerja.status, "finalized"),
      ),
    )
    .orderBy(asc(penilaianPeriode.tahun), asc(penilaianPeriode.kuartal));

  return rows;
}

export type RekapStatistik = {
  totalKaryawanDinilai: number;
  totalPenilaianFinalized: number;
  rataRataNilaiAkhir: number;
  nilaiTertinggi: number;
  nilaiTerendah: number;
};

export async function getRekapStatistik(periodeId: number): Promise<RekapStatistik> {
  await requirePermission("penilaianKinerja", "export");

  const [row] = await db
    .select({
      totalKaryawanDinilai: sql<number>`count(DISTINCT ${penilaianKinerja.userId})::int`,
      totalPenilaianFinalized: sql<number>`count(*)::int`,
      rataRataNilaiAkhir: sql<number>`COALESCE(AVG(${penilaianKinerja.nilaiAkhir}::numeric), 0)::float`,
      nilaiTertinggi: sql<number>`COALESCE(MAX(${penilaianKinerja.nilaiAkhir}::numeric), 0)::float`,
      nilaiTerendah: sql<number>`COALESCE(MIN(${penilaianKinerja.nilaiAkhir}::numeric), 0)::float`,
    })
    .from(penilaianKinerja)
    .where(
      and(
        eq(penilaianKinerja.periodeId, periodeId),
        eq(penilaianKinerja.status, "finalized"),
      ),
    );

  return row ?? {
    totalKaryawanDinilai: 0,
    totalPenilaianFinalized: 0,
    rataRataNilaiAkhir: 0,
    nilaiTertinggi: 0,
    nilaiTerendah: 0,
  };
}
