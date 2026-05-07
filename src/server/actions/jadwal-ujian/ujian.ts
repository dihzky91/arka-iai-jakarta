"use server";

import { asc, desc, eq, sql, and, gte, lte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateDashboardTag } from "@/server/actions/statistics";
import { DASHBOARD_TAGS } from "@/lib/dashboard-cache-tags";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  jadwalUjian,
  kelasUjian,
  penugasanPengawas,
  pengawas,
  adminJaga,
  auditLog,
} from "@/server/db/schema";

async function buildAdminJagaKonflikMap(
  pengawasIds: string[],
  tanggalUjian: string,
  jamMulai: string,
  jamSelesai: string,
  excludeUjianId: string,
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const pgId of pengawasIds) {
    const existing = await db
      .select({
        ujianId: adminJaga.ujianId,
        jamMulai: jadwalUjian.jamMulai,
        jamSelesai: jadwalUjian.jamSelesai,
      })
      .from(adminJaga)
      .leftJoin(jadwalUjian, eq(adminJaga.ujianId, jadwalUjian.id))
      .where(and(eq(adminJaga.pengawasId, pgId), eq(jadwalUjian.tanggalUjian, tanggalUjian)));
    result[pgId] = existing.some((e) => {
      if (e.ujianId === excludeUjianId) return false;
      if (!e.jamMulai || !e.jamSelesai) return false;
      return jamMulai < e.jamSelesai && jamSelesai > e.jamMulai;
    });
  }
  return result;
}

async function buildKonflikMap(
  pengawasIds: string[],
  tanggalUjian: string,
  jamMulai: string,
  jamSelesai: string,
  excludeUjianId: string,
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const pgId of pengawasIds) {
    const existing = await db
      .select({
        ujianId: penugasanPengawas.ujianId,
        jamMulai: jadwalUjian.jamMulai,
        jamSelesai: jadwalUjian.jamSelesai,
      })
      .from(penugasanPengawas)
      .leftJoin(jadwalUjian, eq(penugasanPengawas.ujianId, jadwalUjian.id))
      .where(and(eq(penugasanPengawas.pengawasId, pgId), eq(jadwalUjian.tanggalUjian, tanggalUjian)));
    result[pgId] = existing.some((e) => {
      if (e.ujianId === excludeUjianId) return false;
      if (!e.jamMulai || !e.jamSelesai) return false;
      return jamMulai < e.jamSelesai && jamSelesai > e.jamMulai;
    });
  }
  return result;
}
import { requirePermission, requireSession } from "@/server/actions/auth";
import {
  syncUjianEvent,
  removeUjianEvent,
  syncPenugasanPengawasEvent,
  removePenugasanPengawasEvent,
  syncAdminJagaEvent,
  removeAdminJagaEvent,
} from "@/server/actions/calendar";
import {
  ujianCreateSchema,
  ujianUpdateSchema,
  type UjianCreateInput,
  type UjianUpdateInput,
  type UjianFilter,
} from "@/lib/validators/jadwalUjian.schema";

export type UjianRow = {
  id: string;
  kelasId: string;
  namaKelas: string;
  program: string;
  tipe: string;
  mode: string;
  mataPelajaran: string[];
  tanggalUjian: string;
  jamMulai: string;
  jamSelesai: string;
  catatan: string | null;
  jumlahPengawas: number;
  adaKonflik: boolean;
  jumlahAdminJaga: number;
  adaKonflikAdminJaga: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UjianDetail = UjianRow & {
  penugasan: {
    id: string;
    pengawasId: string;
    namaPengawas: string;
    konflik: boolean;
    createdAt: Date;
  }[];
  adminJagaList: {
    id: string;
    pengawasId: string;
    namaPengawas: string;
    catatan: string | null;
    konflik: boolean;
    createdAt: Date;
  }[];
};

export type UjianListResult = {
  rows: UjianRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listUjian(filter: UjianFilter = {}): Promise<UjianListResult> {
  await requireSession();

  const page = Math.max(1, filter.page ?? 1);
  const pageSize = filter.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filter.tanggalMulai) conditions.push(gte(jadwalUjian.tanggalUjian, filter.tanggalMulai));
  if (filter.tanggalSelesai) conditions.push(lte(jadwalUjian.tanggalUjian, filter.tanggalSelesai));
  if (filter.kelasId) conditions.push(eq(jadwalUjian.kelasId, filter.kelasId));
  if (filter.program) conditions.push(eq(kelasUjian.program, filter.program));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const ajAlias = db.$with("aj_counts").as(
    db
      .select({
        ujianId: adminJaga.ujianId,
        jumlah: sql<number>`count(*)::int`.as("jumlah"),
        adaKonflik: sql<boolean>`bool_or(${adminJaga.konflik})`.as("ada_konflik"),
      })
      .from(adminJaga)
      .groupBy(adminJaga.ujianId),
  );

  const [totalResult, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(distinct ${jadwalUjian.id})::int` })
      .from(jadwalUjian)
      .leftJoin(kelasUjian, eq(jadwalUjian.kelasId, kelasUjian.id))
      .where(where),
    db
      .with(ajAlias)
      .select({
        id: jadwalUjian.id,
        kelasId: jadwalUjian.kelasId,
        namaKelas: kelasUjian.namaKelas,
        program: kelasUjian.program,
        tipe: kelasUjian.tipe,
        mode: kelasUjian.mode,
        mataPelajaran: jadwalUjian.mataPelajaran,
        tanggalUjian: jadwalUjian.tanggalUjian,
        jamMulai: jadwalUjian.jamMulai,
        jamSelesai: jadwalUjian.jamSelesai,
        catatan: jadwalUjian.catatan,
        jumlahPengawas: sql<number>`count(${penugasanPengawas.id})::int`.as("jumlah_pengawas"),
        adaKonflik: sql<boolean>`bool_or(${penugasanPengawas.konflik})`.as("ada_konflik"),
        jumlahAdminJaga: sql<number>`coalesce(${ajAlias.jumlah}, 0)::int`.as("jumlah_admin_jaga"),
        adaKonflikAdminJaga: sql<boolean>`coalesce(${ajAlias.adaKonflik}, false)`.as("ada_konflik_admin_jaga"),
        createdAt: jadwalUjian.createdAt,
        updatedAt: jadwalUjian.updatedAt,
      })
      .from(jadwalUjian)
      .leftJoin(kelasUjian, eq(jadwalUjian.kelasId, kelasUjian.id))
      .leftJoin(penugasanPengawas, eq(penugasanPengawas.ujianId, jadwalUjian.id))
      .leftJoin(ajAlias, eq(ajAlias.ujianId, jadwalUjian.id))
      .where(where)
      .groupBy(jadwalUjian.id, kelasUjian.id, ajAlias.jumlah, ajAlias.adaKonflik)
      .orderBy(desc(jadwalUjian.tanggalUjian), asc(jadwalUjian.jamMulai))
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = totalResult[0]?.total ?? 0;
  return {
    rows: rows as UjianRow[],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getUjianById(id: string): Promise<UjianDetail | null> {
  await requireSession();

  const ujianRows = await db
    .select({
      id: jadwalUjian.id,
      kelasId: jadwalUjian.kelasId,
      namaKelas: kelasUjian.namaKelas,
      program: kelasUjian.program,
      tipe: kelasUjian.tipe,
      mode: kelasUjian.mode,
      mataPelajaran: jadwalUjian.mataPelajaran,
      tanggalUjian: jadwalUjian.tanggalUjian,
      jamMulai: jadwalUjian.jamMulai,
      jamSelesai: jadwalUjian.jamSelesai,
      catatan: jadwalUjian.catatan,
      createdAt: jadwalUjian.createdAt,
      updatedAt: jadwalUjian.updatedAt,
    })
    .from(jadwalUjian)
    .leftJoin(kelasUjian, eq(jadwalUjian.kelasId, kelasUjian.id))
    .where(eq(jadwalUjian.id, id));

  const ujian = ujianRows[0];
  if (!ujian) return null;

  const penugasanRows = await db
    .select({
      id: penugasanPengawas.id,
      pengawasId: penugasanPengawas.pengawasId,
      namaPengawas: pengawas.nama,
      konflik: penugasanPengawas.konflik,
      createdAt: penugasanPengawas.createdAt,
    })
    .from(penugasanPengawas)
    .leftJoin(pengawas, eq(penugasanPengawas.pengawasId, pengawas.id))
    .where(eq(penugasanPengawas.ujianId, id))
    .orderBy(asc(pengawas.nama));

  const adminJagaRows = await db
    .select({
      id: adminJaga.id,
      pengawasId: adminJaga.pengawasId,
      namaPengawas: pengawas.nama,
      catatan: adminJaga.catatan,
      konflik: adminJaga.konflik,
      createdAt: adminJaga.createdAt,
    })
    .from(adminJaga)
    .leftJoin(pengawas, eq(adminJaga.pengawasId, pengawas.id))
    .where(eq(adminJaga.ujianId, id))
    .orderBy(asc(pengawas.nama));

  const jumlahPengawas = penugasanRows.length;
  const adaKonflik = penugasanRows.some((p) => p.konflik);
  const jumlahAdminJaga = adminJagaRows.length;
  const adaKonflikAdminJaga = adminJagaRows.some((a) => a.konflik);

  return {
    ...(ujian as Omit<UjianRow, "jumlahPengawas" | "adaKonflik" | "jumlahAdminJaga" | "adaKonflikAdminJaga">),
    jumlahPengawas,
    adaKonflik,
    jumlahAdminJaga,
    adaKonflikAdminJaga,
    penugasan: penugasanRows as UjianDetail["penugasan"],
    adminJagaList: adminJagaRows as UjianDetail["adminJagaList"],
  };
}

export async function createUjian(data: UjianCreateInput & { pengawasIds?: string[]; adminJagaIds?: string[] }) {
  const parsed = ujianCreateSchema.parse(data);
  const pengawasIds = data.pengawasIds ?? [];
  const adminJagaIds = [...new Set(data.adminJagaIds ?? [])];
  const session = await requirePermission("jadwalUjian", "manage");

  const id = nanoid();
  const rows = await db
    .insert(jadwalUjian)
    .values({
      id,
      kelasId: parsed.kelasId,
      mataPelajaran: parsed.mataPelajaran,
      tanggalUjian: parsed.tanggalUjian,
      jamMulai: parsed.jamMulai,
      jamSelesai: parsed.jamSelesai,
      catatan: parsed.catatan || null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Gagal membuat jadwal ujian");

  const konflikIds: string[] = [];
  if (pengawasIds.length > 0) {
    const konflikMap = await buildKonflikMap(pengawasIds, parsed.tanggalUjian, parsed.jamMulai, parsed.jamSelesai, id);
    await db.insert(penugasanPengawas).values(
      pengawasIds.map((pgId) => ({
        id: nanoid(),
        ujianId: id,
        pengawasId: pgId,
        konflik: konflikMap[pgId] ?? false,
      })),
    );
    konflikIds.push(...pengawasIds.filter((pgId) => konflikMap[pgId]));
  }

  const konflikAdminJagaIds: string[] = [];
  if (adminJagaIds.length > 0) {
    const konflikMap = await buildAdminJagaKonflikMap(adminJagaIds, parsed.tanggalUjian, parsed.jamMulai, parsed.jamSelesai, id);
    await db.insert(adminJaga).values(
      adminJagaIds.map((pgId) => ({
        id: nanoid(),
        ujianId: id,
        pengawasId: pgId,
        konflik: konflikMap[pgId] ?? false,
      })),
    );
    konflikAdminJagaIds.push(...adminJagaIds.filter((pgId) => konflikMap[pgId]));
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_JADWAL_UJIAN",
    entitasType: "jadwal_ujian",
    entitasId: id,
    detail: {
      mataPelajaran: parsed.mataPelajaran,
      tanggalUjian: parsed.tanggalUjian,
      jamMulai: parsed.jamMulai,
      jamSelesai: parsed.jamSelesai,
      jumlahPengawas: pengawasIds.length,
      jumlahAdminJaga: adminJagaIds.length,
    },
  });

  // Sync to calendar
  const [kelas] = await db
    .select({ namaKelas: kelasUjian.namaKelas })
    .from(kelasUjian)
    .where(eq(kelasUjian.id, parsed.kelasId));
  const namaKelas = kelas?.namaKelas ?? "";

  const pengawasList = pengawasIds.length > 0
    ? await db.select({ id: pengawas.id, nama: pengawas.nama }).from(pengawas).where(inArray(pengawas.id, pengawasIds))
    : [];
  const pengawasNama = pengawasList.map((p) => p.nama);
  const pengawasMap = new Map(pengawasList.map((p) => [p.id, p.nama]));

  const adminJagaLookup = adminJagaIds.length > 0
    ? await db.select({ id: pengawas.id, nama: pengawas.nama }).from(pengawas).where(inArray(pengawas.id, adminJagaIds))
    : [];
  const adminJagaNama = adminJagaLookup.map((p) => p.nama);
  const adminJagaMap = new Map(adminJagaLookup.map((p) => [p.id, p.nama]));

  await syncUjianEvent(id, parsed.mataPelajaran, namaKelas, parsed.tanggalUjian, parsed.jamMulai, parsed.jamSelesai, parsed.catatan ?? null, pengawasNama, adminJagaNama);

  const insertedPenugasan = await db
    .select({ id: penugasanPengawas.id, pengawasId: penugasanPengawas.pengawasId })
    .from(penugasanPengawas)
    .where(eq(penugasanPengawas.ujianId, id));
  for (const p of insertedPenugasan) {
    await syncPenugasanPengawasEvent(p.id, pengawasMap.get(p.pengawasId) ?? "", parsed.mataPelajaran, namaKelas, parsed.tanggalUjian, parsed.jamMulai, parsed.jamSelesai);
  }

  const insertedAdminJaga = await db
    .select({ id: adminJaga.id, pengawasId: adminJaga.pengawasId })
    .from(adminJaga)
    .where(eq(adminJaga.ujianId, id));
  for (const a of insertedAdminJaga) {
    await syncAdminJagaEvent(a.id, adminJagaMap.get(a.pengawasId) ?? "", parsed.mataPelajaran, namaKelas, parsed.tanggalUjian, parsed.jamMulai, parsed.jamSelesai);
  }

  revalidatePath("/jadwal-ujian");
  revalidateDashboardTag(DASHBOARD_TAGS.ujian);
  revalidatePath("/jadwal-ujian/admin-jaga");
  revalidatePath("/kalender");
  return { ok: true as const, data: row, konflikPengawasIds: konflikIds, konflikAdminJagaIds };
}

export async function updateUjian(data: UjianUpdateInput & { pengawasIds?: string[]; adminJagaIds?: string[] }) {
  const parsed = ujianUpdateSchema.parse(data);
  const session = await requirePermission("jadwalUjian", "manage");

  const rows = await db
    .update(jadwalUjian)
    .set({
      kelasId: parsed.kelasId,
      mataPelajaran: parsed.mataPelajaran,
      tanggalUjian: parsed.tanggalUjian,
      jamMulai: parsed.jamMulai,
      jamSelesai: parsed.jamSelesai,
      catatan: parsed.catatan || null,
      updatedAt: new Date(),
    })
    .where(eq(jadwalUjian.id, parsed.id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false as const, error: "Jadwal ujian tidak ditemukan." };

  const konflikIds: string[] = [];
  if (data.pengawasIds !== undefined) {
    await db.delete(penugasanPengawas).where(eq(penugasanPengawas.ujianId, parsed.id));
    if (data.pengawasIds.length > 0) {
      const konflikMap = await buildKonflikMap(data.pengawasIds, parsed.tanggalUjian, parsed.jamMulai, parsed.jamSelesai, parsed.id);
      await db.insert(penugasanPengawas).values(
        data.pengawasIds.map((pgId) => ({
          id: nanoid(),
          ujianId: parsed.id,
          pengawasId: pgId,
          konflik: konflikMap[pgId] ?? false,
        })),
      );
      konflikIds.push(...data.pengawasIds.filter((pgId) => konflikMap[pgId]));
    }
  }

  const konflikAdminJagaIds: string[] = [];
  if (data.adminJagaIds !== undefined) {
    const adminJagaIds = [...new Set(data.adminJagaIds)];
    await db.delete(adminJaga).where(eq(adminJaga.ujianId, parsed.id));
    if (adminJagaIds.length > 0) {
      const konflikMap = await buildAdminJagaKonflikMap(adminJagaIds, parsed.tanggalUjian, parsed.jamMulai, parsed.jamSelesai, parsed.id);
      await db.insert(adminJaga).values(
        adminJagaIds.map((pgId) => ({
          id: nanoid(),
          ujianId: parsed.id,
          pengawasId: pgId,
          konflik: konflikMap[pgId] ?? false,
        })),
      );
      konflikAdminJagaIds.push(...adminJagaIds.filter((pgId) => konflikMap[pgId]));
    }
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_JADWAL_UJIAN",
    entitasType: "jadwal_ujian",
    entitasId: parsed.id,
    detail: {
      mataPelajaran: parsed.mataPelajaran,
      tanggalUjian: parsed.tanggalUjian,
      jamMulai: parsed.jamMulai,
      jamSelesai: parsed.jamSelesai,
    },
  });

  // Sync to calendar
  const [kelas] = await db
    .select({ namaKelas: kelasUjian.namaKelas })
    .from(kelasUjian)
    .where(eq(kelasUjian.id, parsed.kelasId));
  const namaKelas = kelas?.namaKelas ?? "";

  const currentPenugasan = await db
    .select({ id: penugasanPengawas.id, pengawasId: penugasanPengawas.pengawasId })
    .from(penugasanPengawas)
    .where(eq(penugasanPengawas.ujianId, parsed.id));
  const ppIds = currentPenugasan.map((p) => p.pengawasId);
  const ppList = ppIds.length > 0
    ? await db.select({ id: pengawas.id, nama: pengawas.nama }).from(pengawas).where(inArray(pengawas.id, ppIds))
    : [];
  const ppMap = new Map(ppList.map((p) => [p.id, p.nama]));
  const ppNama = ppList.map((p) => p.nama);

  const currentAdminJaga = await db
    .select({ id: adminJaga.id, pengawasId: adminJaga.pengawasId })
    .from(adminJaga)
    .where(eq(adminJaga.ujianId, parsed.id));
  const ajIds = currentAdminJaga.map((a) => a.pengawasId);
  const ajList = ajIds.length > 0
    ? await db.select({ id: pengawas.id, nama: pengawas.nama }).from(pengawas).where(inArray(pengawas.id, ajIds))
    : [];
  const ajMap = new Map(ajList.map((a) => [a.id, a.nama]));
  const ajNama = ajList.map((a) => a.nama);

  await syncUjianEvent(parsed.id, parsed.mataPelajaran, namaKelas, parsed.tanggalUjian, parsed.jamMulai, parsed.jamSelesai, parsed.catatan ?? null, ppNama, ajNama);

  for (const p of currentPenugasan) {
    await syncPenugasanPengawasEvent(p.id, ppMap.get(p.pengawasId) ?? "", parsed.mataPelajaran, namaKelas, parsed.tanggalUjian, parsed.jamMulai, parsed.jamSelesai);
  }
  for (const a of currentAdminJaga) {
    await syncAdminJagaEvent(a.id, ajMap.get(a.pengawasId) ?? "", parsed.mataPelajaran, namaKelas, parsed.tanggalUjian, parsed.jamMulai, parsed.jamSelesai);
  }

  revalidatePath("/jadwal-ujian");
  revalidateDashboardTag(DASHBOARD_TAGS.ujian);
  revalidatePath(`/jadwal-ujian/${parsed.id}`);
  revalidatePath("/jadwal-ujian/admin-jaga");
  revalidatePath("/kalender");
  return { ok: true as const, data: row, konflikPengawasIds: konflikIds, konflikAdminJagaIds };
}

export async function deleteUjian(id: string) {
  const session = await requirePermission("jadwalUjian", "configure");

  const ujianRows = await db
    .select({ mataPelajaran: jadwalUjian.mataPelajaran })
    .from(jadwalUjian)
    .where(eq(jadwalUjian.id, id));
  if (!ujianRows[0]) return { ok: false as const, error: "Jadwal ujian tidak ditemukan." };

  // Remove calendar events before cascade delete
  await removeUjianEvent(id);
  const penugasanToRemove = await db
    .select({ id: penugasanPengawas.id })
    .from(penugasanPengawas)
    .where(eq(penugasanPengawas.ujianId, id));
  for (const p of penugasanToRemove) {
    await removePenugasanPengawasEvent(p.id);
  }
  const adminJagaToRemove = await db
    .select({ id: adminJaga.id })
    .from(adminJaga)
    .where(eq(adminJaga.ujianId, id));
  for (const a of adminJagaToRemove) {
    await removeAdminJagaEvent(a.id);
  }

  // Cascade delete penugasan_pengawas otomatis via FK
  await db.delete(jadwalUjian).where(eq(jadwalUjian.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_JADWAL_UJIAN",
    entitasType: "jadwal_ujian",
    entitasId: id,
    detail: { mataPelajaran: ujianRows[0].mataPelajaran },
  });

  revalidatePath("/jadwal-ujian");
  revalidateDashboardTag(DASHBOARD_TAGS.ujian);
  revalidatePath("/kalender");
  return { ok: true as const };
}

// Kembalikan data mentah untuk diolah XLSX di sisi client
export type UjianExportRow = {
  tanggalUjian: string;
  jamMulai: string;
  jamSelesai: string;
  namaKelas: string;
  program: string;
  tipe: string;
  mode: string;
  mataPelajaran: string[];
  pengawas: string;
  adminJaga: string;
  catatan: string | null;
};

export async function getUjianForExport(filter: UjianFilter = {}): Promise<UjianExportRow[]> {
  await requireSession();

  const conditions = [];
  if (filter.tanggalMulai) conditions.push(gte(jadwalUjian.tanggalUjian, filter.tanggalMulai));
  if (filter.tanggalSelesai) conditions.push(lte(jadwalUjian.tanggalUjian, filter.tanggalSelesai));
  if (filter.kelasId) conditions.push(eq(jadwalUjian.kelasId, filter.kelasId));
  if (filter.program) conditions.push(eq(kelasUjian.program, filter.program));

  const ajSubquery = db.$with("aj_export").as(
    db
      .select({
        ujianId: adminJaga.ujianId,
        namaList: sql<string>`string_agg(${pengawas.nama}, ', ' order by ${pengawas.nama})`.as("nama_list"),
      })
      .from(adminJaga)
      .leftJoin(pengawas, eq(adminJaga.pengawasId, pengawas.id))
      .groupBy(adminJaga.ujianId),
  );

  const rows = await db
    .with(ajSubquery)
    .select({
      tanggalUjian: jadwalUjian.tanggalUjian,
      jamMulai: jadwalUjian.jamMulai,
      jamSelesai: jadwalUjian.jamSelesai,
      namaKelas: kelasUjian.namaKelas,
      program: kelasUjian.program,
      tipe: kelasUjian.tipe,
      mode: kelasUjian.mode,
      mataPelajaran: jadwalUjian.mataPelajaran,
      pengawas: sql<string>`coalesce(string_agg(${pengawas.nama}, ', ' order by ${pengawas.nama}), '-')`.as("pengawas"),
      adminJaga: sql<string>`coalesce(${ajSubquery.namaList}, '-')`.as("admin_jaga"),
      catatan: jadwalUjian.catatan,
    })
    .from(jadwalUjian)
    .leftJoin(kelasUjian, eq(jadwalUjian.kelasId, kelasUjian.id))
    .leftJoin(penugasanPengawas, eq(penugasanPengawas.ujianId, jadwalUjian.id))
    .leftJoin(pengawas, eq(penugasanPengawas.pengawasId, pengawas.id))
    .leftJoin(ajSubquery, eq(ajSubquery.ujianId, jadwalUjian.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(jadwalUjian.id, kelasUjian.id, ajSubquery.namaList)
    .orderBy(asc(jadwalUjian.tanggalUjian), asc(jadwalUjian.jamMulai));

  return rows as UjianExportRow[];
}
