"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateSaldoTahunan } from "@/server/actions/saldoCuti";

export function GenerateSaldoForm() {
  const currentYear = new Date().getFullYear();
  const [tahun, setTahun] = useState(currentYear);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleGenerate = async () => {
    setSubmitting(true);
    try {
      const res = await generateSaldoTahunan({ tahun });
      if (res.ok) {
        toast.success(
          `Saldo cuti tahun ${tahun} berhasil di-generate untuk ${res.data.jumlahKaryawan} karyawan.`,
        );
        setConfirmOpen(false);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Gagal generate saldo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Generate Saldo Tahunan</CardTitle>
          <CardDescription>
            Buat saldo cuti awal tahun untuk seluruh karyawan aktif. Proses ini hanya bisa
            dilakukan sekali per tahun.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tahun</Label>
            <Input
              type="number"
              min={2020}
              max={2100}
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
            />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Yang akan dilakukan:</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>Membuat record saldo cuti tahunan untuk semua karyawan aktif</li>
              <li>Membuat record saldo cuti kompensasi untuk semua karyawan aktif</li>
              <li>Kuota diambil dari konfigurasi tahun {tahun}</li>
              <li>Saldo tahun sebelumnya tidak terpengaruh (tetap sebagai histori)</li>
            </ul>
          </div>

          <Button onClick={() => setConfirmOpen(true)}>
            <Zap className="mr-2 h-4 w-4" />
            Generate Saldo Tahun {tahun}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Generate Saldo</DialogTitle>
            <DialogDescription>
              Anda akan membuat saldo cuti tahun {tahun} untuk seluruh karyawan aktif.
              Proses ini tidak bisa dibatalkan. Pastikan konfigurasi kuota sudah benar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleGenerate} disabled={submitting}>
              {submitting ? "Memproses..." : "Ya, Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
