import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { PegawaiManager } from "@/components/pegawai/PegawaiManager";
import { getSession } from "@/server/actions/auth";
import { listDivisi } from "@/server/actions/divisi";
import { getPegawaiById, listPegawai } from "@/server/actions/pegawai";

export const metadata: Metadata = {
  title: "Data Pegawai | ARKA",
};

export default async function Page() {
  const [session, pegawaiResult, divisiRows] = await Promise.all([
    getSession(),
    listPegawai(),
    listDivisi(),
  ]);

  const detailRows = await Promise.all(
    pegawaiResult.rows.map(async (row) => {
      const detail = await getPegawaiById(row.id);
      return {
        ...row,
        biodata: detail.biodata,
      };
    }),
  );

  const sessionUser = session?.user as
    | { id?: string; role?: string }
    | undefined;
  const role = sessionUser?.role;
  const canManage = role === "admin";
  const currentUserId = sessionUser?.id ?? null;

  return (
    <PageWrapper
      title="Data Pegawai"
      description="Daftar dan manajemen pegawai."
    >
      <PegawaiManager
        initialData={detailRows}
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
