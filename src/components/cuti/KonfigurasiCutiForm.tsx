"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
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
import { getKonfigurasiCuti, upsertKonfigurasiCuti } from "@/server/actions/saldoCuti";

export function KonfigurasiCutiForm() {
  const currentYear = new Date().getFullYear();
  const [tahun, setTahun] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    kuotaCutiTahunan: 12,
    kuotaCutiKompensasi: 2,
    maksimalPotongCutiBersama: 2,
  });

  useEffect(() => {
    setLoading(true);
    getKonfigurasiCuti(tahun)
      .then((config) => {
        setForm({
          kuotaCutiTahunan: config.kuotaCutiTahunan,
          kuotaCutiKompensasi: config.kuotaCutiKompensasi,
          maksimalPotongCutiBersama: config.maksimalPotongCutiBersama,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tahun]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await upsertKonfigurasiCuti({
        tahun,
        ...form,
      });
      if (res.ok) {
        toast.success(`Konfigurasi cuti tahun ${tahun} berhasil disimpan.`);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Gagal menyimpan konfigurasi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Konfigurasi Cuti</CardTitle>
        <CardDescription>
          Atur kuota default dan batas pemotongan cuti bersama per tahun.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat konfigurasi...</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Kuota Cuti Tahunan (hari)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={form.kuotaCutiTahunan}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, kuotaCutiTahunan: Number(e.target.value) }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Jumlah hari cuti tahunan yang diberikan ke setiap karyawan.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Kuota Cuti Kompensasi (hari)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={form.kuotaCutiKompensasi}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, kuotaCutiKompensasi: Number(e.target.value) }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Jumlah hari cuti kompensasi tambahan per karyawan.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Maksimal Potong Cuti Bersama (hari)</Label>
                <Input
                  type="number"
                  min={0}
                  max={12}
                  value={form.maksimalPotongCutiBersama}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maksimalPotongCutiBersama: Number(e.target.value) }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Batas maksimal hari cuti bersama yang memotong saldo cuti tahunan.
                  Cuti bersama yang melebihi batas ini tetap berlaku sebagai libur, namun tidak mengurangi saldo.
                </p>
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? "Menyimpan..." : "Simpan Konfigurasi"}
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
