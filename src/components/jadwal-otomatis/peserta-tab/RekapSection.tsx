"use client";

import { Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "./StatusBadge";
import type { Peserta } from "./types";

interface RekapSectionProps {
  pesertaList: Peserta[];
  rekapSummary: {
    total: number;
    lulus: number;
    telahMengikuti: number;
    belumFinal: number;
    tm: Peserta[];
  };
  exportPending: boolean;
  onExportRekap: () => void;
}

export function RekapSection({ pesertaList, rekapSummary, exportPending, onExportRekap }: RekapSectionProps) {
  return (
    <Card>
      <CardHeader className="border-b border-border/60 flex-row items-center justify-between">
        <CardTitle>Status &amp; Rekap Kelas</CardTitle>
        <Button variant="outline" size="sm" onClick={onExportRekap} disabled={exportPending}>
          {exportPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          Export Excel
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-border/60 p-4 text-center">
            <p className="text-2xl font-bold">{rekapSummary.total}</p>
            <p className="text-xs text-muted-foreground">Total Peserta</p>
          </div>
          <div className="rounded-xl border p-4 text-center border-green-200 bg-green-50">
            <p className="text-2xl font-bold text-green-700">{rekapSummary.lulus}</p>
            <p className="text-xs text-muted-foreground">Lulus</p>
          </div>
          <div className="rounded-xl border p-4 text-center border-red-200 bg-red-50">
            <p className="text-2xl font-bold text-red-600">{rekapSummary.telahMengikuti}</p>
            <p className="text-xs text-muted-foreground">Telah Mengikuti</p>
          </div>
          <div className="rounded-xl border p-4 text-center border-amber-200 bg-amber-50">
            <p className="text-2xl font-bold text-amber-600">{rekapSummary.belumFinal}</p>
            <p className="text-xs text-muted-foreground">Dalam Proses</p>
          </div>
        </div>

        {rekapSummary.tm.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Detail Telah Mengikuti:</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Peserta</th>
                  <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Alasan</th>
                </tr>
              </thead>
              <tbody>
                {rekapSummary.tm.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="px-3 py-1.5">{p.nama}</td>
                    <td className="px-3 py-1.5">
                      {p.alasanStatus === "kehadiran" ? "Kehadiran < 60%" : p.alasanStatus === "nilai" ? "Nilai D" : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">No</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nama</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">No Peserta</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {pesertaList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4"><EmptyState title="Belum ada peserta" description="Rekap kelas akan tampil setelah peserta ditambahkan." /></td>
                </tr>
              ) : (
                pesertaList.map((p, i) => (
                  <tr key={p.id} className="border-b border-border/60 transition-colors hover:bg-muted/40">
                    <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium">{p.nama}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.nomorPeserta ?? "-"}</td>
                    <td className="px-3 py-1.5"><StatusBadge status={p.statusAkhir} alasan={p.alasanStatus} /></td>
                    <td className="px-3 py-1.5 text-sm text-muted-foreground">
                      {p.alasanStatus === "kehadiran" ? "Kehadiran < 60%" : p.alasanStatus === "nilai" ? "Nilai D" : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
