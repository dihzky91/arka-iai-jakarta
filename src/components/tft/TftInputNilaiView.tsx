"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveNilai, type KriteriaTftRow, type PenilaiTftRow, type NilaiTftRow } from "@/server/actions/tft/penilaian";
import type { PendaftarTftRow } from "@/server/actions/tft/pendaftar";

interface TftInputNilaiViewProps {
  periodeId: string;
  pendaftar: PendaftarTftRow[];
  kriteria: KriteriaTftRow[];
  penilai: PenilaiTftRow[];
  existingNilai: NilaiTftRow[];
}

type ScoreMap = Record<string, string>; // key: `${pendaftarId}_${kriteriaId}` → skor

export function TftInputNilaiView({
  periodeId,
  pendaftar,
  kriteria,
  penilai,
  existingNilai,
}: TftInputNilaiViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedPenilaiId, setSelectedPenilaiId] = useState(penilai[0]?.id ?? "");

  // Build initial score map from existing values
  const initialScores = useMemo(() => {
    const map: ScoreMap = {};
    for (const n of existingNilai) {
      if (n.penilaiId === selectedPenilaiId) {
        map[`${n.pendaftarId}_${n.kriteriaId}`] = n.skor;
      }
    }
    return map;
  }, [existingNilai, selectedPenilaiId]);

  const [scores, setScores] = useState<ScoreMap>(initialScores);

  // Re-sync when penilai changes
  const handlePenilaiChange = useCallback(
    (penilaiId: string) => {
      setSelectedPenilaiId(penilaiId);
      const map: ScoreMap = {};
      for (const n of existingNilai) {
        if (n.penilaiId === penilaiId) {
          map[`${n.pendaftarId}_${n.kriteriaId}`] = n.skor;
        }
      }
      setScores(map);
    },
    [existingNilai],
  );

  function updateScore(pendaftarId: string, kriteriaId: string, value: string) {
    setScores((prev) => ({
      ...prev,
      [`${pendaftarId}_${kriteriaId}`]: value,
    }));
  }

  function getScore(pendaftarId: string, kriteriaId: string): string {
    return scores[`${pendaftarId}_${kriteriaId}`] ?? "";
  }

  // Calculate weighted total for a pendaftar
  function calcTotal(pendaftarId: string): string {
    let weightedSum = 0;
    let totalBobot = 0;
    for (const k of kriteria) {
      const raw = scores[`${pendaftarId}_${k.id}`];
      if (raw && !isNaN(Number(raw))) {
        weightedSum += Number(raw) * Number(k.bobot);
        totalBobot += Number(k.bobot);
      }
    }
    if (totalBobot === 0) return "—";
    return (weightedSum / totalBobot).toFixed(1);
  }

  // Count filled
  const filledCount = pendaftar.filter((p) =>
    kriteria.every((k) => {
      const val = scores[`${p.id}_${k.id}`];
      return val && val.trim() !== "";
    }),
  ).length;

  function handleSave() {
    if (!selectedPenilaiId) {
      toast.error("Pilih penilai terlebih dahulu.");
      return;
    }

    const nilaiEntries: { pendaftarId: string; kriteriaId: string; skor: number; catatan?: string }[] = [];

    for (const p of pendaftar) {
      for (const k of kriteria) {
        const raw = scores[`${p.id}_${k.id}`];
        if (raw && raw.trim() !== "") {
          const skor = Number(raw);
          if (isNaN(skor) || skor < Number(k.skorMin) || skor > Number(k.skorMax)) {
            toast.error(`Skor ${p.namaLengkap} - ${k.nama} harus antara ${k.skorMin} dan ${k.skorMax}.`);
            return;
          }
          nilaiEntries.push({ pendaftarId: p.id, kriteriaId: k.id, skor });
        }
      }
    }

    if (nilaiEntries.length === 0) {
      toast.error("Belum ada nilai yang diisi.");
      return;
    }

    startTransition(async () => {
      const res = await saveNilai({
        periodeId,
        penilaiId: selectedPenilaiId,
        nilai: nilaiEntries,
      });
      if (!res.ok) {
        toast.error("Gagal menyimpan nilai.");
        return;
      }
      toast.success(`${nilaiEntries.length} nilai berhasil disimpan.`);
      router.refresh();
    });
  }

  // Filter only pendaftar yang bersedia hadir
  const activePendaftar = pendaftar.filter((p) => p.bersediaHadir && p.status !== "ditolak");

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="rounded-[24px]">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Penilai:</span>
              <Select value={selectedPenilaiId} onValueChange={handlePenilaiChange}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Pilih penilai..." />
                </SelectTrigger>
                <SelectContent>
                  {penilai.map((pn) => (
                    <SelectItem key={pn.id} value={pn.id}>
                      {pn.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              {filledCount}/{activePendaftar.length} peserta sudah dinilai
            </span>
            <div className="ml-auto">
              <Button onClick={handleSave} disabled={isPending || !selectedPenilaiId}>
                <Save className="h-4 w-4" />
                {isPending ? "Menyimpan..." : "Simpan Nilai"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {!selectedPenilaiId ? (
        <Card className="rounded-[24px]">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Pilih penilai terlebih dahulu untuk mulai input nilai.
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-[24px]">
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 pr-4 text-left font-medium text-muted-foreground sticky left-0 bg-card min-w-[180px]">
                    Peserta
                  </th>
                  {kriteria.map((k) => (
                    <th key={k.id} className="pb-3 px-2 text-center font-medium text-muted-foreground min-w-[100px]">
                      <div>{k.nama}</div>
                      <div className="text-[10px] font-normal">({k.bobot}%)</div>
                    </th>
                  ))}
                  <th className="pb-3 pl-2 text-center font-medium text-muted-foreground min-w-[80px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {activePendaftar.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium sticky left-0 bg-card">
                      {p.namaLengkap}
                    </td>
                    {kriteria.map((k) => (
                      <td key={k.id} className="py-2 px-1">
                        <Input
                          type="number"
                          min={Number(k.skorMin)}
                          max={Number(k.skorMax)}
                          step="0.5"
                          className="h-8 w-full text-center text-sm"
                          placeholder="—"
                          value={getScore(p.id, k.id)}
                          onChange={(e) => updateScore(p.id, k.id, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="py-2 pl-2 text-center font-medium">
                      {calcTotal(p.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
