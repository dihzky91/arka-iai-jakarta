"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type {
  PeriodeRow,
  RekapPerDivisi,
  RekapPerKaryawan,
  RekapStatistik,
} from "@/server/actions/penilaianKinerja";
import {
  getRekapPerDivisi,
  getRekapPerKaryawan,
  getRekapStatistik,
} from "@/server/actions/penilaianKinerja";
import { RekapChart } from "./RekapChart";

interface RekapDashboardProps {
  periodes: PeriodeRow[];
}

export function RekapDashboard({ periodes }: RekapDashboardProps) {
  const [selectedPeriode, setSelectedPeriode] = useState<string>(
    periodes[0]?.id ? String(periodes[0].id) : "",
  );
  const [statistik, setStatistik] = useState<RekapStatistik | null>(null);
  const [rekapDivisi, setRekapDivisi] = useState<RekapPerDivisi[]>([]);
  const [rekapKaryawan, setRekapKaryawan] = useState<RekapPerKaryawan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedPeriode) return;
    loadData(parseInt(selectedPeriode));
  }, [selectedPeriode]);

  async function loadData(periodeId: number) {
    setLoading(true);
    try {
      const [stat, divisiData, karyawanData] = await Promise.all([
        getRekapStatistik(periodeId),
        getRekapPerDivisi(periodeId),
        getRekapPerKaryawan(periodeId),
      ]);
      setStatistik(stat);
      setRekapDivisi(divisiData);
      setRekapKaryawan(karyawanData);
    } catch {
      toast.error("Gagal memuat data rekap");
    } finally {
      setLoading(false);
    }
  }

  function handleExportExcel() {
    if (rekapKaryawan.length === 0) {
      toast.error("Tidak ada data untuk di-export");
      return;
    }

    // Build CSV
    const headers = ["No", "Nama", "Jabatan", "Divisi", "Nilai Tugas", "Nilai Perilaku", "Nilai Akhir"];
    const rows = rekapKaryawan.map((r, i) => [
      i + 1,
      r.namaKaryawan,
      r.jabatan ?? "-",
      r.divisiNama ?? "-",
      r.totalNilaiTugas.toFixed(1),
      r.totalNilaiPerilaku.toFixed(1),
      r.nilaiAkhir.toFixed(1),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const periodeNama = periodes.find((p) => String(p.id) === selectedPeriode)?.nama ?? "rekap";
    link.download = `rekap-penilaian-${periodeNama.replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("File CSV berhasil diunduh");
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Periode:</span>
          <Select value={selectedPeriode} onValueChange={setSelectedPeriode}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
              {periodes.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {loading && (
        <div className="text-center text-muted-foreground py-8">
          Memuat data...
        </div>
      )}

      {!loading && statistik && (
        <>
          {/* Statistik Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Karyawan Dinilai</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {statistik.totalKaryawanDinilai}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Penilaian Final</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {statistik.totalPenilaianFinalized}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Rata-rata Nilai</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">
                  {statistik.rataRataNilaiAkhir.toFixed(1)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tertinggi</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono text-green-600">
                  {statistik.nilaiTertinggi.toFixed(1)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Terendah</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono text-red-600">
                  {statistik.nilaiTerendah.toFixed(1)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart per Divisi */}
          {rekapDivisi.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rata-rata per Divisi</CardTitle>
              </CardHeader>
              <CardContent>
                <RekapChart data={rekapDivisi} />
              </CardContent>
            </Card>
          )}

          {/* Ranking Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ranking Karyawan</CardTitle>
              <CardDescription>
                Diurutkan berdasarkan nilai akhir tertinggi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Jabatan</TableHead>
                      <TableHead>Divisi</TableHead>
                      <TableHead className="text-center">Tugas</TableHead>
                      <TableHead className="text-center">Perilaku</TableHead>
                      <TableHead className="text-center">Nilai Akhir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rekapKaryawan.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground py-8"
                        >
                          Belum ada penilaian yang difinalisasi untuk periode ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rekapKaryawan.map((row, index) => (
                        <TableRow key={row.userId}>
                          <TableCell className="font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.namaKaryawan}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.jabatan ?? "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.divisiNama ?? "-"}
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {row.totalNilaiTugas.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {row.totalNilaiPerilaku.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold">
                            <Badge
                              variant={
                                row.nilaiAkhir >= 80
                                  ? "default"
                                  : row.nilaiAkhir >= 60
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {row.nilaiAkhir.toFixed(1)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
