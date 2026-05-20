"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createTema } from "@/server/actions/ppl-evaluasi/tema-bank";
import type { KategoriPpl, TipePelaksanaan } from "@/server/actions/ppl-evaluasi/types";

const KATEGORI_PPL = [
  "Perpajakan", "Sistem Informasi & Softskill", "Akuntansi Keuangan",
  "Audit", "Akuntansi Syariah", "Akuntansi Manajemen",
  "Akuntansi Manajemen dan Manajemen Keuangan", "Akuntansi Perpajakan",
  "Manajemen Keuangan", "Akuntansi Keuangan & Softskill",
  "Akuntansi Keuangan dan Manajemen Keuangan", "Manajemen Strategik", "SAK & PSAK",
] as const;

interface MateriFormItem {
  judul: string;
  deskripsi: string;
  durasiMenit: number;
}

export default function BuatTemaPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [namaTema, setNamaTema] = useState("");
  const [kategoriPpl, setKategoriPpl] = useState<KategoriPpl | "">("");
  const [latarBelakang, setLatarBelakang] = useState("");
  const [targetPeserta, setTargetPeserta] = useState("");
  const [durasiHari, setDurasiHari] = useState(1);
  const [tipePelaksanaan, setTipePelaksanaan] = useState<TipePelaksanaan | "">("");
  const [benefitStr, setBenefitStr] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [materiList, setMateriList] = useState<MateriFormItem[]>([
    { judul: "", deskripsi: "", durasiMenit: 60 },
  ]);

  const addMateri = () => {
    setMateriList([...materiList, { judul: "", deskripsi: "", durasiMenit: 60 }]);
  };

  const removeMateri = (index: number) => {
    if (materiList.length > 1) {
      setMateriList(materiList.filter((_, i) => i !== index));
    }
  };

  const updateMateri = (index: number, updates: Partial<MateriFormItem>) => {
    const list = [...materiList];
    list[index] = { ...list[index], ...updates } as MateriFormItem;
    setMateriList(list);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!namaTema.trim()) { toast.error("Nama tema wajib diisi"); return; }
    if (!kategoriPpl) { toast.error("Pilih kategori PPL"); return; }

    setIsSubmitting(true);
    try {
      const result = await createTema({
        namaTema: namaTema.trim(),
        kategoriPpl: kategoriPpl as KategoriPpl,
        latarBelakang: latarBelakang || undefined,
        targetPeserta: targetPeserta || undefined,
        durasiHari,
        tipePelaksanaanDefault: (tipePelaksanaan || null) as TipePelaksanaan | null,
        benefit: benefitStr.split("\n").map((s) => s.trim()).filter(Boolean),
        tags: tagsStr.split(",").map((s) => s.trim()).filter(Boolean),
        susunanMateri: materiList
          .filter((m) => m.judul.trim())
          .map((m, i) => ({
            judul: m.judul.trim(),
            deskripsi: m.deskripsi.trim(),
            durasiMenit: m.durasiMenit,
            urutan: i + 1,
          })),
      });

      if (!result.ok) {
        toast.error(result.error ?? "Gagal membuat tema");
        return;
      }

      toast.success("Tema berhasil dibuat");
      router.push(`/ppl-evaluasi/tema/${result.data?.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageWrapper title="Tambah Tema Baru" description="Buat tema kegiatan PPL baru untuk Bank Tema.">
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/ppl-evaluasi/tema">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali
          </Link>
        </Button>
      </div>

      <Card className="mx-auto max-w-2xl rounded-[24px]">
        <CardHeader>
          <CardTitle>Informasi Tema</CardTitle>
          <CardDescription>Isi data tema kegiatan PPL.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Tema *</Label>
              <Input id="nama" value={namaTema} onChange={(e) => setNamaTema(e.target.value)} placeholder="Contoh: Workshop Transfer Pricing 2026" maxLength={255} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kategori PPL *</Label>
                <Select value={kategoriPpl} onValueChange={(v) => setKategoriPpl(v as KategoriPpl)}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {KATEGORI_PPL.map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipe Pelaksanaan</Label>
                <Select value={tipePelaksanaan} onValueChange={(v) => setTipePelaksanaan(v as TipePelaksanaan | "")}>
                  <SelectTrigger><SelectValue placeholder="Pilih tipe" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Durasi (hari)</Label>
              <Input type="number" min={1} value={durasiHari} onChange={(e) => setDurasiHari(Number(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="latar">Latar Belakang</Label>
              <Textarea id="latar" value={latarBelakang} onChange={(e) => setLatarBelakang(e.target.value)} rows={3} placeholder="Deskripsi latar belakang / urgensi tema..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target">Target Peserta</Label>
              <Input id="target" value={targetPeserta} onChange={(e) => setTargetPeserta(e.target.value)} placeholder="Deskripsi target audience" />
            </div>

            {/* Susunan Materi */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Susunan Materi</Label>
                <Button type="button" variant="outline" size="sm" onClick={addMateri}>
                  <Plus className="h-3 w-3 mr-1" /> Tambah
                </Button>
              </div>
              {materiList.map((m, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Materi {i + 1}</span>
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeMateri(i)} disabled={materiList.length <= 1}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input value={m.judul} onChange={(e) => updateMateri(i, { judul: e.target.value })} placeholder="Judul materi" />
                  <Input value={m.deskripsi} onChange={(e) => updateMateri(i, { deskripsi: e.target.value })} placeholder="Deskripsi (opsional)" />
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <Input type="number" min={1} value={m.durasiMenit} onChange={(e) => updateMateri(i, { durasiMenit: Number(e.target.value) })} className="w-24" />
                    <span className="text-xs text-muted-foreground">menit</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="benefit">Benefit (satu per baris)</Label>
              <Textarea id="benefit" value={benefitStr} onChange={(e) => setBenefitStr(e.target.value)} rows={3} placeholder="Memahami konsep transfer pricing&#10;Mampu menyusun dokumentasi TP&#10;... " />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (dipisah koma)</Label>
              <Input id="tags" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="perpajakan, transfer pricing, internasional" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Buat Tema"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/ppl-evaluasi/tema">Batal</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
