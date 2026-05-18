import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { FormBuilder } from "@/components/ppl-evaluasi/form-builder/FormBuilder";
import { getKegiatan } from "@/server/actions/ppl-evaluasi/kegiatan";
import { getTemplateForKegiatan } from "@/server/actions/ppl-evaluasi/kuesioner";

export const metadata: Metadata = {
  title: "Kuesioner Evaluasi | ARKA",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function KuesionerPage({ params }: Props) {
  const { id } = await params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) notFound();

  const kegiatan = await getKegiatan(numericId);
  if (!kegiatan) notFound();

  const template = await getTemplateForKegiatan(numericId);

  return (
    <PageWrapper
      title="Kuesioner Evaluasi"
      description={`Template kuesioner untuk: ${kegiatan.namaKegiatan}`}
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

      <FormBuilder
        kegiatanId={numericId}
        templateId={template?.id}
        initialNama={template?.nama ?? ""}
        initialFields={template?.fields ?? []}
        isLocked={template?.isLocked ?? false}
      />
    </PageWrapper>
  );
}
