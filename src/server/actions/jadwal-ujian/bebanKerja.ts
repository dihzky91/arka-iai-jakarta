"use server";

import { asc, eq, sql, and, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { penugasanPengawas, jadwalUjian, kelasUjian, pengawas } from "@/server/db/schema";
import { requireSession } from "@/server/actions/auth";
import { bebanKerjaFilterSchema, type BebanKerjaFilter } from "@/lib/validators/jadwalUjian.schema";
import {
  addDaysToIsoDate,
  getMonthRangeInJakarta,
  getTodayIsoInJakarta,
  getWeekdayInJakarta,
} from "@/lib/utils";

export type BebanKerjaRow = {
  pengawasId: string;
  namaPengawas: string;
  jumlahTugas: number;
  jumlahKonflik: number;
};

export type StatistikUjian = {
  totalHariIni: number;
  totalMingguIni: number;
  totalBulanIni: number;
  totalPengawasAktif: number;
};

function getPeriodRange(bulan?: number, tahun?: number): { start: string; end: string } | null {
  if (!bulan || !tahun) return null;
  const start = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const lastDay = new Date(tahun, bulan, 0).getDate();
  const end = `${tahun}-${String(bulan).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export async function getBebanKerja(rawFilter: BebanKerjaFilter = {}): Promise<BebanKerjaRow[]> {
  await requireSession();
  const filter = bebanKerjaFilterSchema.parse(rawFilter);

  const conditions = [];
  const range = getPeriodRange(filter.bulan, filter.tahun);
  if (range) {
    conditions.push(gte(jadwalUjian.tanggalUjian, range.start));
    conditions.push(lte(jadwalUjian.tanggalUjian, range.end));
  }
  if (filter.program) {
    conditions.push(eq(kelasUjian.program, filter.program));
  }

  const rows = await db
    .select({
      pengawasId: pengawas.id,
      namaPengawas: pengawas.nama,
      jumlahTugas: sql<number>`count(${penugasanPengawas.id})::int`.as("jumlah_tugas"),
      jumlahKonflik:
        sql<number>`count(${penugasanPengawas.id}) filter (where ${penugasanPengawas.konflik} = true)::int`.as(
          "jumlah_konflik",
        ),
    })
    .from(pengawas)
    .leftJoin(
      penugasanPengawas,
      and(
        eq(penugasanPengawas.pengawasId, pengawas.id),
        conditions.length > 0
          ? and(
              ...(conditions.length === 1
                ? [conditions[0]!]
                : [conditions[0]!, ...conditions.slice(1)]),
            )
          : undefined,
      ),
    )
    .leftJoin(jadwalUjian, eq(penugasanPengawas.ujianId, jadwalUjian.id))
    .leftJoin(kelasUjian, eq(jadwalUjian.kelasId, kelasUjian.id))
    .groupBy(pengawas.id)
    .orderBy(asc(pengawas.nama));

  return rows;
}

export async function getStatistikUjian(): Promise<StatistikUjian> {
  await requireSession();

  const now = new Date();
  const todayStr = getTodayIsoInJakarta(now);
  const weekday = getWeekdayInJakarta(now);
  const weekStart = addDaysToIsoDate(todayStr, -weekday);
  const weekEnd = addDaysToIsoDate(weekStart, 6);
  const { start: monthStart, end: monthEnd } = getMonthRangeInJakarta(now);

  const [hariIniResult, mingguIniResult, bulanIniResult, pengawasResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jadwalUjian)
      .where(eq(jadwalUjian.tanggalUjian, todayStr)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jadwalUjian)
      .where(and(gte(jadwalUjian.tanggalUjian, weekStart), lte(jadwalUjian.tanggalUjian, weekEnd))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jadwalUjian)
      .where(
        and(gte(jadwalUjian.tanggalUjian, monthStart), lte(jadwalUjian.tanggalUjian, monthEnd)),
      ),
    db.select({ count: sql<number>`count(*)::int` }).from(pengawas),
  ]);

  return {
    totalHariIni: hariIniResult[0]?.count ?? 0,
    totalMingguIni: mingguIniResult[0]?.count ?? 0,
    totalBulanIni: bulanIniResult[0]?.count ?? 0,
    totalPengawasAktif: pengawasResult[0]?.count ?? 0,
  };
}
