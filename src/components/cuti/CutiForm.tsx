"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ajukanCuti } from "@/server/actions/dingtalk/submit-leave";
import { getSaldoCuti, type SaldoCutiResponse } from "@/server/actions/saldoCuti";
import { parseIsoDateInJakarta } from "@/lib/utils";

const JENIS_CUTI = [
  { value: "tahunan", label: "Cuti Tahunan" },
  { value: "kompensasi", label: "Cuti Kompensasi" },
  { value: "sakit", label: "Cuti Sakit" },
  { value: "melahirkan", label: "Cuti Melahirkan" },
  { value: "menikah", label: "Cuti Menikah" },
  { value: "kematian", label: "Cuti Kematian" },
  { value: "lainnya", label: "Lainnya" },
];

export function CutiForm({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [saldo, setSaldo] = useState<SaldoCutiResponse | null>(null);
  const [form, setForm] = useState({
    jenisCuti: "",
    tanggalMulai: "",
    tanggalSelesai: "",
    alasan: "",
  });

  // Fetch saldo cuti saat komponen dimount
  useEffect(() => {
    const tahun = new Date().getFullYear();
    getSaldoCuti(currentUserId, tahun)
      .then(setSaldo)
      .catch(() => {});
  }, [currentUserId]);

  const hitungHari = () => {
    if (!form.tanggalMulai || !form.tanggalSelesai) return 0;
    const start = parseIsoDateInJakarta(form.tanggalMulai);
    const end = parseIsoDateInJakarta(form.tanggalSelesai);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  };

  const jumlahHari = hitungHari();

  // Cek apakah saldo mencukupi
  const saldoWarning = (() => {
    if (!form.jenisCuti || jumlahHari === 0) return null;
    if (form.jenisCuti === "tahunan" && saldo?.tahunan) {
      if (jumlahHari > saldo.tahunan.sisaCuti) {
        return `Sisa cuti tahunan: ${saldo.tahunan.sisaCuti} hari. Pengajuan ${jumlahHari} hari melebihi saldo.`;
      }
    }
    if (form.jenisCuti === "kompensasi" && saldo?.kompensasi) {
      if (jumlahHari > saldo.kompensasi.sisa) {
        return `Sisa cuti kompensasi: ${saldo.kompensasi.sisa} hari. Pengajuan ${jumlahHari} hari melebihi saldo.`;
      }
    }
    return null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await ajukanCuti({
        jenisCuti: form.jenisCuti,
        tanggalMulai: form.tanggalMulai,
        tanggalSelesai: form.tanggalSelesai,
        jumlahHari,
        alasan: form.alasan || undefined,
      });

      if (res.ok) {
        toast.success("Cuti berhasil diajukan. Menunggu approval.");
        setForm({ jenisCuti: "", tanggalMulai: "", tanggalSelesai: "", alasan: "" });
        // Refresh saldo
        const tahun = new Date().getFullYear();
        getSaldoCuti(currentUserId, tahun).then(setSaldo).catch(() => {});
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Gagal mengajukan cuti.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Form Pengajuan Cuti</CardTitle>
        <CardDescription>
          Isi data cuti yang akan diajukan. Pengajuan akan dikirim ke admin untuk approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Saldo Info */}
        {saldo && (saldo.tahunan || saldo.kompensasi) && (
          <div className="mb-6 grid grid-cols-2 gap-3">
            {saldo.tahunan && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Sisa Cuti Tahunan</p>
                <p className="text-lg font-semibold">
                  {saldo.tahunan.sisaCuti} <span className="text-sm font-normal text-muted-foreground">/ {saldo.tahunan.kuotaAwal} hari</span>
                </p>
                {saldo.tahunan.cutiBersamaTerpakai > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Cuti bersama: {saldo.tahunan.cutiBersamaTerpakai} hari
                  </p>
                )}
              </div>
            )}
            {saldo.kompensasi && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Sisa Cuti Kompensasi</p>
                <p className="text-lg font-semibold">
                  {saldo.kompensasi.sisa} <span className="text-sm font-normal text-muted-foreground">/ {saldo.kompensasi.kuota} hari</span>
                </p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jenisCuti">Jenis Cuti</Label>
            <Select
              value={form.jenisCuti}
              onValueChange={(v) => setForm((f) => ({ ...f, jenisCuti: v }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenis cuti" />
              </SelectTrigger>
              <SelectContent>
                {JENIS_CUTI.map((j) => (
                  <SelectItem key={j.value} value={j.value}>
                    {j.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tanggalMulai">Tanggal Mulai</Label>
              <Input
                id="tanggalMulai"
                type="date"
                value={form.tanggalMulai}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tanggalMulai: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tanggalSelesai">Tanggal Selesai</Label>
              <Input
                id="tanggalSelesai"
                type="date"
                value={form.tanggalSelesai}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tanggalSelesai: e.target.value }))
                }
                required
              />
            </div>
          </div>

          {form.tanggalMulai && form.tanggalSelesai && (
            <p className="text-sm text-muted-foreground">
              Total: <strong>{jumlahHari} hari</strong>
            </p>
          )}

          {/* Saldo Warning */}
          {saldoWarning && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{saldoWarning}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="alasan">Alasan</Label>
            <Textarea
              id="alasan"
              placeholder="Jelaskan alasan cuti..."
              value={form.alasan}
              onChange={(e) =>
                setForm((f) => ({ ...f, alasan: e.target.value }))
              }
              rows={3}
              maxLength={1000}
            />
          </div>

          <Button type="submit" disabled={submitting || !!saldoWarning}>
            {submitting ? "Mengirim..." : "Ajukan Cuti"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
