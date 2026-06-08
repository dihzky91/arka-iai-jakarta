import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPeriodeTftBySlug } from "@/server/actions/tft/periode";
import { TftPublicForm } from "@/components/tft/TftPublicForm";
import { listMateri } from "@/server/actions/jadwal-ujian/materi";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const periode = await getPeriodeTftBySlug(slug);
  if (!periode) return { title: "Tidak Ditemukan" };
  return {
    title: `${periode.judul} | IAI Wilayah DKI Jakarta`,
    description: "Formulir pendaftaran Training for Trainers (TFT)",
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const periode = await getPeriodeTftBySlug(slug);

  if (!periode) notFound();

  // Check if form is open
  const isClosed =
    periode.status !== "buka" ||
    (periode.batasPendaftaran && new Date() > periode.batasPendaftaran);

  // Get materi list for checkboxes
  const materiList = await listMateri();
  const materiAb = materiList.filter((m) => m.program.toLowerCase().includes("brevet_ab") || m.program.toLowerCase().includes("ab"));
  const materiC = materiList.filter((m) => m.program.toLowerCase().includes("brevet_c") || m.program.toLowerCase().includes("c") && !m.program.toLowerCase().includes("ab"));

  return (
    <TftPublicForm
      periode={periode}
      isClosed={!!isClosed}
      materiAb={materiAb.map((m) => m.nama)}
      materiC={materiC.map((m) => m.nama)}
    />
  );
}
