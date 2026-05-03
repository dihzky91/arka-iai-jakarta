import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { GenerateBatchForm } from "@/components/sertifikat/GenerateBatchForm";
import { Button } from "@/components/ui/button";
import { listCertificateBatchClasses } from "@/server/actions/sertifikat/nomor/batches";
import { listClassTypes } from "@/server/actions/jadwal-otomatis/classTypes";
import { listPrograms } from "@/server/actions/jadwal-otomatis/programs";
import {
  getSerialConfig,
} from "@/server/actions/sertifikat/nomor/classTypes";

export const metadata: Metadata = {
  title: "Generate Batch Sertifikat | ARKA",
  description:
    "Generate batch nomor sertifikat baru dengan sistem serial berkesinambungan.",
};

export default async function Page() {
  const [classes, programs, classTypes, serialInfo] = await Promise.all([
    listCertificateBatchClasses(),
    listPrograms(),
    listClassTypes(),
    getSerialConfig(),
  ]);

  return (
    <PageWrapper
      title="Generate Batch Baru"
      description="Buat batch nomor sertifikat baru. Nomor akan melanjutkan serial global yang ada."
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/sertifikat/nomor">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Daftar Batch
          </Link>
        </Button>
      </div>

      <GenerateBatchForm
        classes={classes}
        programs={programs}
        classTypes={classTypes}
        lastSerial={serialInfo.lastSerialNumber}
      />
    </PageWrapper>
  );
}
