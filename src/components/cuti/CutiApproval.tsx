"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listPengajuanCuti, type CutiRow } from "@/server/actions/cuti";
import { approveCuti } from "@/server/actions/dingtalk/submit-leave";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  diajukan: "bg-blue-100 text-blue-800",
  disetujui: "bg-green-100 text-green-800",
  ditolak: "bg-red-100 text-red-800",
  dibatalkan: "bg-yellow-100 text-yellow-800",
};

const JENIS_LABEL: Record<string, string> = {
  tahunan: "Cuti Tahunan",
  sakit: "Cuti Sakit",
  melahirkan: "Cuti Melahirkan",
  menikah: "Cuti Menikah",
  kematian: "Cuti Kematian",
  lainnya: "Lainnya",
};

export function CutiApproval() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [selectedCuti, setSelectedCuti] = useState<{
    id: string;
    action: "disetujui" | "ditolak";
  } | null>(null);
  const [rejectedReason, setRejectedReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<{
    rows: CutiRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPengajuanCuti({ status: "diajukan", page, pageSize: 20 });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApproveReject = async () => {
    if (!selectedCuti) return;
    setSubmitting(true);

    try {
      const res = await approveCuti({
        id: selectedCuti.id,
        status: selectedCuti.action,
        rejectedReason:
          selectedCuti.action === "ditolak" ? rejectedReason : undefined,
      });

      if (res.ok) {
        toast.success(
          selectedCuti.action === "disetujui"
            ? "Cuti disetujui."
            : "Cuti ditolak.",
        );
        setSelectedCuti(null);
        setRejectedReason("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Gagal memproses cuti.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Approval Cuti</CardTitle>
          <CardDescription>
            Daftar pengajuan cuti yang menunggu approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tgl Diajukan</TableHead>
                  <TableHead>Pemohon</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Hari</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Tidak ada pengajuan cuti yang perlu di-approve.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleDateString("id-ID")
                          : "-"}
                      </TableCell>
                      <TableCell>{row.namaUser ?? "-"}</TableCell>
                      <TableCell>{JENIS_LABEL[row.jenisCuti] ?? row.jenisCuti}</TableCell>
                      <TableCell>
                        {row.tanggalMulai} — {row.tanggalSelesai}
                      </TableCell>
                      <TableCell>{row.jumlahHari} hari</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {row.alasan ?? "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() =>
                              setSelectedCuti({
                                id: row.id,
                                action: "disetujui",
                              })
                            }
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setSelectedCuti({
                                id: row.id,
                                action: "ditolak",
                              })
                            }
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Tolak
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                &larr; Sebelumnya
              </Button>
              <span className="self-center text-sm text-muted-foreground">
                Halaman {page} dari {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya &rarr;
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedCuti}
        onOpenChange={() => setSelectedCuti(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCuti?.action === "disetujui"
                ? "Setujui Cuti"
                : "Tolak Cuti"}
            </DialogTitle>
            <DialogDescription>
              {selectedCuti?.action === "ditolak"
                ? "Berikan alasan penolakan."
                : "Konfirmasi persetujuan cuti."}
            </DialogDescription>
          </DialogHeader>

          {selectedCuti?.action === "ditolak" && (
            <Textarea
              placeholder="Alasan penolakan..."
              value={rejectedReason}
              onChange={(e) => setRejectedReason(e.target.value)}
              rows={3}
            />
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedCuti(null)}
            >
              Batal
            </Button>
            <Button
              variant={selectedCuti?.action === "disetujui" ? "default" : "destructive"}
              onClick={handleApproveReject}
              disabled={submitting}
            >
              {submitting
                ? "Memproses..."
                : selectedCuti?.action === "disetujui"
                  ? "Setujui"
                  : "Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
