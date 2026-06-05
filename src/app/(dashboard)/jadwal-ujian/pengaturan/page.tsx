import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { JadwalUjianPengaturan } from "@/components/jadwal-ujian/JadwalUjianPengaturan";
import { listKonfig } from "@/server/actions/jadwal-ujian/config";

export const metadata: Metadata = {
  title: "Pengaturan Jadwal Ujian | ARKA",
};

export default async function Page() {
  // listKonfig() sudah memanggil requirePermission("jadwalUjian", "configure")
  // yang akan throw Forbidden jika user bukan admin/punya capability.
  // Tidak perlu manual getSession() + role check lagi.
  const rows = await listKonfig();

  return (
    <PageWrapper
      title="Pengaturan Jadwal Ujian"
      description="Kelola nilai program, tipe, dan mode yang tersedia saat membuat kelas ujian."
    >
      <JadwalUjianPengaturan rows={rows} />
    </PageWrapper>
  );
}
