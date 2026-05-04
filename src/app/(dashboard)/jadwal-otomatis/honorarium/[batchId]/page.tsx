import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { HonorariumBatchDetail } from "@/components/jadwal-otomatis/HonorariumBatchDetail";
import { Button } from "@/components/ui/button";
import { getCurrentUserAccess, getSession } from "@/server/actions/auth";
import {
  getHonorariumBatchDetail,
  listHonorariumDeductions,
  listHonorariumPaymentProofs,
} from "@/server/actions/jadwal-otomatis/honorarium";
import { getSystemSettings } from "@/server/actions/systemSettings";

export const metadata: Metadata = {
  title: "Detail Batch Honorarium | ARKA",
};

type PageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { batchId } = await params;

  const [detail, session, deductions, paymentProofs, access, systemSettings] =
    await Promise.all([
      getHonorariumBatchDetail(batchId),
      getSession(),
      listHonorariumDeductions(batchId),
      listHonorariumPaymentProofs(batchId),
      getCurrentUserAccess(),
      getSystemSettings(),
    ]);

  if (!detail) notFound();

  const role = (session?.user as { role?: string } | undefined)?.role;
  const canManage = role === "admin" || role === "staff";
  const isAdmin = role === "admin" || access?.isSuperAdmin === true;

  const capabilities = access?.capabilities ?? [];
  const canProcess = access?.isSuperAdmin
    ? true
    : capabilities.includes("keuangan:process");
  const canPay = access?.isSuperAdmin
    ? true
    : capabilities.includes("keuangan:pay");

  return (
    <PageWrapper
      title={`Batch ${detail.batch.documentNumber}`}
      description={`Periode ${detail.batch.periodStart} s.d. ${detail.batch.periodEnd}`}
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/jadwal-otomatis/honorarium">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Daftar Batch
          </Link>
        </Button>
      </div>

      <HonorariumBatchDetail
        initialData={detail}
        initialDeductions={deductions}
        initialPaymentProofs={paymentProofs}
        canManage={canManage}
        isAdmin={isAdmin}
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
