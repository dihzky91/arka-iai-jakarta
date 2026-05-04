import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { HonorariumBatchDetail } from "@/components/jadwal-otomatis/HonorariumBatchDetail";
import { Button } from "@/components/ui/button";
import { getCurrentUserAccess } from "@/server/actions/auth";
import {
  getHonorariumBatchDetail,
  listHonorariumDeductions,
  listHonorariumPaymentProofs,
} from "@/server/actions/jadwal-otomatis/honorarium";
import { getSystemSettings } from "@/server/actions/systemSettings";

export const metadata: Metadata = {
  title: "Detail Batch | Keuangan | ARKA",
};

type PageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { batchId } = await params;

  const [detail, deductions, paymentProofs, access, systemSettings] = await Promise.all([
    getHonorariumBatchDetail(batchId),
    listHonorariumDeductions(batchId),
    listHonorariumPaymentProofs(batchId),
    getCurrentUserAccess(),
    getSystemSettings(),
  ]);

  if (!detail) notFound();

  const isSuperAdmin = access?.isSuperAdmin === true;
  const capabilities = access?.capabilities ?? [];

  const canProcess = isSuperAdmin || capabilities.includes("keuangan:process");
  const canPay = isSuperAdmin || capabilities.includes("keuangan:pay");

  return (
    <PageWrapper
      title={`Batch ${detail.batch.documentNumber}`}
      description={`Periode ${detail.batch.periodStart} s.d. ${detail.batch.periodEnd}`}
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/keuangan/honorarium">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Antrian
          </Link>
        </Button>
      </div>

      <HonorariumBatchDetail
        initialData={detail}
        initialDeductions={deductions}
        initialPaymentProofs={paymentProofs}
        canManage={false}
        isAdmin={isSuperAdmin}
        canProcess={canProcess}
        canPay={canPay}
        systemIdentity={{
          namaSistem: systemSettings.namaSistem,
          logoUrl: systemSettings.logoUrl,
        }}
      />
    </PageWrapper>
  );
}
