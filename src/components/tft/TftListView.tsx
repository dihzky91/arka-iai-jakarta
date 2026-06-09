"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPeriodeTft,
  deletePeriodeTft,
  type PeriodeTftRow,
} from "@/server/actions/tft/periode";

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Draft", variant: "secondary" },
    buka: { label: "Buka", variant: "default" },
    tutup: { label: "Tutup", variant: "outline" },
    penilaian: { label: "Penilaian", variant: "secondary" },
    selesai: { label: "Selesai", variant: "outline" },
  };
  const cfg = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function programLabel(program: string) {
  const map: Record<string, string> = {
    brevet_ab: "Brevet AB",
    brevet_c: "Brevet C",
    all: "Semua Program",
  };
  return map[program] ?? program;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

interface TftListViewProps {
  periodes: PeriodeTftRow[];
}

export function TftListView({ periodes }: TftListViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PeriodeTftRow | null>(null);

  // Create form state
  const [judul, setJudul] = useState("");
  const [slug, setSlug] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [program, setProgram] = useState<"brevet_ab" | "brevet_c" | "all">("brevet_ab");
  const [lokasi, setLokasi] = useState("");
  const [waktuMulai, setWaktuMulai] = useState("");
  const [waktuSelesai, setWaktuSelesai] = useState("");
  const [batasPendaftaran, setBatasPendaftaran] = useState("");
  const [maxPeserta, setMaxPeserta] = useState("");
  const [skorMinimum, setSkorMinimum] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [catatanInternal, setCatatanInternal] = useState("");

  function openCreate() {
    setJudul("");
    setSlug("");
    setTanggalMulai("");
    setTanggalSelesai("");
    setProgram("brevet_ab");
    setLokasi("");
    setWaktuMulai("");
    setWaktuSelesai("");
    setBatasPendaftaran("");
    setMaxPeserta("");
    setSkorMinimum("");
    setDeskripsi("");
    setCatatanInternal("");
    setCreateOpen(true);
  }

  function handleJudulChange(value: string) {
    setJudul(value);
    setSlug(generateSlug(value));
  }

  function handleCreate() {
    if (!judul.trim() || !slug.trim() || !tanggalMulai || !tanggalSelesai) {
      toast.error("Lengkapi field wajib.");
      return;
    }
    startTransition(async () => {
      const res = await createPeriodeTft({
        judul,
        slug,
        tanggalMulai,
        tanggalSelesai,
        program,
        lokasi: lokasi || undefined,
        waktuMulai: waktuMulai || undefined,
        waktuSelesai: waktuSelesai || undefined,
        batasPendaftaran: batasPendaftaran || undefined,
        maxPeserta: maxPeserta ? Number(maxPeserta) : undefined,
        skorMinimum: skorMinimum ? Number(skorMinimum) : undefined,
        deskripsi: deskripsi || undefined,
        catatanInternal: catatanInternal || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Periode TFT berhasil dibuat.");
      setCreateOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deletePeriodeTft(deleteTarget.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Periode TFT dihapus.");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/daftar/tft/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link form pendaftaran disalin.");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Buat Periode TFT
        </Button>
      </div>

      {periodes.length === 0 ? (
        <Card className="rounded-[24px]">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Belum ada periode TFT. Buat periode pertama untuk mulai menerima pendaftaran.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {periodes.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer rounded-[24px] transition-shadow hover:shadow-md"
              onClick={() => router.push(`/jadwal-otomatis/tft/${p.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{p.judul}</CardTitle>
                  {statusBadge(p.status)}
                </div>
                <CardDescription>{programLabel(p.program)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {p.tanggalMulai} — {p.tanggalSelesai}
                </p>
                {p.lokasi && (
                  <p className="text-sm text-muted-foreground">{p.lokasi}</p>
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium">{p.jumlahPendaftar} pendaftar</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => { e.stopPropagation(); copyLink(p.slug); }}
                      title="Salin link pendaftaran"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                      title="Hapus periode"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Periode TFT Baru</DialogTitle>
            <DialogDescription>Isi data dasar periode Training for Trainers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Judul *</p>
              <Input
                placeholder="TFT Brevet AB Juni 2026"
                value={judul}
                onChange={(e) => handleJudulChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Slug (URL) *</p>
              <Input
                placeholder="tft-brevet-ab-juni-2026"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Form akan diakses di: /daftar/tft/{slug || "..."}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Program Target *</p>
              <Select value={program} onValueChange={(v) => setProgram(v as typeof program)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brevet_ab">Brevet AB</SelectItem>
                  <SelectItem value="brevet_c">Brevet C</SelectItem>
                  <SelectItem value="all">Semua Program</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Tanggal Mulai *</p>
                <Input type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Tanggal Selesai *</p>
                <Input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Waktu Mulai</p>
                <Input type="time" value={waktuMulai} onChange={(e) => setWaktuMulai(e.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Waktu Selesai</p>
                <Input type="time" value={waktuSelesai} onChange={(e) => setWaktuSelesai(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Lokasi</p>
              <Input placeholder="Kantor IAI Jakarta" value={lokasi} onChange={(e) => setLokasi(e.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Batas Pendaftaran</p>
              <Input type="datetime-local" value={batasPendaftaran} onChange={(e) => setBatasPendaftaran(e.target.value)} />
              <p className="text-xs text-muted-foreground">Kosongkan jika pendaftaran ditutup manual.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Max Peserta</p>
                <Input type="number" min="1" value={maxPeserta} onChange={(e) => setMaxPeserta(e.target.value)} placeholder="Unlimited" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Skor Minimum</p>
                <Input type="number" min="0" max="100" step="0.01" value={skorMinimum} onChange={(e) => setSkorMinimum(e.target.value)} placeholder="Misal: 70" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Deskripsi Publik</p>
              <Textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows={4} placeholder="Informasi kegiatan yang tampil di form publik..." />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Catatan Internal</p>
              <Textarea value={catatanInternal} onChange={(e) => setCatatanInternal(e.target.value)} rows={2} placeholder="Catatan untuk admin..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? "Membuat..." : "Buat Periode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Periode TFT?</DialogTitle>
            <DialogDescription>
              Periode <span className="font-medium text-foreground">{deleteTarget?.judul}</span> beserta semua data pendaftar dan nilai akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
