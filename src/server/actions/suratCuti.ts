"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import {
  pengajuanCuti,
  users,
  divisi,
  saldoCutiTahunan,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";

export type DataSuratCuti = {
  // Data pengajuan
  id: string;
  tanggalPengajuan: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: number;
  jenisCuti: string;
  alasan: string;
  status: string;
  approvalCode: string | null;
  approvedAt: string | null;
  // Data pemohon
  namaPemohon: string;
  divisiPemohon: string;
  tahunBergabung: string;
  noHpPemohon: string;
  // Data approver
  namaApprover: string | null;
  jabatanApprover: string | null;
  // Rangkuman saldo
  tahunCuti: number;
  kuotaAwal: number;
  cutiBersamaTerpakai: number;
  cutiSudahDiambil: number;
  cutiDiambilSekarang: number;
  sisaCuti: number;
};

export async function getDataSuratCuti(pengajuanCutiId: string): Promise<{
  ok: boolean;
  data?: DataSuratCuti;
  error?: string;
}> {
  await requirePermission("cuti", "view");

  // Ambil data pengajuan + pemohon
  const [cuti] = await db
    .select({
      id: pengajuanCuti.id,
      userId: pengajuanCuti.userId,
      jenisCuti: pengajuanCuti.jenisCuti,
      tanggalMulai: pengajuanCuti.tanggalMulai,
      tanggalSelesai: pengajuanCuti.tanggalSelesai,
      jumlahHari: pengajuanCuti.jumlahHari,
      alasan: pengajuanCuti.alasan,
      status: pengajuanCuti.status,
      approvalCode: pengajuanCuti.approvalCode,
      approvedBy: pengajuanCuti.approvedBy,
      approvedAt: pengajuanCuti.approvedAt,
      createdAt: pengajuanCuti.createdAt,
      namaPemohon: users.namaLengkap,
      divisiId: users.divisiId,
      tanggalMasuk: users.tanggalMasuk,
      noHp: users.noHp,
    })
    .from(pengajuanCuti)
    .leftJoin(users, eq(pengajuanCuti.userId, users.id))
    .where(eq(pengajuanCuti.id, pengajuanCutiId))
    .limit(1);

  if (!cuti) {
    return { ok: false, error: "Data cuti tidak ditemukan." };
  }

  // Ambil nama divisi
  let divisiNama = "-";
  if (cuti.divisiId) {
    const [div] = await db
      .select({ nama: divisi.nama })
      .from(divisi)
      .where(eq(divisi.id, cuti.divisiId))
      .limit(1);
    divisiNama = div?.nama ?? "-";
  }

  // Ambil data approver
  let namaApprover: string | null = null;
  let jabatanApprover: string | null = null;
  if (cuti.approvedBy) {
    const [approver] = await db
      .select({ nama: users.namaLengkap, jabatan: users.jabatan })
      .from(users)
      .where(eq(users.id, cuti.approvedBy))
      .limit(1);
    namaApprover = approver?.nama ?? null;
    jabatanApprover = approver?.jabatan ?? null;
  }

  // Ambil saldo cuti
  const tahunCuti = new Date(cuti.tanggalMulai).getFullYear();
  const [saldo] = await db
    .select({
      kuotaAwal: saldoCutiTahunan.kuotaAwal,
      cutiTerpakai: saldoCutiTahunan.cutiTerpakai,
      cutiBersamaTerpakai: saldoCutiTahunan.cutiBersamaTerpakai,
      sisaCuti: saldoCutiTahunan.sisaCuti,
    })
    .from(saldoCutiTahunan)
    .where(
      and(
        eq(saldoCutiTahunan.userId, cuti.userId),
        eq(saldoCutiTahunan.tahun, tahunCuti),
      ),
    )
    .limit(1);

  // Hitung cuti yang sudah diambil sebelum pengajuan ini
  const cutiSudahDiambil = saldo?.cutiTerpakai ?? 0;

  return {
    ok: true,
    data: {
      id: cuti.id,
      tanggalPengajuan: cuti.createdAt
        ? cuti.createdAt.toISOString()
        : new Date().toISOString(),
      tanggalMulai: cuti.tanggalMulai,
      tanggalSelesai: cuti.tanggalSelesai,
      jumlahHari: cuti.jumlahHari,
      jenisCuti: cuti.jenisCuti,
      alasan: cuti.alasan ?? "-",
      status: cuti.status,
      approvalCode: cuti.approvalCode,
      approvedAt: cuti.approvedAt ? cuti.approvedAt.toISOString() : null,
      namaPemohon: cuti.namaPemohon ?? "-",
      divisiPemohon: divisiNama,
      tahunBergabung: cuti.tanggalMasuk
        ? new Date(cuti.tanggalMasuk).getFullYear().toString()
        : "-",
      noHpPemohon: cuti.noHp ?? "-",
      namaApprover,
      jabatanApprover,
      tahunCuti,
      kuotaAwal: saldo?.kuotaAwal ?? 12,
      cutiBersamaTerpakai: saldo?.cutiBersamaTerpakai ?? 0,
      cutiSudahDiambil,
      cutiDiambilSekarang: cuti.jumlahHari,
      sisaCuti: saldo?.sisaCuti ?? 0,
    },
  };
}
