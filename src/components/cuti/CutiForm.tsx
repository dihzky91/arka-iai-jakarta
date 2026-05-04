"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { ajukanCuti, kirimCutiKeDingTalk } from "@/server/actions/dingtalk/submit-leave";

const JENIS_CUTI = [
  { value: "tahunan", label: "Cuti Tahunan" },
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
  const [form, setForm] = useState({
    jenisCuti: "",
    tanggalMulai: "",
    tanggalSelesai: "",
    alasan: "",
  });

  const hitungHari = () => {
    if (!form.tanggalMulai || !form.tanggalSelesai) return 0;
    const start = new Date(form.tanggalMulai);
    const end = new Date(form.tanggalSelesai);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await ajukanCuti({
        jenisCuti: form.jenisCuti,
        tanggalMulai: form.tanggalMulai,
        tanggalSelesai: form.tanggalSelesai,
        jumlahHari: hitungHari(),
        alasan: form.alasan || undefined,
      });

      if (res.ok) {
        toast.success("Cuti berhasil diajukan.");

        // Optional: auto-kirim ke DingTalk
        const kirim = await kirimCutiKeDingTalk(res.data.id);
        if (kirim.ok) {
          toast.success("Cuti terkirim ke DingTalk.");
        } else {
          toast.warning("Cuti tersimpan, tapi gagal kirim ke DingTalk: " + kirim.error);
        }

        setForm({ jenisCuti: "", tanggalMulai: "", tanggalSelesai: "", alasan: "" });
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
          Isi data cuti yang akan diajukan. Data akan dikirim ke DingTalk untuk approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              Total: <strong>{hitungHari()} hari</strong>
            </p>
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

          <Button type="submit" disabled={submitting}>
            {submitting ? "Mengirim..." : "Ajukan Cuti"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
