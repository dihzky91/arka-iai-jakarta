"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  previewKelasUjianFromPelatihan,
  createKelasUjianFromPelatihan,
  type PreviewData,
  type KelasUjianLinked,
} from "@/server/actions/jadwal-otomatis/integrasi";
import { APP_TIME_ZONE, parseIsoDateInJakarta } from "@/lib/utils";

interface JadwalUjianIntegrasiProps {
  kelasId: string;
  canManage: boolean;
  linkedKelasUjian: KelasUjianLinked | null;
  hasExamSessions: boolean;
}

function formatDate(dateStr: string) {
  const date = parseIsoDateInJakarta(dateStr);
  return date.toLocaleDateString("id-ID", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE,
  });
}

export function JadwalUjianIntegrasi({
  kelasId,
  canManage,
  linkedKelasUjian,
  hasExamSessions,
}: JadwalUjianIntegrasiProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creating, setCreating] = useState(false);

  function handleBuatJadwal() {
    setLoadingPreview(true);
    setDialogOpen(true);

    previewKelasUjianFromPelatihan(kelasId)
      .then((data) => {
        setPreview(data);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Gagal memuat data preview.");
        setDialogOpen(false);
      })
      .finally(() => {
        setLoadingPreview(false);
      });
  }

  function handleConfirm() {
    if (!preview) return;

    setCreating(true);

    startTransition(async () => {
      const result = await createKelasUjianFromPelatihan(kelasId);
      setCreating(false);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Kelas ujian berhasil dibuat dengan ${result.data.jadwalUjianCount} jadwal ujian.`,
      );
      setDialogOpen(false);
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <>
      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle>Jadwal Ujian</CardTitle>
            {linkedKelasUjian && (
              <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                Terhubung
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {linkedKelasUjian ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Kelas</p>
                  <p className="font-medium">{linkedKelasUjian.namaKelas}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jadwal Ujian</p>
                  <p className="font-medium">{linkedKelasUjian.jumlahUjian} terdaftar</p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <a href={`/jadwal-ujian/kelas/${linkedKelasUjian.id}`}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Lihat Jadwal Ujian
                </a>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {hasExamSessions
                  ? "Kelas ini belum memiliki jadwal ujian."
                  : "Kelas ini belum memiliki sesi ujian. Generate jadwal terlebih dahulu."}
              </p>
              {canManage && hasExamSessions && (
                <Button onClick={handleBuatJadwal} disabled={isPending}>
                  <CalendarPlus className="h-4 w-4 mr-1" />
                  Buat Jadwal Ujian
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !creating) { setDialogOpen(false); setPreview(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Jadwal Ujian</DialogTitle>
            <DialogDescription>
              Data yang akan dibuat berdasarkan jadwal otomatis kelas ini.
            </DialogDescription>
          </DialogHeader>

          {loadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Memuat data...</span>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Nama Kelas</p>
                  <p className="font-medium">{preview.namaKelas}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Program</p>
                  <p className="font-medium">{preview.program}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipe</p>
                  <p className="font-medium">{preview.tipe}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mode</p>
                  <p className="font-medium">{preview.mode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Lokasi</p>
                  <p className="font-medium">{preview.lokasi ?? "-"}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Jadwal Ujian ({preview.jadwalList.length} sesi):
                </p>
                <ul className="space-y-1.5">
                  {preview.jadwalList.map((jadwal, i) => (
                    <li key={i} className="text-sm">
                      ✦ {formatDate(jadwal.tanggalUjian)} —{" "}
                      {jadwal.mataPelajaran.join(", ")} —{" "}
                      {jadwal.jamMulai}–{jadwal.jamSelesai}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                Pengawas belum ditugaskan. Assign setelah ini.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDialogOpen(false); setPreview(null); }}
              disabled={creating}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!preview || creating}
            >
              {creating ? "Membuat..." : "Buat Jadwal Ujian"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
