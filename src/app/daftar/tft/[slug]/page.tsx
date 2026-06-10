import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { getPeriodeTftBySlug } from "@/server/actions/tft/periode";
import { TftPublicForm, type ClosedReason } from "@/components/tft/TftPublicForm";
import { listMateri } from "@/server/actions/jadwal-ujian/materi";
import { db } from "@/server/db";
import { pendaftarTft } from "@/server/db/schema";
import { getSession } from "@/server/actions/auth";
import { listPertanyaanPublic, type PertanyaanTftRow } from "@/server/actions/tft/pertanyaan";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const periode = await getPeriodeTftBySlug(slug);
  if (!periode) return { title: "Tidak Ditemukan" };
  return {
    title: `${periode.judul} | IAI Wilayah DKI Jakarta`,
    description: "Formulir pendaftaran Training for Trainers (TFT)",
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const periode = await getPeriodeTftBySlug(slug);

  if (!periode) notFound();

  // Admin preview mode: bypass status check if logged-in admin
  let isAdminPreview = false;
  if (preview === "1") {
    try {
      const session = await getSession();
      if (session) {
        isAdminPreview = true;
      }
    } catch {
      // Not logged in — ignore, treat as public access
    }
  }

  // Determine closed reason with contextual messaging
  let closedReason: ClosedReason | null = null;

  if (!isAdminPreview) {
    if (periode.status === "draft") {
      closedReason = "belum_dibuka";
    } else if (periode.status === "tutup") {
      closedReason = "ditutup";
    } else if (periode.status === "penilaian" || periode.status === "selesai") {
      closedReason = "selesai";
    } else if (periode.status === "buka") {
      // Check batas pendaftaran
      if (periode.batasPendaftaran && new Date() > periode.batasPendaftaran) {
        closedReason = "lewat_batas";
      }
      // Check max peserta
      if (!closedReason && periode.maxPeserta) {
        const result = await db
          .select({ total: count() })
          .from(pendaftarTft)
          .where(eq(pendaftarTft.periodeId, periode.id));
        if (result[0] && result[0].total >= periode.maxPeserta) {
          closedReason = "kuota_penuh";
        }
      }
    }
  }

  // Get materi list for checkboxes
  const materiList = await listMateri();
  const materiAb = materiList.filter((m) => m.program.toLowerCase().includes("brevet_ab") || m.program.toLowerCase().includes("ab"));
  const materiC = materiList.filter((m) => m.program.toLowerCase().includes("brevet_c") || m.program.toLowerCase().includes("c") && !m.program.toLowerCase().includes("ab"));

  // Get custom questions for this periode
  const pertanyaanCustom = await listPertanyaanPublic(periode.id);

  return (
    <TftPublicForm
      periode={periode}
      closedReason={closedReason}
      isAdminPreview={isAdminPreview}
      materiAb={materiAb.map((m) => m.nama)}
      materiC={materiC.map((m) => m.nama)}
      pertanyaan={pertanyaanCustom}
    />
  );
}
