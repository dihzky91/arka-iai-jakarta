import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { FinanceBatchList } from "@/components/keuangan/FinanceBatchList";
import { listHonorariumBatchesPage } from "@/server/actions/jadwal-otomatis/honorarium";

export const metadata: Metadata = {
  title: "Antrian Pembayaran | Keuangan | ARKA",
};

const VALID_STATUS_FILTERS = [
  "dikirim_ke_keuangan",
  "diproses_keuangan",
  "dibayar",
  "locked",
] as const;

type StatusFilter = (typeof VALID_STATUS_FILTERS)[number];

function parseStatus(
  value: string | string[] | undefined,
): StatusFilter | undefined {
  const status = Array.isArray(value) ? value[0] : value;
  return VALID_STATUS_FILTERS.includes(status as StatusFilter)
    ? (status as StatusFilter)
    : undefined;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : {};
  const status = parseStatus(params.status);
  const batchPage = await listHonorariumBatchesPage({
    financeOnly: true,
    status,
    page: 1,
    pageSize: 10,
    sortBy: "submittedAt",
    sortDir: "asc",
  });

  return (
    <PageWrapper
      title="Antrian Pembayaran Honorarium"
      description="Daftar batch honorarium yang dikirim ke keuangan."
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/keuangan">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Dashboard Keuangan
          </Link>
        </Button>
      </div>

      <FinanceBatchList
        initialPage={batchPage}
        initialStatus={status ?? "all"}
      />
    </PageWrapper>
  );
}
