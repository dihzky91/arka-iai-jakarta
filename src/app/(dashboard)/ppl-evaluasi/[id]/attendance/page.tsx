import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { getKegiatan } from "@/server/actions/ppl-evaluasi/kegiatan";
import { AttendanceForm } from "@/components/ppl-evaluasi/AttendanceForm";

export const metadata: Metadata = {
  title: "Kehadiran Kegiatan PPL | ARKA",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AttendancePage({ params }: Props) {
  const { id } = await params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) notFound();

  const kegiatan = await getKegiatan(numericId);

  if (!kegiatan) notFound();

  return (
    <PageWrapper
      title="Registrasi & Kehadiran"
      description={kegiatan.namaKegiatan}
    >
      {/* Back button */}
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href={`/ppl-evaluasi/${kegiatan.id}`}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Detail Kegiatan
          </Link>
        </Button>
      </div>

      <AttendanceForm
        kegiatanId={kegiatan.id}
        pendaftar={kegiatan.pendaftar}
        realisasiHadir={kegiatan.realisasiHadir}
        isArchived={kegiatan.statusEvent === "archived"}
      />
    </PageWrapper>
  );
}
