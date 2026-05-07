import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Laporan Keuangan | ARKA",
};

export default function Page() {
  return (
    <PageWrapper
      title="Laporan & Rekap Keuangan"
      description="Laporan pembayaran honorarium dan rekap periodik untuk tim keuangan."
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/keuangan">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Dashboard Keuangan
          </Link>
        </Button>
      </div>

      <div className="space-y-4 rounded-[28px] border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Laporan Keuangan</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Halaman ini akan menampilkan ringkasan laporan bulanan, rekap per instruktur,
          dan export data periodik untuk tim keuangan.
        </p>
        <div className="rounded-2xl border border-dashed border-border bg-background px-6 py-10 text-center text-sm text-muted-foreground">
          Pekerjaan tahap 1 selesai: route laporan terpasang dan siap dikembangkan lebih lanjut.
        </div>
      </div>
    </PageWrapper>
  );
}
