import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SuratKeluarReviewPage } from "@/components/surat-keluar/SuratKeluarReviewPage";
import { getSession } from "@/server/actions/auth";
import { getSuratKeluarReviewById } from "@/server/actions/suratKeluar";

export const metadata: Metadata = {
  title: "Reviu Surat Keluar | ARKA",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  const surat = await getSuratKeluarReviewById(id);

  if (!surat) notFound();

  const reviewerName =
    (session?.user as { namaLengkap?: string; name?: string } | undefined)
      ?.namaLengkap ??
    session?.user.name ??
    "Pejabat";

  return <SuratKeluarReviewPage surat={surat} reviewerName={reviewerName} />;
}
