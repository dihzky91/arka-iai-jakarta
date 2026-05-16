"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ListChecks, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { getSaldoCuti, type SaldoCutiResponse } from "@/server/actions/saldoCuti";
import { APP_TIME_ZONE } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  diajukan: "bg-blue-100 text-blue-800",
  disetujui: "bg-green-100 text-green-800",
  ditolak: "bg-red-100 text-red-800",
  dibatalkan: "bg-yellow-100 text-yellow-800",
};

const JENIS_LABEL: Record<string, string> = {
  tahunan: "Cuti Tahunan",
  kompensasi: "Cuti Kompensasi",
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
  const [saldo, setSaldo] = useState<SaldoCutiResponse | null>(null);
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

  // Fetch saldo
  useEffect(() => {
    const tahun = new Date().getFullYear();
    getSaldoCuti(currentUserId, tahun).then(setSaldo).catch(() => {});
  }, [currentUserId]);

  return (
    <div className="space-y-4">
      {/* Saldo Widget */}
      {saldo && (saldo.tahunan || saldo.kompensasi) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {saldo.tahunan && (
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Cuti Tahunan</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-semibold">{saldo.tahunan.sisaCuti}</span>
                <span className="text-sm text-muted-foreground">/ {saldo.tahunan.kuotaAwal} hari</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (saldo.tahunan.sisaCuti / saldo.tahunan.kuotaAwal) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Terpakai: {saldo.tahunan.cutiTerpakai} · Cuti bersama: {saldo.tahunan.cutiBersamaTerpakai}
              </p>
            </div>
          )}
          {saldo.kompensasi && (
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Cuti Kompensasi</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-semibold">{saldo.kompensasi.sisa}</span>
                <span className="text-sm text-muted-foreground">/ {saldo.kompensasi.kuota} hari</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (saldo.kompensasi.sisa / saldo.kompensasi.kuota) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Terpakai: {saldo.kompensasi.terpakai}
              </p>
            </div>
          )}
          {saldo.tahunan && (
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Cuti Bersama</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-semibold">{saldo.tahunan.cutiBersamaTerpakai}</span>
                <span className="text-sm text-muted-foreground">hari</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Memotong saldo cuti tahunan
              </p>
            </div>
          )}
        </div>
      )}

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
              <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
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
                      <TableCell colSpan={7} className="p-6">
                        <EmptyState
                          icon={ListChecks}
                          title="Belum ada pengajuan cuti"
                          description="Pengajuan cuti Anda akan tampil di sini setelah dibuat."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.rows.map((row) => (
                      <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                        <TableCell>
                          {row.createdAt
                            ? new Date(row.createdAt).toLocaleDateString("id-ID", {
                                timeZone: APP_TIME_ZONE,
                              })
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
                          {row.status === "disetujui" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`/api/cuti/${row.id}/pdf`, "_blank")}
                            >
                              <FileDown className="mr-1 h-4 w-4" />
                              PDF
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>

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
