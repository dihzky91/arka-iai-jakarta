import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTanggalPendek, formatTanggalWaktuJakarta } from "@/lib/utils";
import type { HonorariumBatchDetail } from "@/server/actions/jadwal-otomatis/honorarium";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  dikirim_ke_keuangan: "Dikirim ke Keuangan",
  diproses_keuangan: "Diproses Keuangan",
  dibayar: "Dibayar",
  locked: "Locked",
};

export function BatchHeader({
  batch,
  systemIdentity,
  outstandingAmount,
}: {
  batch: HonorariumBatchDetail["batch"];
  systemIdentity?: { namaSistem: string; logoUrl: string | null };
  outstandingAmount: number;
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
            <Badge className="rounded-full px-3 py-1">
              {statusLabels[batch.status] ?? batch.status}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Outstanding: Rp{" "}
              {Math.round(outstandingAmount).toLocaleString("id-ID")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-lg bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Dibuat oleh
          </p>
          <p className="text-sm font-medium">{batch.generatedByName || "-"}</p>
          <p className="text-xs text-muted-foreground">
            Dibuat: {formatTanggalWaktuJakarta(batch.createdAt)}
          </p>
        </div>
        <div className="space-y-2 rounded-lg bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Terakhir diperbarui
          </p>
          <p className="text-sm font-medium">
            {formatTanggalWaktuJakarta(batch.updatedAt)}
          </p>
          <p className="text-xs text-muted-foreground">
            {batch.paidByName
              ? `Oleh: ${batch.paidByName}`
              : systemIdentity
                ? `Sistem: ${systemIdentity.namaSistem}`
                : null}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
