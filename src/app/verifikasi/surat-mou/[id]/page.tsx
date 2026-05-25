import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VerificationSuratMouPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/verifikasi/surat-keluar/${id}`);
}
