"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Peserta, SesiUjian, NilaiRow, AbsensiUjianRow } from "./types";

interface NilaiUjianSectionProps {
  nilaiData: { pesertaList: Peserta[]; ujianList: SesiUjian[]; nilaiList: NilaiRow[] } | null;
  absensiUjianData: { pesertaList: Peserta[]; ujianList: SesiUjian[]; absensiList: AbsensiUjianRow[] } | null;
  canManage: boolean;
  isPending: boolean;
  perbaikanEdit: { pesertaId: string; jadwalUjianId: string; mapel: string; perbaikanDariId: string; nilai: "A" | "B" | "C" } | null;
  susulanEdit: { pesertaId: string; jadwalUjianId: string; tanggal: string } | null;
  onNilaiChange: (pesertaId: string, jadwalUjianId: string, mapel: string, nilai: string) => void;
  onPerbaikanEditChange: (edit: { pesertaId: string; jadwalUjianId: string; mapel: string; perbaikanDariId: string; nilai: "A" | "B" | "C" } | null) => void;
  onPerbaikanSave: () => void;
  onSusulanEditChange: (edit: { pesertaId: string; jadwalUjianId: string; tanggal: string } | null) => void;
  onSusulanSave: () => void;
}

export function NilaiUjianSection({
  nilaiData,
  absensiUjianData,
  canManage,
  isPending,
  perbaikanEdit,
  susulanEdit,
  onNilaiChange,
  onPerbaikanEditChange,
  onPerbaikanSave,
  onSusulanEditChange,
  onSusulanSave,
}: NilaiUjianSectionProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Absensi &amp; Nilai Ujian</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!nilaiData || !absensiUjianData ? (
          <div className="p-4 text-center text-muted-foreground">
            {isPending ? "Memuat..." : "Klik tab untuk memuat data."}
          </div>
        ) : (
          absensiUjianData.ujianList.map((ujian) => {
            const mapel = ujian.mataPelajaran ?? [];
            return (
              <div key={ujian.id} className="border-b last:border-b-0">
                <div className="px-4 py-2 bg-muted/20 font-medium text-sm">
                  Ujian — {ujian.tanggalUjian} ({mapel.join(", ")})
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Peserta</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Hadir</th>
                      {mapel.map((m) => (
                        <th key={m} className="text-center px-3 py-2 font-medium text-muted-foreground">{m}</th>
                      ))}
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absensiUjianData.pesertaList.map((p) => {
                      const absen = absensiUjianData.absensiList.find(
                        (a) => a.pesertaId === p.id && a.jadwalUjianId === ujian.id
                      );
                      return (
                        <tr key={p.id} className="border-b hover:bg-muted/50">
                          <td className="px-3 py-1.5 font-medium">{p.nama}</td>
                          <td className="text-center px-3 py-1.5">
                            <Badge variant={absen?.status === "hadir" ? "default" : "secondary"}>
                              {absen?.status === "hadir" ? "Hadir" : absen?.status === "susulan" ? "Susulan" : absen?.status === "tidak_hadir" ? "Tidak" : "-"}
                            </Badge>
                          </td>
                          {mapel.map((m) => {
                            const n = nilaiData.nilaiList.find(
                              (nv) => nv.pesertaId === p.id && nv.jadwalUjianId === ujian.id && nv.mataPelajaran === m && !nv.isPerbaikan
                            );
                            const perbaikan = nilaiData.nilaiList.find(
                              (nv) => nv.pesertaId === p.id && nv.mataPelajaran === m && nv.isPerbaikan && nv.perbaikanDariId === n?.id
                            );
                            const displayNilai = perbaikan ? perbaikan.nilai : n?.nilai;
                            const isEditingPerbaikan = perbaikanEdit?.pesertaId === p.id && perbaikanEdit?.mapel === m && perbaikanEdit?.jadwalUjianId === ujian.id;
                            return (
                              <td key={m} className="text-center px-3 py-1.5">
                                {canManage && absen?.status === "hadir" ? (
                                  <Select value={displayNilai ?? "-"} onValueChange={(v) => onNilaiChange(p.id, ujian.id, m, v)}>
                                    <SelectTrigger className={`h-7 w-14 text-xs ${displayNilai === "D" ? "border-red-300 text-red-600" : ""}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="-">-</SelectItem>
                                      <SelectItem value="A">A</SelectItem>
                                      <SelectItem value="B">B</SelectItem>
                                      <SelectItem value="C">C</SelectItem>
                                      <SelectItem value="D">D</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className={`text-sm font-medium ${displayNilai === "D" ? "text-destructive" : displayNilai ? "" : "text-muted-foreground"}`}>
                                    {displayNilai ?? "-"}
                                  </span>
                                )}
                                {n?.nilai === "D" && !perbaikan && canManage && (
                                  isEditingPerbaikan ? (
                                    <span className="inline-flex items-center gap-1 ml-1">
                                      <select
                                        className="border rounded text-xs px-1 py-0.5"
                                        value={perbaikanEdit!.nilai}
                                        onChange={(e) => onPerbaikanEditChange({ ...perbaikanEdit!, nilai: e.target.value as "A" | "B" | "C" })}
                                      >
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                      </select>
                                      <button className="text-xs text-green-600 hover:underline" onClick={onPerbaikanSave} disabled={isPending}>&#10003;</button>
                                      <button className="text-xs text-muted-foreground hover:underline" onClick={() => onPerbaikanEditChange(null)}>&#10007;</button>
                                    </span>
                                  ) : (
                                    <button
                                      className="ml-1 text-xs text-blue-600 hover:underline"
                                      onClick={() => onPerbaikanEditChange({ pesertaId: p.id, jadwalUjianId: ujian.id, mapel: m, perbaikanDariId: n!.id, nilai: "A" })}
                                    >[Perbaikan]</button>
                                  )
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center px-3 py-1.5">
                            {absen?.status !== "hadir" && canManage && (
                              susulanEdit?.pesertaId === p.id && susulanEdit?.jadwalUjianId === ujian.id ? (
                                <span className="inline-flex items-center gap-1">
                                  <input type="date" className="border rounded text-xs px-1 py-0.5" value={susulanEdit.tanggal} onChange={(e) => onSusulanEditChange({ ...susulanEdit, tanggal: e.target.value })} />
                                  <button className="text-xs text-green-600 hover:underline" onClick={onSusulanSave} disabled={isPending}>&#10003;</button>
                                  <button className="text-xs text-muted-foreground hover:underline" onClick={() => onSusulanEditChange(null)}>&#10007;</button>
                                </span>
                              ) : (
                                <Button variant="outline" size="sm" className="text-xs" onClick={() => onSusulanEditChange({ pesertaId: p.id, jadwalUjianId: ujian.id, tanggal: "" })}>
                                  Susulan
                                </Button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
