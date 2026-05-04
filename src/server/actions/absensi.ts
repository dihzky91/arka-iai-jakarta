"use server";

import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { absensiKaryawan, users } from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";

export type AbsensiRow = {
  id: string;
  userId: string | null;
  namaUser: string | null;
  dingtalkUserId: string | null;
  dingtalkNama: string | null;
  tanggal: string;
  jamMasuk: Date | null;
  jamPulang: Date | null;
  status: string;
  keterlambatanMenit: number | null;
  sumber: string;
  catatan: string | null;
};

export async function listAbsensiKaryawan(opts?: {
  userId?: string;
  tanggalMulai?: string;
  tanggalSelesai?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  await requirePermission("absensi", "view");

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = opts?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof eq>[] = [];

  if (opts?.userId) conditions.push(eq(absensiKaryawan.userId, opts.userId));
  if (opts?.status) conditions.push(eq(absensiKaryawan.status, opts.status as any));
  if (opts?.tanggalMulai) conditions.push(gte(absensiKaryawan.tanggal, opts.tanggalMulai));
  if (opts?.tanggalSelesai) conditions.push(lte(absensiKaryawan.tanggal, opts.tanggalSelesai));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(absensiKaryawan)
      .where(where),
    db
      .select({
        id: absensiKaryawan.id,
        userId: absensiKaryawan.userId,
        namaUser: users.namaLengkap,
        dingtalkUserId: absensiKaryawan.dingtalkUserId,
        dingtalkNama: absensiKaryawan.dingtalkNama,
        tanggal: absensiKaryawan.tanggal,
        jamMasuk: absensiKaryawan.jamMasuk,
        jamPulang: absensiKaryawan.jamPulang,
        status: absensiKaryawan.status,
        keterlambatanMenit: absensiKaryawan.keterlambatanMenit,
        sumber: absensiKaryawan.sumber,
        catatan: absensiKaryawan.catatan,
      })
      .from(absensiKaryawan)
      .leftJoin(users, eq(absensiKaryawan.userId, users.id))
      .where(where)
      .orderBy(desc(absensiKaryawan.tanggal))
      .limit(pageSize)
      .offset(offset),
  ]);

  return {
    rows,
    total: totalRow[0]?.total ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((totalRow[0]?.total ?? 0) / pageSize)),
  };
}

export type AbsensiStats = {
  hadir: number;
  terlambat: number;
  alpha: number;
  total: number;
};

export async function getAbsensiStats(opts?: {
  userId?: string;
  tanggalMulai?: string;
  tanggalSelesai?: string;
}): Promise<AbsensiStats> {
  await requirePermission("absensi", "view");

  const conditions: ReturnType<typeof eq | typeof gte | typeof lte>[] = [];

  if (opts?.userId) conditions.push(eq(absensiKaryawan.userId, opts.userId));
  if (opts?.tanggalMulai) conditions.push(gte(absensiKaryawan.tanggal, opts.tanggalMulai));
  if (opts?.tanggalSelesai) conditions.push(lte(absensiKaryawan.tanggal, opts.tanggalSelesai));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      status: absensiKaryawan.status,
      count: sql<number>`count(*)::int`,
    })
    .from(absensiKaryawan)
    .where(where)
    .groupBy(absensiKaryawan.status);

  const stats: AbsensiStats = { hadir: 0, terlambat: 0, alpha: 0, total: 0 };

  for (const row of rows) {
    if (row.status === "hadir") stats.hadir = row.count;
    else if (row.status === "terlambat") stats.terlambat = row.count;
    else if (row.status === "alpha") stats.alpha = row.count;
    stats.total += row.count;
  }

  return stats;
}

export async function listUsersWithDingtalk() {
  await requirePermission("absensi", "view");

  return db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
      dingtalkUserId: users.dingtalkUserId,
    })
    .from(users)
    .where(sql`${users.dingtalkUserId} IS NOT NULL`)
    .orderBy(users.namaLengkap);
}
