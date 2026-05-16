"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { getAllSaldoCuti, type SaldoCutiRow } from "@/server/actions/saldoCuti";

export function KelolaSaldoTable() {
  const currentYear = new Date().getFullYear();
  const [tahun, setTahun] = useState(currentYear);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    rows: SaldoCutiRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllSaldoCuti(tahun, { page, pageSize: 30 });
      setData(res);
    } catch {
      toast.error("Gagal memuat data saldo.");
    } finally {
      setLoading(false);
    }
  }, [tahun, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/60">
        <div>
          <CardTitle>Saldo Cuti Karyawan</CardTitle>
          <CardDescription>
            Lihat saldo cuti seluruh karyawan untuk tahun yang dipilih.
          </CardDescription>
        </div>
        <Input
          type="number"
          min={2020}
          max={2100}
          value={tahun}
          onChange={(e) => {
            setTahun(Number(e.target.value));
            setPage(1);
          }}
          className="w-24"
        />
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !data || data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada data saldo untuk tahun {tahun}. Silakan generate saldo terlebih dahulu.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead className="text-center">Kuota</TableHead>
                    <TableHead className="text-center">Terpakai</TableHead>
                    <TableHead className="text-center">Cuti Bersama</TableHead>
                    <TableHead className="text-center">Sisa Tahunan</TableHead>
                    <TableHead className="text-center">Kompensasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.userId} className="transition-colors hover:bg-muted/40">
                      <TableCell className="font-medium">{row.namaLengkap ?? "-"}</TableCell>
                      <TableCell className="text-center">{row.kuotaAwal}</TableCell>
                      <TableCell className="text-center">{row.cutiTerpakai}</TableCell>
                      <TableCell className="text-center">{row.cutiBersamaTerpakai}</TableCell>
                      <TableCell className="text-center">
                        <span className={row.sisaCuti <= 2 ? "font-semibold text-destructive" : "font-medium"}>
                          {row.sisaCuti}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {row.kompensasiSisa !== null
                          ? `${row.kompensasiSisa}/${row.kompensasiKuota}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data.totalPages > 1 && (
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
      </CardContent>
    </Card>
  );
}
