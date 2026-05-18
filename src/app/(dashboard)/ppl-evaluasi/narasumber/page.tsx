import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { NarasumberListClient } from "@/components/ppl-evaluasi/NarasumberListClient";
import { listNarasumber } from "@/server/actions/ppl-evaluasi/narasumber";

export const metadata: Metadata = {
  title: "Narasumber | PPL Evaluasi | ARKA",
};

export default async function NarasumberPage() {
  const initialData = await listNarasumber({ page: 1, pageSize: 10 });

  return (
    <PageWrapper
      title="Narasumber"
      description="Kelola profil narasumber, keahlian, dan fee honorarium per SKP."
    >
      <NarasumberListClient initialData={initialData} />
    </PageWrapper>
  );
}
