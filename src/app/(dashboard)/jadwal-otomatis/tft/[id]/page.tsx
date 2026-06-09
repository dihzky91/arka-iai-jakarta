import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { TftDetailView } from "@/components/tft/TftDetailView";
import { getPeriodeTftById, listPeriodeTft } from "@/server/actions/tft/periode";
import { listPendaftarByPeriode } from "@/server/actions/tft/pendaftar";
import { listKriteria, listPenilai, getAllNilai } from "@/server/actions/tft/penilaian";
import { listPertanyaan } from "@/server/actions/tft/pertanyaan";

export const metadata: Metadata = {
  title: "Detail TFT | ARKA",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const periode = await getPeriodeTftById(id);

  if (!periode) notFound();

  const [pendaftar, kriteria, penilai, nilai, pertanyaan, periodeOptions] = await Promise.all([
    listPendaftarByPeriode(id),
    listKriteria(id),
    listPenilai(id),
    getAllNilai(id),
    listPertanyaan(id),
    listPeriodeTft(),
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
        pertanyaan={pertanyaan}
        periodeOptions={periodeOptions.filter((p) => p.id !== periode.id)}
      />
    </PageWrapper>
  );
}
