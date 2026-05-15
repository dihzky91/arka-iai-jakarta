import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { PenugasanManager } from "@/components/jadwal-ujian/PenugasanManager";
import { getSession } from "@/server/actions/auth";
import { getUjianById, listUjian } from "@/server/actions/jadwal-ujian/ujian";
import { getPenugasanByUjian } from "@/server/actions/jadwal-ujian/penugasan";
import { listPengawas } from "@/server/actions/jadwal-ujian/pengawas";

export const metadata: Metadata = {
  title: "Detail Ujian | ARKA",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  const [session, ujian, penugasanList, pengawasList, ujianList] =
    await Promise.all([
      getSession(),
      getUjianById(id),
      getPenugasanByUjian(id),
      listPengawas(),
      listUjian({ page: 1, pageSize: 5000 }),
    ]);

  const resolvedUjian =
    ujian ?? ujianList.rows.find((row) => row.id === id) ?? null;
  if (!resolvedUjian) notFound();

  const role = (session?.user as { role?: string } | undefined)?.role;
  const canManage = role === "admin" || role === "staff";

  return (
    <PageWrapper
      title={resolvedUjian.mataPelajaran.join(" & ")}
      description={`${resolvedUjian.namaKelas} - ${resolvedUjian.tanggalUjian} - ${resolvedUjian.jamMulai}-${resolvedUjian.jamSelesai}`}
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/jadwal-ujian">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Jadwal Ujian
          </Link>
        </Button>
      </div>
      <PenugasanManager
        ujianId={resolvedUjian.id}
        mataPelajaran={resolvedUjian.mataPelajaran.join(" & ")}
        tanggalUjian={resolvedUjian.tanggalUjian}
        jamMulai={resolvedUjian.jamMulai}
        jamSelesai={resolvedUjian.jamSelesai}
        initialPenugasan={penugasanList}
        pengawasList={pengawasList.map((p) => ({ id: p.id, nama: p.nama }))}
        canManage={canManage}
      />
    </PageWrapper>
  );
}
