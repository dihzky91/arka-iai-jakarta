import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { SuratKeluarManager } from "@/components/surat-keluar/SuratKeluarManager";
import { getSession } from "@/server/actions/auth";
import {
  listSuratKeluar,
  listPejabatAktif,
  listDivisiOptions,
} from "@/server/actions/suratKeluar";

export const metadata: Metadata = {
  title: "Arsip Surat Keluar | ARKA",
};

type PageProps = {
  searchParams: Promise<{ jenis?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const [session, data, pejabatList, divisiList, sp] = await Promise.all([
    getSession(),
    listSuratKeluar(),
    listPejabatAktif(),
    listDivisiOptions(),
    searchParams,
  ]);

  const role = (session?.user as { role?: string } | undefined)?.role ?? null;

  return (
    <PageWrapper
      title="Arsip Surat Keluar"
      description="Pengelolaan surat keluar dari draft hingga arsip."
    >
      <SuratKeluarManager
        initialData={data}
        pejabatList={pejabatList}
        divisiList={divisiList}
        role={role}
        defaultJenisFilter={sp.jenis}
      />
    </PageWrapper>
  );
}
