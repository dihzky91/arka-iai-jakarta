"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDataSuratCuti, type DataSuratCuti } from "@/server/actions/suratCuti";

function formatTanggalIndo(isoDate: string): string {
  const date = new Date(isoDate + (isoDate.includes("T") ? "" : "T00:00:00"));
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTanggalWaktuIndo(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }) + ", " + date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }) + " WIB";
}

function getNamaBulan(isoDate: string): string {
  const date = new Date(isoDate + "T00:00:00");
  return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function PreviewSuratCuti({ pengajuanCutiId }: { pengajuanCutiId: string }) {
  const [data, setData] = useState<DataSuratCuti | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDataSuratCuti(pengajuanCutiId)
      .then((res) => {
        if (res.ok && res.data) {
          setData(res.data);
        } else {
          setError(res.error ?? "Gagal memuat data.");
        }
      })
      .catch(() => setError("Gagal memuat data."))
      .finally(() => setLoading(false));
  }, [pengajuanCutiId]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="p-4 text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="mx-auto max-w-[700px] rounded-lg border border-border bg-white p-8 font-serif text-sm leading-relaxed text-gray-900 shadow-sm">
      {/* Tempat & Tanggal */}
      <p className="text-right">Jakarta, {formatTanggalIndo(data.tanggalPengajuan)}</p>

      {/* Tujuan */}
      <div className="mt-6">
        <p>Kepada Yth.</p>
        <p className="font-semibold">{data.namaApprover ?? "[Approver]"}</p>
        <p className="italic">{data.jabatanApprover ?? "Direktur Eksekutif"}</p>
        <p className="font-semibold">Ikatan Akuntan Indonesia</p>
        <p className="font-semibold">Wilayah DKI Jakarta</p>
        <p>Di Tempat</p>
      </div>

      {/* Pembuka */}
      <div className="mt-8">
        <p>Dengan hormat,</p>
        <p>Saya yang bertanda tangan dibawah ini :</p>
      </div>

      {/* Data Pemohon */}
      <div className="mt-4 space-y-1">
        <div className="grid grid-cols-[140px_16px_1fr]">
          <span>Nama</span><span>:</span><span>{data.namaPemohon}</span>
        </div>
        <div className="grid grid-cols-[140px_16px_1fr]">
          <span>Dept.</span><span>:</span><span>{data.divisiPemohon}</span>
        </div>
        <div className="grid grid-cols-[140px_16px_1fr]">
          <span>Tahun Bergabung</span><span>:</span><span>{data.tahunBergabung}</span>
        </div>
      </div>

      {/* Isi Pengajuan */}
      <p className="mt-6">
        Mengajukan cuti tanggal {formatTanggalIndo(data.tanggalMulai)}
        {data.tanggalMulai !== data.tanggalSelesai && ` s/d ${formatTanggalIndo(data.tanggalSelesai)}`}
        {" "}untuk keperluan {data.alasan}
      </p>

      {/* Rangkuman Saldo */}
      <div className="mt-6">
        <p>Berikut rangkuman cuti saya :</p>
        <div className="mt-2 space-y-1">
          <div className="grid grid-cols-[280px_16px_1fr]">
            <span>Cuti tahun {data.tahunCuti}</span>
            <span>:</span>
            <span>{data.kuotaAwal} hari</span>
          </div>
          <div className="grid grid-cols-[280px_16px_1fr]">
            <span>Cuti bersama tahun {data.tahunCuti}</span>
            <span>:</span>
            <span>{data.cutiBersamaTerpakai} hari</span>
          </div>
          <div className="grid grid-cols-[280px_16px_1fr]">
            <span>Cuti yg sudah diambil tahun {data.tahunCuti}</span>
            <span>:</span>
            <span>{data.cutiSudahDiambil} hari</span>
          </div>
          <div className="grid grid-cols-[280px_16px_1fr]">
            <span>Cuti yg diambil bulan {getNamaBulan(data.tanggalMulai)}</span>
            <span>:</span>
            <span>{data.cutiDiambilSekarang} hari</span>
          </div>
          <div className="grid grid-cols-[280px_16px_1fr] font-semibold">
            <span>Sisa cuti tahun {data.tahunCuti}</span>
            <span>:</span>
            <span>{data.sisaCuti} hari</span>
          </div>
        </div>
      </div>

      {/* Penutup */}
      <p className="mt-6">
        Demikian saya sampaikan, atas perhatiannya saya ucapkan terima kasih.
      </p>

      {/* Tanda Tangan */}
      <div className="mt-10 grid grid-cols-2 gap-4">
        <div>
          <p>Hormat saya,</p>
          <div className="mt-16">
            <p>( {data.namaPemohon} )</p>
          </div>
        </div>
        <div className="text-right">
          <p>Menyetujui,</p>
          <div className="mt-16">
            <p>( {data.namaApprover ?? "________________"} )</p>
            {data.jabatanApprover && (
              <p className="text-xs text-gray-600">{data.jabatanApprover}</p>
            )}
            {data.approvalCode && data.approvedAt && (
              <div className="mt-2 border-t border-gray-300 pt-1 text-xs text-gray-500">
                <p>Disetujui digital via ARKA</p>
                <p>{formatTanggalWaktuIndo(data.approvedAt)} · {data.approvalCode}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Catatan */}
      <div className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-600">
        <p>Catatan :</p>
        <p>No. Telepon yang dapat dihubungi selama cuti : {data.noHpPemohon}</p>
      </div>
    </div>
  );
}
