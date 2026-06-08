"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, UserPlus, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  updateStatusPeriodeTft,
  type PeriodeTftRow,
} from "@/server/actions/tft/periode";
import {
  reviewPendaftar,
  convertToInstructor,
  type PendaftarTftRow,
} from "@/server/actions/tft/pendaftar";
import type { KriteriaTftRow, PenilaiTftRow, NilaiTftRow } from "@/server/actions/tft/penilaian";

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    baru: { label: "Baru", className: "bg-gray-100 text-gray-700 border-gray-200" },
    review: { label: "Review", className: "bg-amber-100 text-amber-700 border-amber-200" },
    diterima: { label: "Diterima", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    ditolak: { label: "Ditolak", className: "bg-red-100 text-red-700 border-red-200" },
  };
  const cfg = map[status] ?? { label: status, className: "" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

interface TftDetailViewProps {
  periode: PeriodeTftRow;
  pendaftar: PendaftarTftRow[];
  kriteria: KriteriaTftRow[];
  penilai: PenilaiTftRow[];
  nilai: NilaiTftRow[];
}

export function TftDetailView({ periode, pendaftar, kriteria, penilai, nilai }: TftDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reviewTarget, setReviewTarget] = useState<PendaftarTftRow | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"diterima" | "ditolak">("diterima");
  const [reviewCatatan, setReviewCatatan] = useState("");

  function handleStatusChange(newStatus: "buka" | "tutup" | "penilaian" | "selesai") {
    startTransition(async () => {
      const res = await updateStatusPeriodeTft(periode.id, newStatus);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Status diubah ke "${newStatus}".`);
      router.refresh();
    });
  }

  function handleReview() {
    if (!reviewTarget) return;
    startTransition(async () => {
      const res = await reviewPendaftar({
        id: reviewTarget.id,
        status: reviewStatus,
        catatanAdmin: reviewCatatan,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${reviewTarget.namaLengkap} ditandai ${reviewStatus}.`);
      setReviewTarget(null);
      setReviewCatatan("");
      router.refresh();
    });
  }

  function handleConvert(p: PendaftarTftRow) {
    startTransition(async () => {
      const res = await convertToInstructor(p.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${p.namaLengkap} berhasil ditambahkan sebagai instruktur.`);
      router.refresh();
    });
  }

  function copyLink() {
    const url = `${window.location.origin}/daftar/tft/${periode.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link pendaftaran disalin.");
  }

  const statusCounts = {
    baru: pendaftar.filter((p) => p.status === "baru").length,
    review: pendaftar.filter((p) => p.status === "review").length,
    diterima: pendaftar.filter((p) => p.status === "diterima").length,
    ditolak: pendaftar.filter((p) => p.status === "ditolak").length,
  };

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <Card className="rounded-[24px]">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4" />
              Salin Link Form
            </Button>
            {periode.status === "draft" && (
              <Button size="sm" onClick={() => handleStatusChange("buka")} disabled={isPending}>
                Buka Pendaftaran
              </Button>
            )}
            {periode.status === "buka" && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("tutup")} disabled={isPending}>
                Tutup Pendaftaran
              </Button>
            )}
            {periode.status === "tutup" && (
              <Button size="sm" onClick={() => handleStatusChange("penilaian")} disabled={isPending}>
                Mulai Penilaian
              </Button>
            )}
            {periode.status === "penilaian" && (
              <Button size="sm" onClick={() => handleStatusChange("selesai")} disabled={isPending}>
                Selesaikan Periode
              </Button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Baru: <strong>{statusCounts.baru}</strong></span>
            <span>Review: <strong>{statusCounts.review}</strong></span>
            <span>Diterima: <strong className="text-emerald-600">{statusCounts.diterima}</strong></span>
            <span>Ditolak: <strong className="text-red-600">{statusCounts.ditolak}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="pendaftar">
        <TabsList>
          <TabsTrigger value="pendaftar">Pendaftar ({pendaftar.length})</TabsTrigger>
          <TabsTrigger value="penilaian">Penilaian</TabsTrigger>
          <TabsTrigger value="hasil">Hasil</TabsTrigger>
        </TabsList>

        {/* Tab: Pendaftar */}
        <TabsContent value="pendaftar" className="mt-4">
          <Card className="rounded-[24px]">
            <CardContent className="pt-6">
              {pendaftar.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada pendaftar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>No HP</TableHead>
                        <TableHead>Materi</TableHead>
                        <TableHead>Hadir</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Skor</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendaftar.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.namaLengkap}</TableCell>
                          <TableCell className="text-sm">{p.email}</TableCell>
                          <TableCell className="text-sm">{p.noHp}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {p.materiBrevetAb.slice(0, 2).map((m) => (
                                <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                              ))}
                              {p.materiBrevetAb.length > 2 && (
                                <Badge variant="secondary" className="text-[10px]">+{p.materiBrevetAb.length - 2}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{p.bersediaHadir ? "Ya" : "Tidak"}</TableCell>
                          <TableCell>{statusBadge(p.status)}</TableCell>
                          <TableCell className="text-sm">{p.skorAkhir ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {p.status !== "diterima" && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-emerald-600"
                                  onClick={() => { setReviewTarget(p); setReviewStatus("diterima"); }}
                                  title="Terima"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              {p.status !== "ditolak" && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-red-600"
                                  onClick={() => { setReviewTarget(p); setReviewStatus("ditolak"); }}
                                  title="Tolak"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                              {p.status === "diterima" && !p.instructorId && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleConvert(p)}
                                  disabled={isPending}
                                  title="Tambah ke Instruktur"
                                >
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Penilaian */}
        <TabsContent value="penilaian" className="mt-4">
          <Card className="rounded-[24px]">
            <CardHeader>
              <CardTitle>Kriteria & Penilai</CardTitle>
              <CardDescription>
                Kelola kriteria penilaian dan data penilai. Input nilai di halaman terpisah.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Kriteria Section */}
              <div>
                <h3 className="text-sm font-medium mb-3">Kriteria Penilaian ({kriteria.length})</h3>
                {kriteria.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada kriteria. Tambahkan kriteria untuk memulai penilaian.</p>
                ) : (
                  <div className="space-y-2">
                    {kriteria.map((k) => (
                      <div key={k.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{k.nama}</p>
                          {k.deskripsi && <p className="text-xs text-muted-foreground">{k.deskripsi}</p>}
                        </div>
                        <Badge variant="outline">{k.bobot}%</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Penilai Section */}
              <div>
                <h3 className="text-sm font-medium mb-3">Penilai ({penilai.length})</h3>
                {penilai.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada penilai.</p>
                ) : (
                  <div className="space-y-2">
                    {penilai.map((pn) => (
                      <div key={pn.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{pn.nama}</p>
                          <p className="text-xs text-muted-foreground">
                            {[pn.jabatan, pn.instansi].filter(Boolean).join(" — ") || "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {kriteria.length > 0 && penilai.length > 0 && pendaftar.length > 0 && (
                <Button
                  onClick={() => router.push(`/jadwal-otomatis/tft/${periode.id}/input-nilai`)}
                >
                  Input Nilai
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Hasil */}
        <TabsContent value="hasil" className="mt-4">
          <Card className="rounded-[24px]">
            <CardHeader>
              <CardTitle>Rekap Hasil Penilaian</CardTitle>
              <CardDescription>
                Ranking peserta berdasarkan skor akhir.
                {periode.skorMinimum && ` Threshold kelulusan: ${periode.skorMinimum}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendaftar.filter((p) => p.skorAkhir).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada hasil penilaian. Input nilai terlebih dahulu.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Skor Akhir</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendaftar
                        .filter((p) => p.skorAkhir)
                        .sort((a, b) => Number(b.skorAkhir) - Number(a.skorAkhir))
                        .map((p, idx) => {
                          const lulus = periode.skorMinimum
                            ? Number(p.skorAkhir) >= Number(periode.skorMinimum)
                            : null;
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{idx + 1}</TableCell>
                              <TableCell>{p.namaLengkap}</TableCell>
                              <TableCell>
                                <span className={lulus === false ? "text-red-600" : lulus === true ? "text-emerald-600 font-medium" : ""}>
                                  {p.skorAkhir}
                                </span>
                              </TableCell>
                              <TableCell>{statusBadge(p.status)}</TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => { if (!open) setReviewTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewStatus === "diterima" ? "Terima" : "Tolak"} Pendaftar
            </DialogTitle>
            <DialogDescription>
              {reviewTarget?.namaLengkap} akan ditandai sebagai{" "}
              <strong>{reviewStatus}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">Catatan (opsional)</p>
            <Textarea
              placeholder="Catatan untuk keputusan ini..."
              value={reviewCatatan}
              onChange={(e) => setReviewCatatan(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)} disabled={isPending}>
              Batal
            </Button>
            <Button
              variant={reviewStatus === "ditolak" ? "destructive" : "default"}
              onClick={handleReview}
              disabled={isPending}
            >
              {isPending ? "Memproses..." : reviewStatus === "diterima" ? "Terima" : "Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
