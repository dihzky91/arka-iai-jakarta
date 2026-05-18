"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { updateAttendance } from "@/server/actions/ppl-evaluasi/attendance";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AttendanceFormProps {
  kegiatanId: number;
  pendaftar: number;
  realisasiHadir: number;
  isArchived: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AttendanceForm({
  kegiatanId,
  pendaftar: initialPendaftar,
  realisasiHadir: initialRealisasiHadir,
  isArchived,
}: AttendanceFormProps) {
  const [isPending, startTransition] = useTransition();
  const [pendaftar, setPendaftar] = useState(initialPendaftar);
  const [realisasiHadir, setRealisasiHadir] = useState(initialRealisasiHadir);
  const [serverError, setServerError] = useState<string | null>(null);

  // Compute conversion rate
  const conversionRate =
    pendaftar > 0
      ? Math.round((realisasiHadir / pendaftar) * 1000) / 10
      : null;

  const conversionRateDisplay =
    conversionRate !== null ? `${conversionRate.toFixed(1)}%` : "N/A";

  const showWarningBadge = realisasiHadir > pendaftar;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    startTransition(async () => {
      const result = await updateAttendance(kegiatanId, {
        pendaftar,
        realisasiHadir,
      });

      if (result.ok) {
        toast.success("Data kehadiran berhasil diperbarui");
      } else {
        setServerError(result.error ?? "Gagal memperbarui data kehadiran");
      }
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Data Kehadiran
          </CardTitle>
          <CardDescription>
            Masukkan jumlah pendaftar dan realisasi hadir
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isArchived && (
            <div className="mb-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>
                Kegiatan ini telah diarsipkan. Data kehadiran tidak dapat
                diubah.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pendaftar">Jumlah Pendaftar</Label>
              <Input
                id="pendaftar"
                type="number"
                min={0}
                max={99999}
                value={pendaftar}
                onChange={(e) => setPendaftar(Number(e.target.value) || 0)}
                disabled={isArchived || isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="realisasiHadir">Realisasi Hadir</Label>
              <Input
                id="realisasiHadir"
                type="number"
                min={0}
                max={99999}
                value={realisasiHadir}
                onChange={(e) =>
                  setRealisasiHadir(Number(e.target.value) || 0)
                }
                disabled={isArchived || isPending}
              />
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <p>{serverError}</p>
              </div>
            )}

            <Button type="submit" disabled={isArchived || isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Simpan
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Kehadiran</CardTitle>
          <CardDescription>
            Conversion rate dan statistik kehadiran
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Pendaftar
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">
                {pendaftar.toLocaleString("id-ID")}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Realisasi Hadir
              </dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="text-2xl font-semibold text-foreground">
                  {realisasiHadir.toLocaleString("id-ID")}
                </span>
                {showWarningBadge && (
                  <Badge
                    variant="destructive"
                    className="flex items-center gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Melebihi pendaftar
                  </Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Conversion Rate
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">
                {conversionRateDisplay}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
