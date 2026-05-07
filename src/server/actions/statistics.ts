"use server";

import { unstable_cache, updateTag } from "next/cache";
import { db } from "@/server/db";
import {
  suratKeluar,
  suratMasuk,
  disposisi,
  users,
  divisi,
  absensiKaryawan,
  pengajuanCuti,
  events,
  participants,
  honorariumBatches,
  honorariumItems,
  jadwalUjian,
  pengawas,
} from "@/server/db/schema";
import { count, eq, sql, and, gte, lte, ne, desc } from "drizzle-orm";
import type { Capability } from "@/lib/rbac/capabilities";

export interface DashboardStats {
  totalSuratKeluar: number;
  totalSuratMasuk: number;
  totalDisposisi: number;
  totalPegawai: number;
  suratKeluarByStatus: { status: string; count: number }[];
  suratMasukByStatus: { status: string; count: number }[];
  suratByJenis: { jenis: string; count: number }[];
  suratKeluarMonthly: { month: string; count: number }[];
  suratMasukMonthly: { month: string; count: number }[];
  disposisiByStatus: { status: string; count: number }[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    totalSuratKeluarResult,
    totalSuratMasukResult,
    totalDisposisiResult,
    totalPegawaiResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(suratKeluar),
    db.select({ count: count() }).from(suratMasuk),
    db.select({ count: count() }).from(disposisi),
    db.select({ count: count() }).from(users),
  ]);

  // Surat keluar by status
  const suratKeluarByStatus = await db
    .select({
      status: suratKeluar.status,
      count: count(),
    })
    .from(suratKeluar)
    .groupBy(suratKeluar.status);

  // Surat masuk by status
  const suratMasukByStatus = await db
    .select({
      status: suratMasuk.status,
      count: count(),
    })
    .from(suratMasuk)
    .groupBy(suratMasuk.status);

  // Surat by jenis (combined keluar and masuk)
  const suratKeluarByJenis = await db
    .select({
      jenis: suratKeluar.jenisSurat,
      count: count(),
    })
    .from(suratKeluar)
    .groupBy(suratKeluar.jenisSurat);

  const suratMasukByJenis = await db
    .select({
      jenis: suratMasuk.jenisSurat,
      count: count(),
    })
    .from(suratMasuk)
    .groupBy(suratMasuk.jenisSurat);

  const jenisMap = new Map<string, number>();
  [...suratKeluarByJenis, ...suratMasukByJenis].forEach((item) => {
    const current = jenisMap.get(item.jenis) || 0;
    jenisMap.set(item.jenis, current + item.count);
  });

  const suratByJenis = Array.from(jenisMap.entries()).map(([jenis, count]) => ({
    jenis,
    count,
  }));

  // Monthly stats for current year
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

  const suratKeluarMonthlyRaw = await db
    .select({
      month: sql<string>`EXTRACT(MONTH FROM ${suratKeluar.createdAt})`,
      count: count(),
    })
    .from(suratKeluar)
    .where(
      and(
        gte(suratKeluar.createdAt, startOfYear),
        lte(suratKeluar.createdAt, endOfYear)
      )
    )
    .groupBy(sql`EXTRACT(MONTH FROM ${suratKeluar.createdAt})`);

  const suratMasukMonthlyRaw = await db
    .select({
      month: sql<string>`EXTRACT(MONTH FROM ${suratMasuk.createdAt})`,
      count: count(),
    })
    .from(suratMasuk)
    .where(
      and(
        gte(suratMasuk.createdAt, startOfYear),
        lte(suratMasuk.createdAt, endOfYear)
      )
    )
    .groupBy(sql`EXTRACT(MONTH FROM ${suratMasuk.createdAt})`);

  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Ags", "Sep", "Okt", "Nov", "Des",
  ];

  const suratKeluarMonthly = months.map((month, index) => {
    const found = suratKeluarMonthlyRaw.find(
      (r) => parseInt(r.month) === index + 1
    );
    return { month, count: found?.count || 0 };
  });

  const suratMasukMonthly = months.map((month, index) => {
    const found = suratMasukMonthlyRaw.find(
      (r) => parseInt(r.month) === index + 1
    );
    return { month, count: found?.count || 0 };
  });

  // Disposisi by status
  const disposisiByStatus = await db
    .select({
      status: disposisi.status,
      count: count(),
    })
    .from(disposisi)
    .groupBy(disposisi.status);

  return {
    totalSuratKeluar: totalSuratKeluarResult[0]?.count || 0,
    totalSuratMasuk: totalSuratMasukResult[0]?.count || 0,
    totalDisposisi: totalDisposisiResult[0]?.count || 0,
    totalPegawai: totalPegawaiResult[0]?.count || 0,
    suratKeluarByStatus: suratKeluarByStatus.map((s) => ({
      status: s.status || "unknown",
      count: s.count,
    })),
    suratMasukByStatus: suratMasukByStatus.map((s) => ({
      status: s.status || "unknown",
      count: s.count,
    })),
    suratByJenis,
    suratKeluarMonthly,
    suratMasukMonthly,
    disposisiByStatus: disposisiByStatus.map((s) => ({
      status: s.status || "unknown",
      count: s.count,
    })),
  };
}

export async function getSuratKeluarTrend(days: number = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const result = await db
    .select({
      date: sql<string>`DATE(${suratKeluar.createdAt})`,
      count: count(),
    })
    .from(suratKeluar)
    .where(
      and(
        gte(suratKeluar.createdAt, startDate),
        lte(suratKeluar.createdAt, endDate)
      )
    )
    .groupBy(sql`DATE(${suratKeluar.createdAt})`)
    .orderBy(sql`DATE(${suratKeluar.createdAt})`);

  return result;
}

export async function getDivisiStats() {
  const result = await db
    .select({
      divisiId: users.divisiId,
      divisiName: divisi.nama,
      count: count(),
    })
    .from(users)
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .where(eq(users.isActive, true))
    .groupBy(users.divisiId, divisi.nama);

  return result;
}

// ─── ROLE-BASED METRICS ──────────────────────────────────────────────────────

export interface PersuratanMetrics {
  suratMasukBaru: number;
  suratMasukDiproses: number;
  suratKeluarReview: number;
  suratKeluarArsip: number;
  disposisiAktif: number;
  disposisiBelumDibaca: number;
}

export async function getPersuratanMetrics(): Promise<PersuratanMetrics> {
  const [
    masukBaru,
    masukDiproses,
    keluarReview,
    keluarArsip,
    disposisiAktif,
    disposisiBelumDibaca,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(suratMasuk)
      .where(eq(suratMasuk.status, "diterima")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(suratMasuk)
      .where(eq(suratMasuk.status, "diproses")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(suratKeluar)
      .where(
        sql`${suratKeluar.status} IN ('permohonan_persetujuan', 'reviu')`
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(suratKeluar)
      .where(eq(suratKeluar.status, "pengarsipan")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(disposisi)
      .where(ne(disposisi.status, "selesai")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(disposisi)
      .where(eq(disposisi.status, "belum_dibaca")),
  ]);

  return {
    suratMasukBaru: masukBaru[0]?.count ?? 0,
    suratMasukDiproses: masukDiproses[0]?.count ?? 0,
    suratKeluarReview: keluarReview[0]?.count ?? 0,
    suratKeluarArsip: keluarArsip[0]?.count ?? 0,
    disposisiAktif: disposisiAktif[0]?.count ?? 0,
    disposisiBelumDibaca: disposisiBelumDibaca[0]?.count ?? 0,
  };
}

export interface KepegawaianMetrics {
  absensiHadirHariIni: number;
  absensiTerlambatHariIni: number;
  absensiAlphaHariIni: number;
  cutiMenungguApproval: number;
  cutiDisetujuiBulanIni: number;
}

export async function getKepegawaianMetrics(): Promise<KepegawaianMetrics> {
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [hadir, terlambat, alpha, cutiPending, cutiApproved] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(absensiKaryawan)
        .where(
          and(
            eq(absensiKaryawan.tanggal, todayStr),
            eq(absensiKaryawan.status, "hadir")
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(absensiKaryawan)
        .where(
          and(
            eq(absensiKaryawan.tanggal, todayStr),
            eq(absensiKaryawan.status, "terlambat")
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(absensiKaryawan)
        .where(
          and(
            eq(absensiKaryawan.tanggal, todayStr),
            eq(absensiKaryawan.status, "alpha")
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(pengajuanCuti)
        .where(eq(pengajuanCuti.status, "diajukan")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(pengajuanCuti)
        .where(
          and(
            eq(pengajuanCuti.status, "disetujui"),
            gte(pengajuanCuti.tanggalMulai, monthStart),
            lte(pengajuanCuti.tanggalMulai, monthEnd)
          )
        ),
    ]);

  return {
    absensiHadirHariIni: hadir[0]?.count ?? 0,
    absensiTerlambatHariIni: terlambat[0]?.count ?? 0,
    absensiAlphaHariIni: alpha[0]?.count ?? 0,
    cutiMenungguApproval: cutiPending[0]?.count ?? 0,
    cutiDisetujuiBulanIni: cutiApproved[0]?.count ?? 0,
  };
}

export interface SertifikatMetrics {
  kegiatanAktif: number;
  totalPeserta: number;
  kegiatanByKategori: { kategori: string; count: number }[];
  kegiatanTerbaru: {
    id: number;
    namaKegiatan: string;
    kategori: string;
    tanggalMulai: string;
    pesertaCount: number;
  }[];
}

export async function getSertifikatMetrics(): Promise<SertifikatMetrics> {
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [activeCount, pesertaCount, byKategori, recentEvents] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .where(gte(events.tanggalSelesai, todayStr)),
      db.select({ count: sql<number>`count(*)::int` }).from(participants),
      db
        .select({
          kategori: events.kategori,
          count: sql<number>`count(*)::int`,
        })
        .from(events)
        .groupBy(events.kategori),
      db
        .select({
          id: events.id,
          namaKegiatan: events.namaKegiatan,
          kategori: events.kategori,
          tanggalMulai: events.tanggalMulai,
          pesertaCount: sql<number>`0::int`,
        })
        .from(events)
        .where(gte(events.tanggalSelesai, todayStr))
        .orderBy(events.tanggalMulai)
        .limit(5),
    ]);

  // Get participant counts for recent events
  if (recentEvents.length > 0) {
    const eventIds = recentEvents.map((e) => e.id);
    const pesertaByEvent = await db
      .select({
        eventId: participants.eventId,
        count: sql<number>`count(*)::int`,
      })
      .from(participants)
      .where(sql`${participants.eventId} = ANY(${eventIds})`)
      .groupBy(participants.eventId);

    const pesertaMap = new Map(
      pesertaByEvent.map((r) => [r.eventId, r.count])
    );
    for (const ev of recentEvents) {
      ev.pesertaCount = pesertaMap.get(ev.id) ?? 0;
    }
  }

  return {
    kegiatanAktif: activeCount[0]?.count ?? 0,
    totalPeserta: pesertaCount[0]?.count ?? 0,
    kegiatanByKategori: byKategori.map((k) => ({
      kategori: k.kategori,
      count: k.count,
    })),
    kegiatanTerbaru: recentEvents,
  };
}

export interface KeuanganMetrics {
  batchDraft: number;
  batchDikirimKeuangan: number;
  batchDiprosesKeuangan: number;
  batchDibayar: number;
  batchLocked: number;
  totalNominalDibayar: number;
}

export async function getKeuanganMetrics(): Promise<KeuanganMetrics> {
  const [byStatus, totalDibayar] = await Promise.all([
    db
      .select({
        status: honorariumBatches.status,
        count: sql<number>`count(*)::int`,
      })
      .from(honorariumBatches)
      .groupBy(honorariumBatches.status),
    db
      .select({
        total: sql<string>`COALESCE(SUM(${honorariumItems.amount}), 0)::text`,
      })
      .from(honorariumItems)
      .innerJoin(
        honorariumBatches,
        eq(honorariumItems.batchId, honorariumBatches.id),
      )
      .where(
        sql`${honorariumBatches.status} IN ('dibayar', 'locked')`
      ),
  ]);

  const statusMap = new Map(
    byStatus.map((r) => [r.status, r.count])
  );

  return {
    batchDraft: statusMap.get("draft") ?? 0,
    batchDikirimKeuangan: statusMap.get("dikirim_ke_keuangan") ?? 0,
    batchDiprosesKeuangan: statusMap.get("diproses_keuangan") ?? 0,
    batchDibayar: statusMap.get("dibayar") ?? 0,
    batchLocked: statusMap.get("locked") ?? 0,
    totalNominalDibayar: Number(totalDibayar[0]?.total ?? 0),
  };
}

// ─── RECENT ITEMS (untuk dashboard list real, bukan dummy) ───────────────────

export interface RecentSuratMasukItem {
  id: string;
  perihal: string;
  pengirim: string;
  tanggalDiterima: string;
  status: string | null;
  jenisSurat: string;
  createdAt: string | null;
}

export interface RecentDisposisiItem {
  id: string;
  perihal: string;
  catatan: string | null;
  batasWaktu: string | null;
  status: string | null;
  tanggalDisposisi: string | null;
  dariUserName: string | null;
}

export interface PendingCutiItem {
  id: string;
  userName: string | null;
  jenisCuti: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: number;
  alasan: string | null;
  createdAt: string;
}

export interface PendingBatchItem {
  id: string;
  documentNumber: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  submittedAt: string | null;
}

export async function getRecentSuratMasuk(
  limit = 5,
): Promise<RecentSuratMasukItem[]> {
  const rows = await db
    .select({
      id: suratMasuk.id,
      perihal: suratMasuk.perihal,
      pengirim: suratMasuk.pengirim,
      tanggalDiterima: suratMasuk.tanggalDiterima,
      status: suratMasuk.status,
      jenisSurat: suratMasuk.jenisSurat,
      createdAt: suratMasuk.createdAt,
    })
    .from(suratMasuk)
    .orderBy(desc(suratMasuk.createdAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, createdAt: r.createdAt?.toISOString() ?? null }));
}

export async function getRecentDisposisiForUser(
  userId: string,
  limit = 5,
): Promise<RecentDisposisiItem[]> {
  const rows = await db
    .select({
      id: disposisi.id,
      perihal: suratMasuk.perihal,
      catatan: disposisi.catatan,
      batasWaktu: disposisi.batasWaktu,
      status: disposisi.status,
      tanggalDisposisi: disposisi.tanggalDisposisi,
      dariUserName: users.namaLengkap,
    })
    .from(disposisi)
    .innerJoin(suratMasuk, eq(disposisi.suratMasukId, suratMasuk.id))
    .leftJoin(users, eq(disposisi.dariUserId, users.id))
    .where(
      and(
        eq(disposisi.kepadaUserId, userId),
        ne(disposisi.status, "selesai"),
      ),
    )
    .orderBy(desc(disposisi.tanggalDisposisi))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    tanggalDisposisi: r.tanggalDisposisi?.toISOString() ?? null,
  }));
}

export async function getPendingCutiList(
  limit = 5,
): Promise<PendingCutiItem[]> {
  const rows = await db
    .select({
      id: pengajuanCuti.id,
      userName: users.namaLengkap,
      jenisCuti: pengajuanCuti.jenisCuti,
      tanggalMulai: pengajuanCuti.tanggalMulai,
      tanggalSelesai: pengajuanCuti.tanggalSelesai,
      jumlahHari: pengajuanCuti.jumlahHari,
      alasan: pengajuanCuti.alasan,
      createdAt: pengajuanCuti.createdAt,
    })
    .from(pengajuanCuti)
    .leftJoin(users, eq(pengajuanCuti.userId, users.id))
    .where(eq(pengajuanCuti.status, "diajukan"))
    .orderBy(desc(pengajuanCuti.createdAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function getPendingBatchList(
  limit = 5,
): Promise<PendingBatchItem[]> {
  const rows = await db
    .select({
      id: honorariumBatches.id,
      documentNumber: honorariumBatches.documentNumber,
      periodStart: honorariumBatches.periodStart,
      periodEnd: honorariumBatches.periodEnd,
      status: honorariumBatches.status,
      submittedAt: honorariumBatches.submittedAt,
    })
    .from(honorariumBatches)
    .where(
      sql`${honorariumBatches.status} IN ('dikirim_ke_keuangan', 'diproses_keuangan')`,
    )
    .orderBy(
      desc(honorariumBatches.submittedAt),
      desc(honorariumBatches.createdAt),
    )
    .limit(limit);

  return rows.map((r) => ({ ...r, submittedAt: r.submittedAt?.toISOString() ?? null }));
}

// ─── CACHE TAGS ──────────────────────────────────────────────────────────────

import { DASHBOARD_TAGS, type DashboardTag } from "@/lib/dashboard-cache-tags";

export async function revalidateDashboardTag(tag: DashboardTag) {
  updateTag(tag);
}

const cachedPersuratanMetrics = unstable_cache(
  getPersuratanMetrics,
  [DASHBOARD_TAGS.persuratan],
  { tags: [DASHBOARD_TAGS.persuratan], revalidate: 60 },
);

const cachedKepegawaianMetrics = unstable_cache(
  getKepegawaianMetrics,
  [DASHBOARD_TAGS.kepegawaian],
  { tags: [DASHBOARD_TAGS.kepegawaian], revalidate: 60 },
);

const cachedSertifikatMetrics = unstable_cache(
  getSertifikatMetrics,
  [DASHBOARD_TAGS.sertifikat],
  { tags: [DASHBOARD_TAGS.sertifikat], revalidate: 60 },
);

const cachedKeuanganMetrics = unstable_cache(
  getKeuanganMetrics,
  [DASHBOARD_TAGS.keuangan],
  { tags: [DASHBOARD_TAGS.keuangan], revalidate: 60 },
);

const cachedDashboardStats = unstable_cache(
  getDashboardStats,
  [`${DASHBOARD_TAGS.persuratan}-stats`],
  { tags: [DASHBOARD_TAGS.persuratan], revalidate: 60 },
);

const cachedRecentSuratMasuk = unstable_cache(
  (limit: number) => getRecentSuratMasuk(limit),
  [`${DASHBOARD_TAGS.persuratan}-recent-surat-masuk`],
  { tags: [DASHBOARD_TAGS.persuratan], revalidate: 60 },
);

const cachedRecentDisposisi = unstable_cache(
  (userId: string, limit: number) => getRecentDisposisiForUser(userId, limit),
  [`${DASHBOARD_TAGS.persuratan}-recent-disposisi`],
  { tags: [DASHBOARD_TAGS.persuratan], revalidate: 60 },
);

const cachedPendingCutiList = unstable_cache(
  (limit: number) => getPendingCutiList(limit),
  [`${DASHBOARD_TAGS.kepegawaian}-pending-cuti`],
  { tags: [DASHBOARD_TAGS.kepegawaian], revalidate: 60 },
);

const cachedPendingBatchList = unstable_cache(
  (limit: number) => getPendingBatchList(limit),
  [`${DASHBOARD_TAGS.keuangan}-pending-batch`],
  { tags: [DASHBOARD_TAGS.keuangan], revalidate: 60 },
);

const cachedStatistikUjian = unstable_cache(
  getStatistikUjianInternal,
  [DASHBOARD_TAGS.ujian],
  { tags: [DASHBOARD_TAGS.ujian], revalidate: 60 },
);

// ─── CAPABILITY-GATED DASHBOARD DATA ─────────────────────────────────────────

export interface RoleDashboardData {
  persuratan: PersuratanMetrics | null;
  kepegawaian: KepegawaianMetrics | null;
  sertifikat: SertifikatMetrics | null;
  keuangan: KeuanganMetrics | null;
  stats: DashboardStats | null;
  statistikUjian: {
    totalHariIni: number;
    totalMingguIni: number;
    totalBulanIni: number;
    totalPengawasAktif: number;
  } | null;
  // Recent items (Fase 2) — list real dari DB, bukan dummy.
  recentSuratMasuk: RecentSuratMasukItem[] | null;
  recentDisposisi: RecentDisposisiItem[] | null;
  pendingCuti: PendingCutiItem[] | null;
  pendingBatches: PendingBatchItem[] | null;
}

const PERSURATAN_CAPS: Capability[] = [
  "surat_masuk:view",
  "surat_keluar:view",
  "disposisi:view",
];
const KEPEGAWAIAN_CAPS: Capability[] = ["absensi:view", "cuti:view"];
const SERTIFIKAT_CAPS: Capability[] = ["sertifikat:view"];
const KEUANGAN_CAPS: Capability[] = ["keuangan:view"];
const UJIAN_CAPS: Capability[] = ["jadwal_ujian:view"];

function hasAnyCapability(
  userCaps: Capability[],
  required: Capability[],
): boolean {
  return userCaps.some((c) => required.includes(c));
}

export async function getRoleDashboardData(
  capabilities: Capability[],
  isSuperAdmin: boolean,
  userId: string | null,
): Promise<RoleDashboardData> {
  // SuperAdmin/admin sees everything
  const allAccess = isSuperAdmin;

  const canPersuratan =
    allAccess || hasAnyCapability(capabilities, PERSURATAN_CAPS);
  const canSuratMasuk =
    allAccess || capabilities.includes("surat_masuk:view");
  const canDisposisi =
    allAccess || capabilities.includes("disposisi:view");
  const canKepegawaian =
    allAccess || hasAnyCapability(capabilities, KEPEGAWAIAN_CAPS);
  const canApproveCuti =
    allAccess || capabilities.includes("cuti:approve");
  const canSertifikat =
    allAccess || hasAnyCapability(capabilities, SERTIFIKAT_CAPS);
  const canKeuangan =
    allAccess || hasAnyCapability(capabilities, KEUANGAN_CAPS);
  const canUjian = allAccess || hasAnyCapability(capabilities, UJIAN_CAPS);

  const [
    persuratan,
    kepegawaian,
    sertifikat,
    keuangan,
    stats,
    statistikUjian,
    recentSuratMasuk,
    recentDisposisi,
    pendingCuti,
    pendingBatches,
  ] = await Promise.all([
    canPersuratan ? cachedPersuratanMetrics() : Promise.resolve(null),
    canKepegawaian ? cachedKepegawaianMetrics() : Promise.resolve(null),
    canSertifikat ? cachedSertifikatMetrics() : Promise.resolve(null),
    canKeuangan ? cachedKeuanganMetrics() : Promise.resolve(null),
    canPersuratan ? cachedDashboardStats() : Promise.resolve(null),
    canUjian ? cachedStatistikUjian() : Promise.resolve(null),
    canSuratMasuk ? cachedRecentSuratMasuk(5) : Promise.resolve(null),
    canDisposisi && userId
      ? cachedRecentDisposisi(userId, 5)
      : Promise.resolve(null),
    canApproveCuti ? cachedPendingCutiList(5) : Promise.resolve(null),
    canKeuangan ? cachedPendingBatchList(5) : Promise.resolve(null),
  ]);

  return {
    persuratan,
    kepegawaian,
    sertifikat,
    keuangan,
    stats,
    statistikUjian,
    recentSuratMasuk,
    recentDisposisi,
    pendingCuti,
    pendingBatches,
  };
}

async function getStatistikUjianInternal() {
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const weekday = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })).getDay();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekday);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;

  const [hariIni, mingguIni, bulanIni, pengawasAktif] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jadwalUjian)
      .where(eq(jadwalUjian.tanggalUjian, todayStr)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jadwalUjian)
      .where(
        and(
          gte(jadwalUjian.tanggalUjian, weekStartStr),
          lte(jadwalUjian.tanggalUjian, weekEndStr)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jadwalUjian)
      .where(
        and(
          gte(jadwalUjian.tanggalUjian, monthStartStr),
          lte(jadwalUjian.tanggalUjian, monthEndStr)
        )
      ),
    db.select({ count: sql<number>`count(*)::int` }).from(pengawas),
  ]);

  return {
    totalHariIni: hariIni[0]?.count ?? 0,
    totalMingguIni: mingguIni[0]?.count ?? 0,
    totalBulanIni: bulanIni[0]?.count ?? 0,
    totalPengawasAktif: pengawasAktif[0]?.count ?? 0,
  };
}
