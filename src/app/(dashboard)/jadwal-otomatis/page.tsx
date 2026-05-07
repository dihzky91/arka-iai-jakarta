import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { KelasOtomatisTable } from "@/components/jadwal-otomatis/KelasOtomatisTable";
import { listKelasOtomatis } from "@/server/actions/jadwal-otomatis/kelasOtomatis";
import { getSession } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: "Jadwal Otomatis | ARKA",
};

export default async function Page() {
  const [session, data] = await Promise.all([
    getSession(),
    listKelasOtomatis(),
  ]);

  const role = (session?.user as { role?: string } | undefined)?.role;
  const canManage = role === "admin" || role === "staff";

  return (
    <PageWrapper
      title="Jadwal Otomatis Brevet"
      description="Kelola kelas pelatihan dengan penjadwalan otomatis berdasarkan kurikulum."
      action={
        canManage ? (
          <>
            <Link href="/jadwal-otomatis/master-data">
              <Button variant="outline">
                <Settings className="h-4 w-4" />
                Master Data
              </Button>
            </Link>
            <Link href="/jadwal-otomatis/buat">
              <Button>
                <Plus className="h-4 w-4" />
                Buat Kelas Baru
              </Button>
            </Link>
          </>
        ) : undefined
      }
    >
      <KelasOtomatisTable initialData={data} canManage={canManage} />
    </PageWrapper>
  );
}
