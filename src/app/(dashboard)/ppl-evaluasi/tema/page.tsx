"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { BookOpen, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
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
import {
  deleteTema,
  listTema,
} from "@/server/actions/ppl-evaluasi/tema-bank";
import type { TemaBankRow } from "@/server/actions/ppl-evaluasi/types";

const KATEGORI_PPL = [
  "Perpajakan",
  "Sistem Informasi & Softskill",
  "Akuntansi Keuangan", "Audit",
  "Akuntansi Syariah", "Akuntansi Manajemen",
  "Akuntansi Manajemen dan Manajemen Keuangan",
  "Akuntansi Perpajakan", "Manajemen Keuangan",
  "Akuntansi Keuangan & Softskill",
  "Akuntansi Keuangan dan Manajemen Keuangan",
  "Manajemen Strategik", "SAK & PSAK",
];

export default function TemaBankPage() {
  const [temaList, setTemaList] = useState<TemaBankRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [kategori, setKategori] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; nama: string } | null>(null);

  const loadTema = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await listTema({
          search: search || undefined,
          kategori: kategori !== "all" ? kategori : undefined,
        });
        setTemaList(result.data);
        setTotal(result.total);
      } catch {
        toast.error("Gagal memuat tema");
      } finally {
        setLoading(false);
      }
    });
  }, [search, kategori]);

  useEffect(() => {
    loadTema();
  }, [loadTema]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteTema(deleteTarget.id);
      if (result.ok) {
        toast.success("Tema berhasil dihapus");
        setDeleteTarget(null);
        loadTema();
      } else {
        toast.error(result.error ?? "Gagal menghapus tema");
      }
    });
  };

  return (
    <PageWrapper
      title="Bank Tema PPL"
      description="Library template kegiatan PPL. Cari, gunakan, dan kelola tema."
    >
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Bank Tema
              </CardTitle>
              <CardDescription>
                {total} tema tersedia
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/ppl-evaluasi/tema/buat">
                <Plus className="h-4 w-4 mr-1" />
                Tambah Tema
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Search & Filter */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari tema..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={kategori} onValueChange={setKategori}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {KATEGORI_PPL.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Memuat tema...</p>
            </div>
          ) : temaList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-medium">Belum ada tema</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Tema bisa ditambahkan manual atau dari kegiatan PPL yang sudah selesai.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Tema</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-center">Materi</TableHead>
                    <TableHead className="text-center">Benefit</TableHead>
                    <TableHead className="text-center">Digunakan</TableHead>
                    <TableHead>Terakhir Dipakai</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {temaList.map((tema) => (
                    <TableRow key={tema.id}>
                      <TableCell>
                        <Link
                          href={`/ppl-evaluasi/tema/${tema.id}`}
                          className="font-medium hover:underline"
                        >
                          {tema.namaTema}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {tema.kategoriPpl}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {tema.susunanMateri?.length ?? 0}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {tema.benefit?.length ?? 0}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {tema.usageCount}x
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tema.lastUsedAt
                          ? format(tema.lastUsedAt, "d MMM yyyy", { locale: localeId })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => setDeleteTarget({ id: tema.id, nama: tema.namaTema })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Tema</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus tema &quot;{deleteTarget?.nama}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
