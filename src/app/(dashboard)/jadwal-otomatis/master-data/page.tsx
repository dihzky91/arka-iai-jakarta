import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { MasterDataTabs } from "@/components/jadwal-otomatis/MasterDataTabs";
import { listAllPrograms } from "@/server/actions/jadwal-otomatis/programs";
import { listAllClassTypes } from "@/server/actions/jadwal-otomatis/classTypes";
import { getSession } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: "Master Data | Jadwal Otomatis | ARKA",
};

export default async function Page() {
  const [session, programList, classTypeList] = await Promise.all([
    getSession(),
    listAllPrograms(),
    listAllClassTypes(),
  ]);

  const role = (session?.user as { role?: string } | undefined)?.role;
  const canManage = role === "admin" || role === "staff";

  return (
    <PageWrapper
      title="Master Data"
      description="Kelola program, tipe kelas, dan kurikulum untuk penjadwalan otomatis."
    >
      <MasterDataTabs
        programs={programList}
        classTypes={classTypeList}
        canManage={canManage}
      />
    </PageWrapper>
  );
}
