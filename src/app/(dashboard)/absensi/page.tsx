import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { AbsensiManager } from "@/components/absensi/AbsensiManager";
import { requireSession } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: "Absensi Karyawan | ARKA",
};

export default async function Page() {
  const session = await requireSession();

  return (
    <PageWrapper
      title="Absensi Karyawan"
      description="Rekap kehadiran karyawan harian."
    >
      <AbsensiManager
        currentUserId={session.user.id}
      />
    </PageWrapper>
  );
}
