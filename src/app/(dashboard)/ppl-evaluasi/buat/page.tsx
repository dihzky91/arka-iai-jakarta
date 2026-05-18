"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/layout/PageWrapper";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createKegiatan } from "@/server/actions/ppl-evaluasi/kegiatan";

// ─── Constants ───────────────────────────────────────────────────────────────

const KATEGORI_PPL = [
  "Perpajakan",
  "Sistem Informasi & Softskill",
  "Akuntansi Keuangan",
  "Audit",
  "Akuntansi Syariah",
  "Akuntansi Manajemen",
  "Akuntansi Manajemen dan Manajemen Keuangan",
  "Akuntansi Perpajakan",
  "Manajemen Keuangan",
  "Akuntansi Keuangan & Softskill",
  "Akuntansi Keuangan dan Manajemen Keuangan",
  "Manajemen Strategik",
  "SAK & PSAK",
] as const;

const TIPE_PELAKSANAAN = ["online", "offline", "hybrid"] as const;

// ─── Schema ──────────────────────────────────────────────────────────────────

const formSchema = z.object({
  namaKegiatan: z.string().min(1, "Nama kegiatan wajib diisi").max(255),
  kategoriPpl: z.enum(KATEGORI_PPL, { required_error: "Pilih kategori PPL" }),
  tipePelaksanaan: z.enum(TIPE_PELAKSANAAN, { required_error: "Pilih tipe pelaksanaan" }),
  tanggalMulai: z.string().min(1, "Tanggal mulai wajib diisi"),
  tanggalSelesai: z.string().min(1, "Tanggal selesai wajib diisi"),
  lokasi: z.string().max(255).optional(),
  skp: z.coerce.number().int().min(1).max(999).optional(),
}).refine(
  (d) => !d.tanggalMulai || !d.tanggalSelesai || d.tanggalSelesai >= d.tanggalMulai,
  { message: "Tanggal selesai harus sama atau setelah tanggal mulai", path: ["tanggalSelesai"] },
);

type FormValues = z.infer<typeof formSchema>;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BuatKegiatanPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      namaKegiatan: "",
      lokasi: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const result = await createKegiatan({
        namaKegiatan: values.namaKegiatan,
        kategoriPpl: values.kategoriPpl,
        tipePelaksanaan: values.tipePelaksanaan,
        tanggalMulai: values.tanggalMulai,
        tanggalSelesai: values.tanggalSelesai,
        lokasi: values.lokasi || undefined,
        skp: values.skp || undefined,
      });

      if (!result.ok) {
        toast.error(result.error ?? "Gagal membuat kegiatan");
        return;
      }

      toast.success("Kegiatan PPL berhasil dibuat");
      router.push(`/ppl-evaluasi/${result.data?.id}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageWrapper
      title="Tambah Kegiatan PPL"
      description="Buat kegiatan PPL baru."
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/ppl-evaluasi">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali
          </Link>
        </Button>
      </div>

      <Card className="mx-auto max-w-2xl rounded-[24px]">
        <CardHeader>
          <CardTitle>Informasi Kegiatan</CardTitle>
          <CardDescription>
            Isi data kegiatan PPL. SKP akan dihitung otomatis dari durasi jika tidak diisi manual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="namaKegiatan">Nama Kegiatan *</Label>
              <Input
                id="namaKegiatan"
                placeholder="Contoh: Seminar Perpajakan 2026"
                {...form.register("namaKegiatan")}
              />
              {form.formState.errors.namaKegiatan && (
                <p className="text-sm text-destructive">{form.formState.errors.namaKegiatan.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kategori PPL *</Label>
                <Select
                  value={form.watch("kategoriPpl") ?? ""}
                  onValueChange={(v) => form.setValue("kategoriPpl", v as FormValues["kategoriPpl"], { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {KATEGORI_PPL.map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.kategoriPpl && (
                  <p className="text-sm text-destructive">{form.formState.errors.kategoriPpl.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tipe Pelaksanaan *</Label>
                <Select
                  value={form.watch("tipePelaksanaan") ?? ""}
                  onValueChange={(v) => form.setValue("tipePelaksanaan", v as FormValues["tipePelaksanaan"], { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.tipePelaksanaan && (
                  <p className="text-sm text-destructive">{form.formState.errors.tipePelaksanaan.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tanggalMulai">Tanggal Mulai *</Label>
                <Input
                  id="tanggalMulai"
                  type="date"
                  {...form.register("tanggalMulai")}
                />
                {form.formState.errors.tanggalMulai && (
                  <p className="text-sm text-destructive">{form.formState.errors.tanggalMulai.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tanggalSelesai">Tanggal Selesai *</Label>
                <Input
                  id="tanggalSelesai"
                  type="date"
                  {...form.register("tanggalSelesai")}
                />
                {form.formState.errors.tanggalSelesai && (
                  <p className="text-sm text-destructive">{form.formState.errors.tanggalSelesai.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lokasi">Lokasi</Label>
              <Input
                id="lokasi"
                placeholder="Contoh: Gedung IAI Lt. 3"
                {...form.register("lokasi")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skp">SKP (opsional)</Label>
              <Input
                id="skp"
                type="number"
                placeholder="Kosongkan untuk auto-kalkulasi dari durasi"
                {...form.register("skp")}
              />
              <p className="text-xs text-muted-foreground">
                Jika dikosongkan, SKP dihitung otomatis: (jumlah hari) × 8
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Buat Kegiatan"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/ppl-evaluasi">Batal</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
