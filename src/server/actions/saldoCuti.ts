"use server";

import { eq, and, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  saldoCutiTahunan,
  saldoCutiKompensasi,
  cutiBersama,
  konfigurasiCuti,
  users,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { writeAuditLog } from "@/server/lib/audit";
import {
  konfigurasiCutiSchema,
  generateSaldoSchema,
  cutiBersamaCreateSchema,
  cutiBersamaToggleSchema,
  koreksiSaldoSchema,
} from "@/lib/validators/saldoCuti.schema";

// ─── KONFIGURASI CUTI ─────────────────────────────────────────────────────────

/** Internal helper — no permission check (used by other functions in this file) */
async function getKonfigurasiCutiInternal(tahun: number) {
  const [config] = await db
    .select()
    .from(konfigurasiCuti)
    .where(eq(konfigurasiCuti.tahun, tahun))
    .limit(1);

  return config ?? {
    id: 0,
    tahun,
    kuotaCutiTahunan: 12,
    kuotaCutiKompensasi: 2,
    maksimalPotongCutiBersama: 2,
    updatedBy: null,
    updatedAt: null,
  };
}

export async function getKonfigurasiCuti(tahun: number) {
  await requirePermission("saldoCuti", "view");
  return getKonfigurasiCutiInternal(tahun);
}

export async function upsertKonfigurasiCuti(input: unknown) {
  const session = await requirePermission("saldoCuti", "manage");

  const parsed = konfigurasiCutiSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { tahun, kuotaCutiTahunan, kuotaCutiKompensasi, maksimalPotongCutiBersama } = parsed.data;

  const [existing] = await db
    .select({ id: konfigurasiCuti.id })
    .from(konfigurasiCuti)
    .where(eq(konfigurasiCuti.tahun, tahun))
    .limit(1);

  if (existing) {
    await db
      .update(konfigurasiCuti)
      .set({
        kuotaCutiTahunan,
        kuotaCutiKompensasi,
        maksimalPotongCutiBersama,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(konfigurasiCuti.id, existing.id));
  } else {
    await db.insert(konfigurasiCuti).values({
      tahun,
      kuotaCutiTahunan,
      kuotaCutiKompensasi,
      maksimalPotongCutiBersama,
      updatedBy: session.user.id,
    });
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "KONFIGURASI_CUTI_UPDATED",
    entitasType: "konfigurasi_cuti",
    entitasId: String(tahun),
    detail: parsed.data,
  });

  return { ok: true as const };
}

// ─── GENERATE SALDO TAHUNAN ───────────────────────────────────────────────────

export async function generateSaldoTahunan(input: unknown) {
  const session = await requirePermission("saldoCuti", "manage");

  const parsed = generateSaldoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { tahun } = parsed.data;

  // Cek apakah sudah ada saldo untuk tahun ini
  const [existingCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(saldoCutiTahunan)
    .where(eq(saldoCutiTahunan.tahun, tahun));

  if ((existingCount?.total ?? 0) > 0) {
    return { ok: false as const, error: `Saldo untuk tahun ${tahun} sudah di-generate sebelumnya.` };
  }

  // Ambil konfigurasi
  const config = await getKonfigurasiCutiInternal(tahun);

  // Ambil semua user aktif
  const activeUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isActive, true));

  if (activeUsers.length === 0) {
    return { ok: false as const, error: "Tidak ada karyawan aktif." };
  }

  // Batch insert saldo cuti tahunan
  const saldoTahunanValues = activeUsers.map((u) => ({
    userId: u.id,
    tahun,
    kuotaAwal: config.kuotaCutiTahunan,
    cutiTerpakai: 0,
    cutiBersamaTerpakai: 0,
    sisaCuti: config.kuotaCutiTahunan,
  }));

  // Batch insert saldo cuti kompensasi
  const saldoKompensasiValues = activeUsers.map((u) => ({
    userId: u.id,
    tahun,
    kuota: config.kuotaCutiKompensasi,
    terpakai: 0,
    sisa: config.kuotaCutiKompensasi,
  }));

  await db.insert(saldoCutiTahunan).values(saldoTahunanValues);
  await db.insert(saldoCutiKompensasi).values(saldoKompensasiValues);

  await writeAuditLog({
    userId: session.user.id,
    aksi: "SALDO_CUTI_GENERATED",
    entitasType: "saldo_cuti_tahunan",
    entitasId: String(tahun),
    detail: {
      tahun,
      jumlahKaryawan: activeUsers.length,
      kuotaTahunan: config.kuotaCutiTahunan,
      kuotaKompensasi: config.kuotaCutiKompensasi,
    },
  });

  return { ok: true as const, data: { jumlahKaryawan: activeUsers.length } };
}

// ─── GET SALDO CUTI ───────────────────────────────────────────────────────────

export type SaldoCutiResponse = {
  tahunan: {
    kuotaAwal: number;
    cutiTerpakai: number;
    cutiBersamaTerpakai: number;
    sisaCuti: number;
  } | null;
  kompensasi: {
    kuota: number;
    terpakai: number;
    sisa: number;
  } | null;
};

export async function getSaldoCuti(userId: string, tahun: number): Promise<SaldoCutiResponse> {
  await requirePermission("saldoCuti", "view");

  const [tahunan] = await db
    .select({
      kuotaAwal: saldoCutiTahunan.kuotaAwal,
      cutiTerpakai: saldoCutiTahunan.cutiTerpakai,
      cutiBersamaTerpakai: saldoCutiTahunan.cutiBersamaTerpakai,
      sisaCuti: saldoCutiTahunan.sisaCuti,
    })
    .from(saldoCutiTahunan)
    .where(and(eq(saldoCutiTahunan.userId, userId), eq(saldoCutiTahunan.tahun, tahun)))
    .limit(1);

  const [kompensasi] = await db
    .select({
      kuota: saldoCutiKompensasi.kuota,
      terpakai: saldoCutiKompensasi.terpakai,
      sisa: saldoCutiKompensasi.sisa,
    })
    .from(saldoCutiKompensasi)
    .where(and(eq(saldoCutiKompensasi.userId, userId), eq(saldoCutiKompensasi.tahun, tahun)))
    .limit(1);

  return {
    tahunan: tahunan ?? null,
    kompensasi: kompensasi ?? null,
  };
}

// ─── GET ALL SALDO (ADMIN) ────────────────────────────────────────────────────

export type SaldoCutiRow = {
  userId: string;
  namaLengkap: string | null;
  kuotaAwal: number;
  cutiTerpakai: number;
  cutiBersamaTerpakai: number;
  sisaCuti: number;
  kompensasiKuota: number | null;
  kompensasiTerpakai: number | null;
  kompensasiSisa: number | null;
};

export async function getAllSaldoCuti(tahun: number, opts?: { page?: number; pageSize?: number }) {
  await requirePermission("saldoCuti", "manage");

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = opts?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(saldoCutiTahunan)
    .where(eq(saldoCutiTahunan.tahun, tahun));

  const rows = await db
    .select({
      userId: saldoCutiTahunan.userId,
      namaLengkap: users.namaLengkap,
      kuotaAwal: saldoCutiTahunan.kuotaAwal,
      cutiTerpakai: saldoCutiTahunan.cutiTerpakai,
      cutiBersamaTerpakai: saldoCutiTahunan.cutiBersamaTerpakai,
      sisaCuti: saldoCutiTahunan.sisaCuti,
      kompensasiKuota: saldoCutiKompensasi.kuota,
      kompensasiTerpakai: saldoCutiKompensasi.terpakai,
      kompensasiSisa: saldoCutiKompensasi.sisa,
    })
    .from(saldoCutiTahunan)
    .leftJoin(users, eq(saldoCutiTahunan.userId, users.id))
    .leftJoin(
      saldoCutiKompensasi,
      and(
        eq(saldoCutiTahunan.userId, saldoCutiKompensasi.userId),
        eq(saldoCutiKompensasi.tahun, tahun),
      ),
    )
    .where(eq(saldoCutiTahunan.tahun, tahun))
    .orderBy(users.namaLengkap)
    .limit(pageSize)
    .offset(offset);

  return {
    rows,
    total: totalRow?.total ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((totalRow?.total ?? 0) / pageSize)),
  };
}

// ─── KOREKSI SALDO (ADMIN) ────────────────────────────────────────────────────

export async function koreksiSaldo(input: unknown) {
  const session = await requirePermission("saldoCuti", "manage");

  const parsed = koreksiSaldoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { userId, tahun, jenis, field, value } = parsed.data;

  if (jenis === "tahunan") {
    const [existing] = await db
      .select()
      .from(saldoCutiTahunan)
      .where(and(eq(saldoCutiTahunan.userId, userId), eq(saldoCutiTahunan.tahun, tahun)))
      .limit(1);

    if (!existing) {
      return { ok: false as const, error: "Saldo cuti tahunan tidak ditemukan." };
    }

    const updates: Record<string, number> = { [field]: value };

    // Recalculate sisaCuti
    const kuotaAwal = field === "kuotaAwal" ? value : existing.kuotaAwal;
    const cutiTerpakai = field === "cutiTerpakai" ? value : existing.cutiTerpakai;
    const cutiBersamaTerpakai = field === "cutiBersamaTerpakai" ? value : existing.cutiBersamaTerpakai;
    updates.sisaCuti = Math.max(0, kuotaAwal - cutiTerpakai - cutiBersamaTerpakai);

    await db
      .update(saldoCutiTahunan)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(saldoCutiTahunan.userId, userId), eq(saldoCutiTahunan.tahun, tahun)));
  } else {
    const [existing] = await db
      .select()
      .from(saldoCutiKompensasi)
      .where(and(eq(saldoCutiKompensasi.userId, userId), eq(saldoCutiKompensasi.tahun, tahun)))
      .limit(1);

    if (!existing) {
      return { ok: false as const, error: "Saldo cuti kompensasi tidak ditemukan." };
    }

    const updates: Record<string, number> = { [field]: value };

    // Recalculate sisa
    const kuota = field === "kuota" ? value : existing.kuota;
    const terpakai = field === "terpakai" ? value : existing.terpakai;
    updates.sisa = Math.max(0, kuota - terpakai);

    await db
      .update(saldoCutiKompensasi)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(saldoCutiKompensasi.userId, userId), eq(saldoCutiKompensasi.tahun, tahun)));
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "SALDO_CUTI_KOREKSI",
    entitasType: jenis === "tahunan" ? "saldo_cuti_tahunan" : "saldo_cuti_kompensasi",
    entitasId: `${userId}_${tahun}`,
    detail: { userId, tahun, jenis, field, value },
  });

  return { ok: true as const };
}

// ─── CUTI BERSAMA ─────────────────────────────────────────────────────────────

export async function listCutiBersama(tahun: number) {
  await requirePermission("saldoCuti", "view");

  const rows = await db
    .select()
    .from(cutiBersama)
    .where(eq(cutiBersama.tahun, tahun))
    .orderBy(cutiBersama.tanggal);

  return rows;
}

export async function createCutiBersama(input: unknown) {
  const session = await requirePermission("saldoCuti", "manage");

  const parsed = cutiBersamaCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { tahun, tanggal, keterangan } = parsed.data;

  // Cek duplikat tanggal
  const [existing] = await db
    .select({ id: cutiBersama.id })
    .from(cutiBersama)
    .where(eq(cutiBersama.tanggal, tanggal))
    .limit(1);

  if (existing) {
    return { ok: false as const, error: `Tanggal ${tanggal} sudah terdaftar sebagai cuti bersama.` };
  }

  // Cek batas maksimal pemotongan
  const config = await getKonfigurasiCutiInternal(tahun);
  const [countPotong] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(cutiBersama)
    .where(and(eq(cutiBersama.tahun, tahun), eq(cutiBersama.memotongSaldo, true)));

  const sudahPotong = countPotong?.total ?? 0;
  const bisaPotong = sudahPotong < config.maksimalPotongCutiBersama;

  // Insert cuti bersama
  const [inserted] = await db
    .insert(cutiBersama)
    .values({
      tahun,
      tanggal,
      keterangan,
      memotongSaldo: bisaPotong,
      createdBy: session.user.id,
    })
    .returning({ id: cutiBersama.id, memotongSaldo: cutiBersama.memotongSaldo });

  // Jika memotong saldo, update seluruh karyawan
  if (bisaPotong) {
    await db
      .update(saldoCutiTahunan)
      .set({
        cutiBersamaTerpakai: sql`${saldoCutiTahunan.cutiBersamaTerpakai} + 1`,
        sisaCuti: sql`GREATEST(0, ${saldoCutiTahunan.sisaCuti} - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(saldoCutiTahunan.tahun, tahun));
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CUTI_BERSAMA_CREATED",
    entitasType: "cuti_bersama",
    entitasId: String(inserted?.id),
    detail: { tahun, tanggal, keterangan, memotongSaldo: bisaPotong },
  });

  return {
    ok: true as const,
    data: {
      id: inserted?.id,
      memotongSaldo: bisaPotong,
      pesan: bisaPotong
        ? "Cuti bersama ditambahkan dan memotong saldo seluruh karyawan."
        : "Cuti bersama ditambahkan sebagai libur (tidak memotong saldo — batas maksimal tercapai).",
    },
  };
}

export async function deleteCutiBersama(id: number) {
  const session = await requirePermission("saldoCuti", "manage");

  const [record] = await db
    .select()
    .from(cutiBersama)
    .where(eq(cutiBersama.id, id))
    .limit(1);

  if (!record) {
    return { ok: false as const, error: "Data cuti bersama tidak ditemukan." };
  }

  // Jika memotong saldo, kembalikan saldo seluruh karyawan
  if (record.memotongSaldo) {
    await db
      .update(saldoCutiTahunan)
      .set({
        cutiBersamaTerpakai: sql`GREATEST(0, ${saldoCutiTahunan.cutiBersamaTerpakai} - 1)`,
        sisaCuti: sql`LEAST(${saldoCutiTahunan.kuotaAwal}, ${saldoCutiTahunan.sisaCuti} + 1)`,
        updatedAt: new Date(),
      })
      .where(eq(saldoCutiTahunan.tahun, record.tahun));
  }

  await db.delete(cutiBersama).where(eq(cutiBersama.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CUTI_BERSAMA_DELETED",
    entitasType: "cuti_bersama",
    entitasId: String(id),
    detail: { tanggal: record.tanggal, keterangan: record.keterangan, memotongSaldo: record.memotongSaldo },
  });

  return { ok: true as const };
}

export async function toggleMemotongSaldo(input: unknown) {
  const session = await requirePermission("saldoCuti", "manage");

  const parsed = cutiBersamaToggleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { id, memotongSaldo } = parsed.data;

  const [record] = await db
    .select()
    .from(cutiBersama)
    .where(eq(cutiBersama.id, id))
    .limit(1);

  if (!record) {
    return { ok: false as const, error: "Data cuti bersama tidak ditemukan." };
  }

  if (record.memotongSaldo === memotongSaldo) {
    return { ok: true as const }; // Tidak ada perubahan
  }

  // Jika mengaktifkan pemotongan, cek batas maksimal
  if (memotongSaldo) {
    const config = await getKonfigurasiCutiInternal(record.tahun);
    const [countPotong] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(cutiBersama)
      .where(and(eq(cutiBersama.tahun, record.tahun), eq(cutiBersama.memotongSaldo, true)));

    if ((countPotong?.total ?? 0) >= config.maksimalPotongCutiBersama) {
      return {
        ok: false as const,
        error: `Batas maksimal pemotongan cuti bersama (${config.maksimalPotongCutiBersama} hari) sudah tercapai.`,
      };
    }

    // Potong saldo seluruh karyawan
    await db
      .update(saldoCutiTahunan)
      .set({
        cutiBersamaTerpakai: sql`${saldoCutiTahunan.cutiBersamaTerpakai} + 1`,
        sisaCuti: sql`GREATEST(0, ${saldoCutiTahunan.sisaCuti} - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(saldoCutiTahunan.tahun, record.tahun));
  } else {
    // Kembalikan saldo seluruh karyawan
    await db
      .update(saldoCutiTahunan)
      .set({
        cutiBersamaTerpakai: sql`GREATEST(0, ${saldoCutiTahunan.cutiBersamaTerpakai} - 1)`,
        sisaCuti: sql`LEAST(${saldoCutiTahunan.kuotaAwal}, ${saldoCutiTahunan.sisaCuti} + 1)`,
        updatedAt: new Date(),
      })
      .where(eq(saldoCutiTahunan.tahun, record.tahun));
  }

  await db
    .update(cutiBersama)
    .set({ memotongSaldo })
    .where(eq(cutiBersama.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CUTI_BERSAMA_TOGGLE_POTONG",
    entitasType: "cuti_bersama",
    entitasId: String(id),
    detail: { tanggal: record.tanggal, memotongSaldo },
  });

  return { ok: true as const };
}

// ─── VALIDASI & UPDATE SALDO SAAT CUTI DISETUJUI/DIBATALKAN ───────────────────

/**
 * Validasi apakah saldo cuti mencukupi untuk pengajuan.
 * Dipanggil sebelum menyimpan pengajuan cuti.
 * Memperhitungkan pengajuan yang masih pending (status "diajukan").
 */
export async function validasiSaldoCuti(
  userId: string,
  jenisCuti: "tahunan" | "kompensasi",
  jumlahHari: number,
  tahun: number,
): Promise<{ valid: boolean; error?: string; sisa?: number }> {
  // Hitung jumlah hari yang masih pending (diajukan tapi belum disetujui)
  const { pengajuanCuti } = await import("@/server/db/schema");
  const { gte, lte } = await import("drizzle-orm");

  const [pendingRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(jumlah_hari), 0)::int` })
    .from(pengajuanCuti)
    .where(
      and(
        eq(pengajuanCuti.userId, userId),
        eq(pengajuanCuti.jenisCuti, jenisCuti),
        eq(pengajuanCuti.status, "diajukan"),
        gte(pengajuanCuti.tanggalMulai, `${tahun}-01-01`),
        lte(pengajuanCuti.tanggalSelesai, `${tahun}-12-31`),
      ),
    );

  const pendingHari = pendingRow?.total ?? 0;

  if (jenisCuti === "tahunan") {
    const [saldo] = await db
      .select({ sisaCuti: saldoCutiTahunan.sisaCuti })
      .from(saldoCutiTahunan)
      .where(and(eq(saldoCutiTahunan.userId, userId), eq(saldoCutiTahunan.tahun, tahun)))
      .limit(1);

    if (!saldo) {
      return { valid: false, error: `Saldo cuti tahun ${tahun} belum di-generate. Hubungi admin.` };
    }

    const sisaEfektif = saldo.sisaCuti - pendingHari;

    if (sisaEfektif < jumlahHari) {
      return {
        valid: false,
        error: pendingHari > 0
          ? `Sisa cuti tahunan tidak mencukupi. Sisa: ${saldo.sisaCuti} hari, pending: ${pendingHari} hari, tersedia: ${sisaEfektif} hari.`
          : `Sisa cuti tahunan tidak mencukupi. Sisa: ${saldo.sisaCuti} hari, diajukan: ${jumlahHari} hari.`,
        sisa: sisaEfektif,
      };
    }

    return { valid: true, sisa: sisaEfektif };
  }

  if (jenisCuti === "kompensasi") {
    const [saldo] = await db
      .select({ sisa: saldoCutiKompensasi.sisa })
      .from(saldoCutiKompensasi)
      .where(and(eq(saldoCutiKompensasi.userId, userId), eq(saldoCutiKompensasi.tahun, tahun)))
      .limit(1);

    if (!saldo) {
      return { valid: false, error: `Saldo cuti kompensasi tahun ${tahun} belum di-generate. Hubungi admin.` };
    }

    const sisaEfektif = saldo.sisa - pendingHari;

    if (sisaEfektif < jumlahHari) {
      return {
        valid: false,
        error: pendingHari > 0
          ? `Sisa cuti kompensasi tidak mencukupi. Sisa: ${saldo.sisa} hari, pending: ${pendingHari} hari, tersedia: ${sisaEfektif} hari.`
          : `Sisa cuti kompensasi tidak mencukupi. Sisa: ${saldo.sisa} hari, diajukan: ${jumlahHari} hari.`,
        sisa: sisaEfektif,
      };
    }

    return { valid: true, sisa: sisaEfektif };
  }

  // Jenis cuti lain tidak perlu validasi saldo
  return { valid: true };
}

/**
 * Kurangi saldo saat cuti disetujui.
 * Dipanggil dalam transaction bersama update status pengajuan.
 */
export async function kurangiSaldoCuti(
  userId: string,
  jenisCuti: "tahunan" | "kompensasi",
  jumlahHari: number,
  tahun: number,
) {
  if (jenisCuti === "tahunan") {
    await db
      .update(saldoCutiTahunan)
      .set({
        cutiTerpakai: sql`${saldoCutiTahunan.cutiTerpakai} + ${jumlahHari}`,
        sisaCuti: sql`GREATEST(0, ${saldoCutiTahunan.sisaCuti} - ${jumlahHari})`,
        updatedAt: new Date(),
      })
      .where(and(eq(saldoCutiTahunan.userId, userId), eq(saldoCutiTahunan.tahun, tahun)));
  } else if (jenisCuti === "kompensasi") {
    await db
      .update(saldoCutiKompensasi)
      .set({
        terpakai: sql`${saldoCutiKompensasi.terpakai} + ${jumlahHari}`,
        sisa: sql`GREATEST(0, ${saldoCutiKompensasi.sisa} - ${jumlahHari})`,
        updatedAt: new Date(),
      })
      .where(and(eq(saldoCutiKompensasi.userId, userId), eq(saldoCutiKompensasi.tahun, tahun)));
  }
}

/**
 * Kembalikan saldo saat cuti dibatalkan (setelah disetujui).
 * Dipanggil dalam transaction bersama update status pengajuan.
 */
export async function kembalikanSaldoCuti(
  userId: string,
  jenisCuti: "tahunan" | "kompensasi",
  jumlahHari: number,
  tahun: number,
) {
  if (jenisCuti === "tahunan") {
    await db
      .update(saldoCutiTahunan)
      .set({
        cutiTerpakai: sql`GREATEST(0, ${saldoCutiTahunan.cutiTerpakai} - ${jumlahHari})`,
        sisaCuti: sql`LEAST(${saldoCutiTahunan.kuotaAwal}, ${saldoCutiTahunan.sisaCuti} + ${jumlahHari})`,
        updatedAt: new Date(),
      })
      .where(and(eq(saldoCutiTahunan.userId, userId), eq(saldoCutiTahunan.tahun, tahun)));
  } else if (jenisCuti === "kompensasi") {
    await db
      .update(saldoCutiKompensasi)
      .set({
        terpakai: sql`GREATEST(0, ${saldoCutiKompensasi.terpakai} - ${jumlahHari})`,
        sisa: sql`LEAST(${saldoCutiKompensasi.kuota}, ${saldoCutiKompensasi.sisa} + ${jumlahHari})`,
        updatedAt: new Date(),
      })
      .where(and(eq(saldoCutiKompensasi.userId, userId), eq(saldoCutiKompensasi.tahun, tahun)));
  }
}
