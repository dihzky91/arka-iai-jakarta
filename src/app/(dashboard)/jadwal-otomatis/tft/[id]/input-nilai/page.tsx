import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { TftInputNilaiView } from "@/components/tft/TftInputNilaiView";
import { getPeriodeTftById } from "@/server/actions/tft/periode";
import { listPendaftarByPeriode } from "@/server/actions/tft/pendaftar";
import { listKriteria, listPenilai, getAllNilai } from "@/server/actions/tft/penilaian";

export const metadata: Metadata = {
  title: "Input Nilai TFT | ARKA",
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
      title={`Input Nilai — ${periode.judul}`}
      description="Input skor penilaian per penilai."
      backHref={`/jadwal-otomatis/tft/${id}`}
    >
      <TftInputNilaiView
        periodeId={id}
        pendaftar={pendaftar}
        kriteria={kriteria}
        penilai={penilai}
        existingNilai={nilai}
      />
    </PageWrapper>
  );
}
