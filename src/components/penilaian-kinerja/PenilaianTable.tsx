"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PenilaianListRow, PeriodeRow } from "@/server/actions/penilaianKinerja";

interface PenilaianTableProps {
  data: PenilaianListRow[];
  total: number;
  periodes: PeriodeRow[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Disubmit",
  reviewed: "Direview",
  finalized: "Final",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  submitted: "secondary",
  reviewed: "default",
  finalized: "default",
};

export function PenilaianTable({ data, total, periodes }: PenilaianTableProps) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Total: {total} penilaian
      </div>

      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Karyawan</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Divisi</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead className="text-center">Tugas</TableHead>
              <TableHead className="text-center">Perilaku</TableHead>
              <TableHead className="text-center">Akhir</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Penilai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground py-8"
                >
                  Belum ada data penilaian.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/penilaian-kinerja/${row.id}`)}
                >
                  <TableCell className="font-medium">
                    {row.namaKaryawan}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.jabatan ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.divisiNama ?? "-"}
                  </TableCell>
                  <TableCell>{row.periodeNama}</TableCell>
                  <TableCell className="text-center font-mono">
                    {row.totalNilaiTugas
                      ? parseFloat(row.totalNilaiTugas).toFixed(1)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {row.totalNilaiPerilaku
                      ? parseFloat(row.totalNilaiPerilaku).toFixed(1)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center font-mono font-semibold">
                    {row.nilaiAkhir
                      ? parseFloat(row.nilaiAkhir).toFixed(1)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[row.status] ?? "outline"}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.namaPenilai}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
