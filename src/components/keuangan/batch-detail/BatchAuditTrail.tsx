import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { HonorariumBatchDetail } from "@/server/actions/jadwal-otomatis/honorarium";
import { formatTanggalWaktuJakarta } from "@/lib/utils";
import { History } from "lucide-react";

function actionLabel(action: string) {
  const map: Record<string, string> = {
    generated_draft: "Generate Draft",
    submitted_to_finance: "Kirim ke Keuangan",
    finance_processing_started: "Mulai Proses Keuangan",
    finance_paid: "Tandai Dibayar",
    finance_payment_corrected: "Koreksi Pembayaran",
    batch_locked: "Lock Batch",
    batch_reopened: "Reopen Batch",
    deduction_added: "Tambah Potongan",
    deduction_removed: "Hapus Potongan",
    payment_proof_uploaded: "Upload Bukti Pembayaran",
    batch_exported_excel: "Export Excel",
    batch_exported_pdf: "Export PDF",
  };
  return map[action] ?? action;
}

export function BatchAuditTrail({
  auditLogs,
}: {
  auditLogs: HonorariumBatchDetail["auditLogs"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {auditLogs.length === 0 ? (
          <EmptyState
            icon={History}
            title="Belum ada log audit"
            description="Aktivitas keuangan pada batch ini akan tercatat di sini."
            className="min-h-36"
          />
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border/60 p-4 transition-colors hover:bg-muted/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {actionLabel(log.action)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.actorName}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="rounded-full px-3 py-1 text-[11px]"
                  >
                    {formatTanggalWaktuJakarta(log.createdAt)}
                  </Badge>
                </div>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  {JSON.stringify(log.payload ?? {}, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
