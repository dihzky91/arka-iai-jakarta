"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Download } from "lucide-react";
import { formatTanggalWaktuJakarta } from "@/lib/utils";
import type { HonorariumBatchDetail } from "@/server/actions/jadwal-otomatis/honorarium";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  dikirim_ke_keuangan: "Dikirim ke Keuangan",
  diproses_keuangan: "Diproses Keuangan",
  dibayar: "Dibayar",
  locked: "Locked",
};

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function PelatihanBatchHeader({
  batch,
  systemIdentity,
  onExportPdf,
  onExportExcel,
  isPending,
}: {
  batch: HonorariumBatchDetail["batch"];
  systemIdentity?: { namaSistem: string; logoUrl: string | null };
  onExportPdf: () => void;
  onExportExcel: () => void;
  isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">
              Batch {batch.documentNumber}
            </CardTitle>
            <CardDescription>
              Periode {batch.periodStart} - {batch.periodEnd}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full px-3 py-1">
                {statusLabels[batch.status] ?? batch.status}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={onExportPdf}
                disabled={isPending}
              >
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onExportExcel}
                disabled={isPending}
              >
                <Download className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 rounded-lg bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Jumlah Sesi
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {batch.itemCount}
          </p>
        </div>
        <div className="space-y-2 rounded-lg bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Total Batch
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(batch.totalAmount)}
          </p>
        </div>
        <div className="space-y-2 rounded-lg bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Dibuat oleh
          </p>
          <p className="text-sm font-medium">{batch.generatedByName || "-"}</p>
          <p className="text-xs text-muted-foreground">
            {formatTanggalWaktuJakarta(batch.createdAt)}
          </p>
        </div>
        <div className="space-y-2 rounded-lg bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Dibayar oleh
          </p>
          <p className="text-sm font-medium">{batch.paidByName || "-"}</p>
          {batch.paidAt ? (
            <p className="text-xs text-muted-foreground">
              {formatTanggalWaktuJakarta(batch.paidAt)}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
