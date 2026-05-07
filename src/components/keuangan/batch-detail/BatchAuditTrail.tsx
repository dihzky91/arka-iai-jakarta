import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HonorariumBatchDetail } from "@/server/actions/jadwal-otomatis/honorarium";

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
    <Card className="rounded-[28px]">
      <CardHeader>
        <CardTitle>Audit Trail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {auditLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Belum ada log audit untuk batch ini.
          </div>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{actionLabel(log.action)}</p>
                    <p className="text-xs text-muted-foreground">{log.actorName}</p>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                    {new Date(log.createdAt).toLocaleString("id-ID")}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{JSON.stringify(log.payload ?? {}, null, 2)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
