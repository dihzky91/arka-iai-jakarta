import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { TftDetailView } from "@/components/tft/TftDetailView";
import { getPeriodeTftById } from "@/server/actions/tft/periode";
import { listPendaftarByPeriode } from "@/server/actions/tft/pendaftar";
import { listKriteria, listPenilai, getAllNilai } from "@/server/actions/tft/penilaian";

export const metadata: Metadata = {
  title: "Detail TFT | ARKA",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const periode = await getPeriodeTftById(id);

  if (!periode) notFound();

  const [pendaftar, kriteria, penilai, nilai] = await Promise.all([
    listPendaftarByPeriode(id),
    listKriteria(id),
    listPenilai(id),
    getAllNilai(id),
  ]);

  return (
    <PageWrapper
      title={periode.judul}
      description={`Status: ${periode.status} • ${pendaftar.length} pendaftar`}
      backHref="/jadwal-otomatis/tft"
    >
      <TftDetailView
        periode={periode}
        pendaftar={pendaftar}
        kriteria={kriteria}
        penilai={penilai}
        nilai={nilai}
      />
    </PageWrapper>
  );
}
