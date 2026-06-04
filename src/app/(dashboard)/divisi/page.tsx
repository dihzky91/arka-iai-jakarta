import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { DivisiManager } from "@/components/divisi/DivisiManager";
import { getSession } from "@/server/actions/auth";
import { listDivisi } from "@/server/actions/divisi";

export const metadata: Metadata = {
  title: "Divisi | ARKA",
};

export default async function Page() {
  const [session, data] = await Promise.all([getSession(), listDivisi()]);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canManage = role === "admin";

  return (
    <PageWrapper
      title="Divisi"
      description="Kelola struktur divisi internal dan pantau jumlah pegawai pada setiap unit."
    >
      <DivisiManager initialData={data} canManage={canManage} />
    </PageWrapper>
  );
}
