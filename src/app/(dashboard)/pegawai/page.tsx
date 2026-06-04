import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { PegawaiManager } from "@/components/pegawai/PegawaiManager";
import { getSession } from "@/server/actions/auth";
import { listDivisi } from "@/server/actions/divisi";
import { listPegawaiWithBiodata } from "@/server/actions/pegawai";

export const metadata: Metadata = {
  title: "Data Pegawai | ARKA",
};

export default async function Page() {
  const [session, pegawaiResult, divisiRows] = await Promise.all([
    getSession(),
    listPegawaiWithBiodata(),
    listDivisi(),
  ]);

  const sessionUser = session?.user as
    | { id?: string; role?: string }
    | undefined;
  const role = sessionUser?.role;
  const canManage = role === "admin";
  const currentUserId = sessionUser?.id ?? null;

  return (
    <PageWrapper
      title="Data Pegawai"
      description="Kelola data dasar pegawai dan lanjutkan pengisian detail per tab."
    >
      <PegawaiManager
        initialData={pegawaiResult.rows}
        divisiOptions={divisiRows.map((row) => ({
          id: row.id,
          nama: row.nama,
        }))}
        canManage={canManage}
        currentUserId={currentUserId}
      />
    </PageWrapper>
  );
}
