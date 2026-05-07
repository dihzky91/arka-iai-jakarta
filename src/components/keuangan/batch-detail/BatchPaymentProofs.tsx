import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HonorariumPaymentProofRow } from "@/server/actions/jadwal-otomatis/honorarium";

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function BatchPaymentProofs({
  proofs,
}: {
  proofs: HonorariumPaymentProofRow[];
}) {
  return (
    <Card className="rounded-[28px]">
      <CardHeader>
        <CardTitle>Bukti Pembayaran</CardTitle>
        <CardDescription>Unggah dan lihat bukti bayar batch.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border bg-muted/25 p-6 text-center text-sm text-muted-foreground">
          Drag & drop area placeholder. Upload bukti pembayaran akan dikembangkan pada Tahap 2.
        </div>

        {proofs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Belum ada bukti pembayaran yang diunggah.
          </div>
        ) : (
          <div className="space-y-3">
            {proofs.map((proof) => (
              <div key={proof.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{proof.fileName}</p>
                    <p className="text-xs text-muted-foreground">{proof.uploaderName ?? "-"}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(proof.fileSize)}</span>
                    <Badge variant="outline">{proof.mimeType}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Diunggah: {proof.uploadedAt.toLocaleString("id-ID")}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
