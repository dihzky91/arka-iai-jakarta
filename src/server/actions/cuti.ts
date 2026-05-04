"use server";

import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { pengajuanCuti, users } from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";

export type CutiRow = {
  id: string;
  userId: string;
  namaUser: string | null;
  jenisCuti: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: number;
  alasan: string | null;
  status: string;
  dingtalkProcessId: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  lampiranUrl: string | null;
  createdAt: Date | null;
};

export async function listPengajuanCuti(opts?: {
  userId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  await requirePermission("cuti", "view");

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = opts?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof eq>[] = [];

  if (opts?.userId) conditions.push(eq(pengajuanCuti.userId, opts.userId));
  if (opts?.status) conditions.push(eq(pengajuanCuti.status, opts.status as any));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(pengajuanCuti)
      .where(where),
    db
      .select({
        id: pengajuanCuti.id,
        userId: pengajuanCuti.userId,
        namaUser: users.namaLengkap,
        jenisCuti: pengajuanCuti.jenisCuti,
        tanggalMulai: pengajuanCuti.tanggalMulai,
        tanggalSelesai: pengajuanCuti.tanggalSelesai,
        jumlahHari: pengajuanCuti.jumlahHari,
        alasan: pengajuanCuti.alasan,
        status: pengajuanCuti.status,
        dingtalkProcessId: pengajuanCuti.dingtalkProcessId,
        approvedBy: pengajuanCuti.approvedBy,
        approvedAt: pengajuanCuti.approvedAt,
        rejectedReason: pengajuanCuti.rejectedReason,
        lampiranUrl: pengajuanCuti.lampiranUrl,
        createdAt: pengajuanCuti.createdAt,
      })
      .from(pengajuanCuti)
      .leftJoin(users, eq(pengajuanCuti.userId, users.id))
      .where(where)
      .orderBy(desc(pengajuanCuti.createdAt))
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
