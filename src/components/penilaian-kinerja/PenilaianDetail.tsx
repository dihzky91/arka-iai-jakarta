"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, FileText, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PenilaianDetailFull } from "@/server/actions/penilaianKinerja";
import { approvePenilaian } from "@/server/actions/penilaianKinerja";

interface PenilaianDetailProps {
  data: PenilaianDetailFull;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline"; icon: typeof Clock }
> = {
  draft: { label: "Draft", variant: "outline", icon: FileText },
  submitted: { label: "Disubmit", variant: "secondary", icon: Send },
  reviewed: { label: "Direview", variant: "default", icon: CheckCircle2 },
  finalized: { label: "Final", variant: "default", icon: CheckCircle2 },
};

export function PenilaianDetail({ data }: PenilaianDetailProps) {
  const router = useRouter();
  const [showApprove, setShowApprove] = useState(false);
  const [approveAction, setApproveAction] = useState<"review" | "finalize">("review");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);

  const tugasItems = data.items.filter((i) => i.tipe === "tugas");
  const perilakuItems = data.items.filter((i) => i.tipe === "perilaku");

  const statusConfig = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.draft!;

  async function handleApprove() {
    setLoading(true);
    try {
      const result = await approvePenilaian({
        id: data.id,
        action: approveAction,
        catatan: catatan || undefined,
      });
      if (result.ok) {
        toast.success(
          approveAction === "review"
            ? "Penilaian berhasil direview"
            : "Penilaian berhasil difinalisasi",
        );
        router.refresh();
      } else {
        toast.error(result.error ?? "Gagal memproses");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
      setShowApprove(false);
      setCatatan("");
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            Penilaian: {data.namaKaryawan}
          </h1>
          <p className="text-muted-foreground">
            {data.jabatan ?? ""} {data.divisiNama ? `— ${data.divisiNama}` : ""}
            {" · "}Periode: {data.periodeNama}
          </p>
        </div>
        <Badge variant={statusConfig.variant} className="text-sm px-3 py-1">
          {statusConfig.label}
        </Badge>
      </div>

      {/* Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <p className="text-sm text-muted-foreground">Penilai</p>
              <p className="font-medium">{data.namaPenilai}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nilai Tugas</p>
              <p className="text-xl font-semibold font-mono">
                {data.totalNilaiTugas
                  ? parseFloat(data.totalNilaiTugas).toFixed(1)
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nilai Perilaku</p>
              <p className="text-xl font-semibold font-mono">
                {data.totalNilaiPerilaku
                  ? parseFloat(data.totalNilaiPerilaku).toFixed(1)
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nilai Akhir</p>
              <p className="text-2xl font-semibold font-mono text-primary">
                {data.nilaiAkhir
                  ? parseFloat(data.nilaiAkhir).toFixed(1)
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
          </div>
          {data.catatan && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Catatan</p>
              <p className="text-sm">{data.catatan}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tugas Detail */}
      {tugasItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Penilaian Pelaksanaan Tugas</CardTitle>
            <CardDescription>
              Total:{" "}
              <span className="font-mono font-semibold">
                {data.totalNilaiTugas
                  ? parseFloat(data.totalNilaiTugas).toFixed(1)
                  : "-"}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetailTable items={tugasItems} />
          </CardContent>
        </Card>
      )}

      {/* Perilaku Detail */}
      {perilakuItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Penilaian Perilaku</CardTitle>
            <CardDescription>
              Total:{" "}
              <span className="font-mono font-semibold">
                {data.totalNilaiPerilaku
                  ? parseFloat(data.totalNilaiPerilaku).toFixed(1)
                  : "-"}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetailTable items={perilakuItems} />
          </CardContent>
        </Card>
      )}

      {/* Approval Actions */}
      {(data.status === "submitted" || data.status === "reviewed") && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Link
                href={`/absensi?userId=${data.userId}`}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Lihat data absensi karyawan
              </Link>
              <div className="flex gap-2">
                {data.status === "submitted" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setApproveAction("review");
                      setShowApprove(true);
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Review
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setApproveAction("finalize");
                    setShowApprove(true);
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Finalisasi
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <AlertDialog open={showApprove} onOpenChange={setShowApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approveAction === "review"
                ? "Review Penilaian"
                : "Finalisasi Penilaian"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approveAction === "review"
                ? "Tandai penilaian ini sebagai sudah direview."
                : "Finalisasi penilaian ini. Setelah final, karyawan dapat melihat hasilnya."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Catatan (opsional)</Label>
            <Textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Tambahkan catatan..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={loading}>
              {loading ? "Memproses..." : "Konfirmasi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Sub-component: DetailTable ───────────────────────────────────────────────

function DetailTable({
  items,
}: {
  items: PenilaianDetailFull["items"];
}) {
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">No</TableHead>
            <TableHead>Keterangan</TableHead>
            <TableHead className="w-20 text-center">Nilai</TableHead>
            <TableHead className="w-20 text-center">Bobot</TableHead>
            <TableHead className="w-28 text-center">Terbobot</TableHead>
            <TableHead>Keterangan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="text-center">{item.itemNomor}</TableCell>
              <TableCell className="text-sm">{item.itemKeterangan}</TableCell>
              <TableCell className="text-center font-mono">
                {item.nilai}
              </TableCell>
              <TableCell className="text-center font-mono">
                {parseFloat(item.bobot).toFixed(2)}
              </TableCell>
              <TableCell className="text-center font-mono font-semibold">
                {parseFloat(item.nilaiTerbobot).toFixed(1)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {item.keterangan ?? "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
