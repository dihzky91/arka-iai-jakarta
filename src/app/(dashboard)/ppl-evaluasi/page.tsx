import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { KegiatanListClient } from "@/components/ppl-evaluasi/KegiatanListClient";
import { listKegiatan } from "@/server/actions/ppl-evaluasi/kegiatan";

export const metadata: Metadata = {
  title: "PPL Evaluasi | ARKA",
};

export default async function Page() {
  const initialData = await listKegiatan({ page: 1, pageSize: 10 });

  return (
    <PageWrapper
      title="Kegiatan PPL"
      description="Kelola kegiatan PPL, evaluasi, dan analytics."
      action={
        <Link href="/ppl-evaluasi/buat">
          <Button>
            <Plus className="h-4 w-4" />
            Tambah Kegiatan
          </Button>
        </Link>
      }
    >
      <KegiatanListClient initialData={initialData} />
    </PageWrapper>
  );
}
