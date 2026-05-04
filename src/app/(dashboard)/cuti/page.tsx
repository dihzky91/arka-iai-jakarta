import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { CutiManager } from "@/components/cuti/CutiManager";
import { requireSession } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: "Pengajuan Cuti | ARKA",
};

export default async function Page() {
  const session = await requireSession();

  return (
    <PageWrapper
      title="Pengajuan Cuti"
      description="Ajukan dan kelola cuti karyawan."
    >
      <CutiManager currentUserId={session.user.id} />
    </PageWrapper>
  );
}
