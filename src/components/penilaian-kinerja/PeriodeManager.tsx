"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PeriodeRow } from "@/server/actions/penilaianKinerja";
import { createPeriode, closePeriode, updatePeriode } from "@/server/actions/penilaianKinerja";

const formSchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi"),
  tahun: z.number().int().min(2020).max(2100),
  kuartal: z.number().int().min(1).max(4),
  tanggalMulai: z.string().min(1, "Tanggal mulai wajib diisi"),
  tanggalSelesai: z.string().min(1, "Tanggal selesai wajib diisi"),
});

type FormValues = z.infer<typeof formSchema>;

interface PeriodeManagerProps {
  initialData: PeriodeRow[];
}

export function PeriodeManager({ initialData }: PeriodeManagerProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nama: "",
      tahun: new Date().getFullYear(),
      kuartal: Math.ceil((new Date().getMonth() + 1) / 3),
      tanggalMulai: "",
      tanggalSelesai: "",
    },
  });

  // Auto-fill nama and dates when kuartal/tahun changes
  function handleKuartalChange(kuartal: number, tahun: number) {
    const startMonth = (kuartal - 1) * 3;
    const endMonth = startMonth + 2;
    const startDate = new Date(tahun, startMonth, 1);
    const endDate = new Date(tahun, endMonth + 1, 0); // last day of end month

    const kuartalNames = ["Januari - Maret", "April - Juni", "Juli - September", "Oktober - Desember"];
    form.setValue("nama", `${kuartalNames[kuartal - 1]} ${tahun}`);
    form.setValue("tanggalMulai", startDate.toISOString().split("T")[0]!);
    form.setValue("tanggalSelesai", endDate.toISOString().split("T")[0]!);
  }

  async function onSubmit(values: FormValues) {
    try {
      const result = await createPeriode(values);
      if (result.ok) {
        toast.success("Periode berhasil dibuat");
        setShowCreate(false);
        form.reset();
        router.refresh();
      } else {
        toast.error("Gagal membuat periode");
      }
    } catch {
      toast.error("Gagal membuat periode");
    }
  }

  async function handleToggleStatus(periode: PeriodeRow) {
    setLoading(periode.id);
    try {
      if (periode.status === "open") {
        await closePeriode(periode.id);
        toast.success("Periode ditutup");
      } else {
        await updatePeriode({ id: periode.id, status: "open" });
        toast.success("Periode dibuka kembali");
      }
      router.refresh();
    } catch {
      toast.error("Gagal mengubah status periode");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Buat Periode
        </Button>
      </div>

      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead className="w-20">Tahun</TableHead>
              <TableHead className="w-16">Q</TableHead>
              <TableHead>Mulai</TableHead>
              <TableHead>Selesai</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Belum ada periode penilaian.
                </TableCell>
              </TableRow>
            ) : (
              initialData.map((periode) => (
                <TableRow key={periode.id}>
                  <TableCell className="font-medium">{periode.nama}</TableCell>
                  <TableCell>{periode.tahun}</TableCell>
                  <TableCell>Q{periode.kuartal}</TableCell>
                  <TableCell>{periode.tanggalMulai}</TableCell>
                  <TableCell>{periode.tanggalSelesai}</TableCell>
                  <TableCell>
                    <Badge
                      variant={periode.status === "open" ? "default" : "secondary"}
                    >
                      {periode.status === "open" ? "Aktif" : "Ditutup"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loading === periode.id}
                      onClick={() => handleToggleStatus(periode)}
                    >
                      {periode.status === "open" ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        <Unlock className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Periode Baru</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tahun</Label>
                <Input
                  type="number"
                  min={2020}
                  max={2100}
                  {...form.register("tahun", { valueAsNumber: true })}
                  onChange={(e) => {
                    const tahun = parseInt(e.target.value);
                    form.setValue("tahun", tahun);
                    handleKuartalChange(form.getValues("kuartal"), tahun);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Kuartal</Label>
                <Select
                  value={String(form.watch("kuartal"))}
                  onValueChange={(v) => {
                    const kuartal = parseInt(v);
                    form.setValue("kuartal", kuartal);
                    handleKuartalChange(kuartal, form.getValues("tahun"));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                    <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                    <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                    <SelectItem value="4">Q4 (Okt-Des)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nama Periode</Label>
              <Input {...form.register("nama")} />
              {form.formState.errors.nama && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.nama.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Mulai</Label>
                <Input type="date" {...form.register("tanggalMulai")} />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Selesai</Label>
                <Input type="date" {...form.register("tanggalSelesai")} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Menyimpan..." : "Buat"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
