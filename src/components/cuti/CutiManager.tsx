"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CutiForm } from "./CutiForm";
import { CutiApproval } from "./CutiApproval";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listPengajuanCuti, type CutiRow } from "@/server/actions/cuti";
import { kirimCutiKeDingTalk } from "@/server/actions/dingtalk/submit-leave";

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

export function CutiManager({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState<string | null>(null);
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
      const res = await listPengajuanCuti({ page, pageSize: 20 });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleKirim = async (id: string) => {
    setSubmitting(id);
    try {
      const res = await kirimCutiKeDingTalk(id);
      if (res.ok) {
        toast.success("Cuti berhasil dikirim ke DingTalk.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Gagal mengirim cuti.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">
            <ListChecks className="mr-2 h-4 w-4" />
            Daftar Cuti
          </TabsTrigger>
          <TabsTrigger value="ajukan">
            <Plus className="mr-2 h-4 w-4" />
            Ajukan Cuti
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tgl Diajukan</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Hari</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Belum ada pengajuan cuti.
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
                        <TableCell>{JENIS_LABEL[row.jenisCuti] ?? row.jenisCuti}</TableCell>
                        <TableCell>
                          {row.tanggalMulai} — {row.tanggalSelesai}
                        </TableCell>
                        <TableCell>{row.jumlahHari} hari</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {row.alasan ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_BADGE[row.status] ?? ""}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.status === "draft" && (
                            <Button
                              size="sm"
                              onClick={() => handleKirim(row.id)}
                              disabled={submitting === row.id}
                            >
                              {submitting === row.id ? "Mengirim..." : "Kirim"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {data && data.totalPages > 1 && (
                <div className="flex justify-center gap-2">
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="ajukan">
          <CutiForm currentUserId={currentUserId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
