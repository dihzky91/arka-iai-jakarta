"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listCutiBersama,
  createCutiBersama,
  deleteCutiBersama,
  toggleMemotongSaldo,
  getKonfigurasiCuti,
} from "@/server/actions/saldoCuti";
import type { CutiBersama } from "@/server/db/schema";

export function CutiBersamaManager() {
  const currentYear = new Date().getFullYear();
  const [tahun, setTahun] = useState(currentYear);
  const [rows, setRows] = useState<CutiBersama[]>([]);
  const [kuotaTahunan, setKuotaTahunan] = useState(12);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ tanggal: "", keterangan: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, config] = await Promise.all([
        listCutiBersama(tahun),
        getKonfigurasiCuti(tahun),
      ]);
      setRows(data);
      setKuotaTahunan(config.kuotaCutiTahunan);
    } catch {
      toast.error("Gagal memuat data cuti bersama.");
    } finally {
      setLoading(false);
    }
  }, [tahun]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await createCutiBersama({
        tahun,
        tanggal: form.tanggal,
        keterangan: form.keterangan,
      });
      if (res.ok) {
        toast.success(res.data.pesan);
        setForm({ tanggal: "", keterangan: "" });
        setShowForm(false);
        fetchData();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Gagal menambah cuti bersama.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    setSubmitting(true);
    try {
      const res = await deleteCutiBersama(deleteId);
      if (res.ok) {
        toast.success("Cuti bersama dihapus.");
        setDeleteId(null);
        fetchData();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Gagal menghapus cuti bersama.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: number, currentValue: boolean) => {
    const res = await toggleMemotongSaldo({ id, memotongSaldo: !currentValue });
    if (res.ok) {
      toast.success("Status pemotongan diperbarui.");
      fetchData();
    } else {
      toast.error(res.error);
    }
  };

  const totalMemotong = rows.filter((r) => r.memotongSaldo).length;
  const totalLiburSaja = rows.filter((r) => !r.memotongSaldo).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/60">
          <div>
            <CardTitle>Cuti Bersama Tahun {tahun}</CardTitle>
            <CardDescription>
              Kelola tanggal cuti bersama nasional dan dampaknya terhadap saldo karyawan.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={2020}
              max={2100}
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              className="w-24"
            />
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Tambah
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Summary */}
          {rows.length > 0 && (
            <div className="mb-4 flex items-center gap-4 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <Info className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                Total: <strong>{rows.length}</strong> hari ·
                Memotong saldo: <strong>{totalMemotong}</strong> hari ·
                Libur saja: <strong>{totalLiburSaja}</strong> hari ·
                Sisa cuti tahunan karyawan: <strong>{kuotaTahunan - totalMemotong}</strong> hari
              </span>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada cuti bersama untuk tahun {tahun}.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Potong Saldo</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                      <TableCell>
                        {new Date(row.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{row.keterangan}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={row.memotongSaldo}
                            onCheckedChange={() => handleToggle(row.id, row.memotongSaldo)}
                          />
                          <Badge className={row.memotongSaldo ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}>
                            {row.memotongSaldo ? "Ya" : "Tidak"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Dialog Tambah */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Cuti Bersama</DialogTitle>
            <DialogDescription>
              Tambahkan tanggal cuti bersama. Jika batas maksimal pemotongan belum tercapai,
              saldo seluruh karyawan akan otomatis berkurang.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input
                placeholder="Contoh: Cuti Bersama Idul Fitri"
                value={form.keterangan}
                onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
                maxLength={200}
                required
              />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowForm(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Hapus */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Cuti Bersama</DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus tanggal cuti bersama ini? Jika tanggal ini memotong saldo,
              saldo seluruh karyawan akan dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
