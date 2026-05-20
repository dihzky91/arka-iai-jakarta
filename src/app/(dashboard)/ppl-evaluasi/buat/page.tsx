"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createKegiatan } from "@/server/actions/ppl-evaluasi/kegiatan";
import {
  applyTemaToKegiatan,
  incrementTemaUsage,
  suggestTema,
} from "@/server/actions/ppl-evaluasi/tema-bank";
import type { TemaSuggestion } from "@/server/actions/ppl-evaluasi/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const KATEGORI_PPL = [
  "Perpajakan", "Sistem Informasi & Softskill", "Akuntansi Keuangan",
  "Audit", "Akuntansi Syariah", "Akuntansi Manajemen",
  "Akuntansi Manajemen dan Manajemen Keuangan", "Akuntansi Perpajakan",
  "Manajemen Keuangan", "Akuntansi Keuangan & Softskill",
  "Akuntansi Keuangan dan Manajemen Keuangan", "Manajemen Strategik", "SAK & PSAK",
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
    defaultValues: { namaKegiatan: "", lokasi: "" },
  });

  const watchedNama = form.watch("namaKegiatan");
  const watchedKategori = form.watch("kategoriPpl");

  // ── Autocomplete state ────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<TemaSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Apply tema dialog ─────────────────────────────────────────────────────
  const [applyDialog, setApplyDialog] = useState<{
    temaId: number;
    temaNama: string;
  } | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = watchedNama?.trim() ?? "";
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const result = await suggestTema(q, watchedKategori || undefined);
        setSuggestions(result);
        setShowSuggestions(result.length > 0);
      } catch {
        // silently fail
      } finally {
        setSuggestLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [watchedNama, watchedKategori]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Apply tema handler ────────────────────────────────────────────────────
  const handleApplyTema = useCallback(async (temaId: number) => {
    setApplyLoading(true);
    try {
      const result = await applyTemaToKegiatan(temaId);
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Gagal memuat tema");
        return;
      }

      const { prefill } = result.data;
      if (prefill.namaKegiatan) form.setValue("namaKegiatan", prefill.namaKegiatan);
      if (prefill.kategoriPpl) form.setValue("kategoriPpl", prefill.kategoriPpl as FormValues["kategoriPpl"]);
      if (prefill.tipePelaksanaan) form.setValue("tipePelaksanaan", prefill.tipePelaksanaan as FormValues["tipePelaksanaan"]);
      if (prefill.tanggalMulai) form.setValue("tanggalMulai", prefill.tanggalMulai);
      if (prefill.tanggalSelesai) form.setValue("tanggalSelesai", prefill.tanggalSelesai);

      await incrementTemaUsage(temaId);
      toast.success("Tema berhasil diterapkan");
      setApplyDialog(null);
      setShowSuggestions(false);
    } finally {
      setApplyLoading(false);
    }
  }, [form]);

  // ── Submit ─────────────────────────────────────────────────────────────────
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
      description="Buat kegiatan PPL baru. Ketik nama untuk mencari dari Bank Tema."
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
            Isi data kegiatan PPL. Ketik nama kegiatan untuk mencari saran dari Bank Tema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Nama Kegiatan with autocomplete */}
            <div className="space-y-2" ref={containerRef}>
              <Label htmlFor="namaKegiatan">Nama Kegiatan *</Label>
              <div className="relative">
                <Input
                  id="namaKegiatan"
                  placeholder="Ketik untuk mencari saran tema..."
                  {...form.register("namaKegiatan")}
                />
                {suggestLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
                {showSuggestions && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg">
                    <div className="flex items-center justify-between border-b px-3 py-2">
                      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Sparkles className="h-3 w-3" />
                        Saran dari Bank Tema
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSuggestions(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                        onClick={() => setApplyDialog({ temaId: s.id, temaNama: s.namaTema })}
                      >
                        <div className="flex-1">
                          <p className="font-medium">{s.namaTema}</p>
                          <div className="mt-0.5 flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">{s.kategoriPpl}</Badge>
                            {s.preview.materiCount > 0 && (
                              <span className="text-[10px] text-muted-foreground">{s.preview.materiCount} materi</span>
                            )}
                            {s.preview.benefitCount > 0 && (
                              <span className="text-[10px] text-muted-foreground">{s.preview.benefitCount} benefit</span>
                            )}
                            {s.preview.hasNarasumberRekomendasi && (
                              <Badge variant="outline" className="text-[10px]">+narasumber</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <Badge variant="outline" className="text-[10px]">{s.usageCount}x</Badge>
                          <span className="text-[10px] text-muted-foreground">{Math.round(s.matchScore * 100)}%</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {KATEGORI_PPL.map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
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
                  <SelectTrigger><SelectValue placeholder="Pilih tipe" /></SelectTrigger>
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
                <Input id="tanggalMulai" type="date" {...form.register("tanggalMulai")} />
                {form.formState.errors.tanggalMulai && (
                  <p className="text-sm text-destructive">{form.formState.errors.tanggalMulai.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tanggalSelesai">Tanggal Selesai *</Label>
                <Input id="tanggalSelesai" type="date" {...form.register("tanggalSelesai")} />
                {form.formState.errors.tanggalSelesai && (
                  <p className="text-sm text-destructive">{form.formState.errors.tanggalSelesai.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lokasi">Lokasi</Label>
              <Input id="lokasi" placeholder="Contoh: Gedung IAI Lt. 3" {...form.register("lokasi")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skp">SKP (opsional)</Label>
              <Input id="skp" type="number" placeholder="Kosongkan untuk auto-kalkulasi dari durasi" {...form.register("skp")} />
              <p className="text-xs text-muted-foreground">Jika dikosongkan, SKP dihitung otomatis: (jumlah hari) × 8</p>
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

      {/* ── Apply Tema Dialog ──────────────────────────────────────────────── */}
      <Dialog open={applyDialog !== null} onOpenChange={(o) => !o && setApplyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gunakan Tema Ini?</DialogTitle>
            <DialogDescription>
              Data dari tema &quot;{applyDialog?.temaNama}&quot; akan mengisi form secara otomatis.
              Anda bisa mengubahnya sebelum menyimpan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            <p>Yang akan diisi otomatis:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Nama kegiatan</li>
              <li>Kategori PPL</li>
              <li>Tipe pelaksanaan</li>
              <li>Tanggal mulai &amp; selesai (berdasarkan durasi tema)</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialog(null)}>Batal</Button>
            <Button onClick={() => applyDialog && handleApplyTema(applyDialog.temaId)} disabled={applyLoading}>
              {applyLoading ? "Menerapkan..." : "Ya, Gunakan Tema"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
