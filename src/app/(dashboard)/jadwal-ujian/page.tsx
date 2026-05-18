import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { UjianTable } from "@/components/jadwal-ujian/UjianTable";
import { getSession } from "@/server/actions/auth";
import { listUjian } from "@/server/actions/jadwal-ujian/ujian";
import { listKelas } from "@/server/actions/jadwal-ujian/kelas";
import { listPengawas } from "@/server/actions/jadwal-ujian/pengawas";
import { listMateri } from "@/server/actions/jadwal-ujian/materi";
import { getAllKonfig } from "@/server/actions/jadwal-ujian/config";
import { getSystemSettings } from "@/server/actions/systemSettings";

export const metadata: Metadata = {
  title: "Jadwal Ujian | ARKA",
};

export default async function Page() {
  // getSession() and getSystemSettings() use React cache() so they
  // deduplicate with the layout calls within the same request.
  const [
    session,
    ujianResult,
    kelasList,
    pengawasList,
    materiList,
    konfig,
    systemSettings,
  ] = await Promise.all([
    getSession(),
    listUjian(),
    listKelas(),
    listPengawas(),
    listMateri(),
    getAllKonfig(),
    getSystemSettings(),
  ]);

  const role = (session?.user as { role?: string } | undefined)?.role;
  const canManage = role === "admin" || role === "staff";

  return (
    <PageWrapper
      title="Jadwal Ujian"
      description="Daftar seluruh jadwal ujian, penugasan pengawas, dan status konflik."
    >
      <UjianTable
        initialData={ujianResult.rows}
        kelasList={kelasList.map((k) => ({
          id: k.id,
          namaKelas: k.namaKelas,
          program: k.program,
        }))}
        pengawasList={pengawasList.map((p) => ({
          id: p.id,
          nama: p.nama,
          jumlahTugas: p.jumlahTugas,
        }))}
        materiList={materiList.map((m) => ({
          id: m.id,
          nama: m.nama,
          program: m.program,
        }))}
        canManage={canManage}
        programOptions={konfig.program}
        systemIdentity={{
          namaSistem: systemSettings.namaSistem,
          logoUrl: systemSettings.logoUrl,
        }}
      />
    </PageWrapper>
  );
}
