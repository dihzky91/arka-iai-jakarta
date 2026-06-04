import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { SuratMasukManager } from "@/components/surat-masuk/SuratMasukManager";
import { getSession } from "@/server/actions/auth";
import {
  listDisposisiRecipients,
  listDisposisiTimeline,
} from "@/server/actions/disposisi";
import { listSuratMasuk } from "@/server/actions/suratMasuk";

export const metadata: Metadata = {
  title: "Arsip Surat Masuk | ARKA",
};

export default async function Page() {
  const [session, data, timeline, recipients] = await Promise.all([
    getSession(),
    listSuratMasuk(),
    listDisposisiTimeline(),
    listDisposisiRecipients(),
  ]);

  const role = (session?.user as { role?: string } | undefined)?.role ?? null;

  return (
    <PageWrapper
      title="Arsip Surat Masuk"
      description="Catat surat masuk, buka detail arsip, dan teruskan ke alur disposisi saat perlu tindak lanjut."
    >
      <SuratMasukManager
        initialData={data}
        timeline={timeline}
        recipients={recipients}
        role={role}
      />
    </PageWrapper>
  );
}
