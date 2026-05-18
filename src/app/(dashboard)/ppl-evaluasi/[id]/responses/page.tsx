import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { getKegiatan } from "@/server/actions/ppl-evaluasi/kegiatan";
import { listResponses } from "@/server/actions/ppl-evaluasi/responses";
import { getFieldAnalytics } from "@/server/actions/ppl-evaluasi/analytics";
import { ResponsesListClient } from "@/components/ppl-evaluasi/ResponsesListClient";
import { FieldAnalyticsClient } from "@/components/ppl-evaluasi/FieldAnalyticsClient";

export const metadata: Metadata = {
  title: "Responses Kegiatan PPL | ARKA",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ResponsesPage({ params }: Props) {
  const { id } = await params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) notFound();

  const kegiatan = await getKegiatan(numericId);

  if (!kegiatan) notFound();

  const [initialData, fieldAnalytics] = await Promise.all([
    listResponses(numericId, { page: 1, pageSize: 10 }),
    getFieldAnalytics(numericId),
  ]);

  return (
    <PageWrapper
      title="Responses"
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

      {/* Field Analytics Section */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Analitik Evaluasi</h2>
        <FieldAnalyticsClient
          analytics={fieldAnalytics}
          totalRespondents={initialData.total}
          realisasiHadir={kegiatan.realisasiHadir}
        />
      </div>

      {/* Responses List */}
      <ResponsesListClient kegiatanId={kegiatan.id} initialData={initialData} />
    </PageWrapper>
  );
}
