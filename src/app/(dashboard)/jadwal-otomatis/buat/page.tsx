import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { FormBuatKelasOtomatis } from "@/components/jadwal-otomatis/FormBuatKelasOtomatis";
import { listPrograms } from "@/server/actions/jadwal-otomatis/programs";
import { listClassTypes } from "@/server/actions/jadwal-otomatis/classTypes";
import { getSystemSettings } from "@/server/actions/systemSettings";

export const metadata: Metadata = {
  title: "Buat Kelas Baru | Jadwal Otomatis | ARKA",
};

export default async function Page() {
  const [programs, classTypeList, systemSettings] = await Promise.all([
    listPrograms(),
    listClassTypes(),
    getSystemSettings(),
  ]);

  return (
    <PageWrapper
      title="Buat Kelas Baru"
      description="Buat kelas pelatihan baru dan generate jadwal otomatis."
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/jadwal-otomatis">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Daftar Kelas
          </Link>
        </Button>
      </div>
      <FormBuatKelasOtomatis
        programs={programs}
        classTypes={classTypeList}
        defaultFinanceContact={{
          name: systemSettings.financeContactName,
          whatsappNumber: systemSettings.financeWhatsappNumber,
        }}
      />
    </PageWrapper>
  );
}
