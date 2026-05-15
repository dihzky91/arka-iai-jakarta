import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/server/actions/auth";
import { getPenilaianDetail } from "@/server/actions/penilaianKinerja";
import { PenilaianDetail } from "@/components/penilaian-kinerja/PenilaianDetail";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PenilaianDetailPage({ params }: Props) {
  await requirePermission("penilaianKinerja", "create");
  const { id } = await params;

  const penilaian = await getPenilaianDetail(id);
  if (!penilaian) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/penilaian-kinerja">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Penilaian Kinerja
          </Link>
        </Button>
      </div>
      <PenilaianDetail data={penilaian} />
    </div>
  );
}
