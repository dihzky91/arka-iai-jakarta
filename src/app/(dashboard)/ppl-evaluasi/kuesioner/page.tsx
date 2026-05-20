"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  ClipboardList,
  Copy,
  FileText,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  listTemplates,
} from "@/server/actions/ppl-evaluasi/kuesioner";
import type { TemplateListRow } from "@/server/actions/ppl-evaluasi/kuesioner";
import type { TipeEvaluasi } from "@/components/ppl-evaluasi/form-builder/types";

const TIPE_EVALUASI_LABELS: Record<string, string> = {
  evaluasi_umum: "Evaluasi Umum",
  evaluasi_materi: "Evaluasi Materi",
  evaluasi_narasumber: "Evaluasi Narasumber",
  evaluasi_logistik: "Evaluasi Logistik",
};

const TIPE_EVALUASI_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  evaluasi_umum: "default",
  evaluasi_materi: "secondary",
  evaluasi_narasumber: "outline",
  evaluasi_logistik: "secondary",
};

export default function KuesionerPage() {
  const [templates, setTemplates] = useState<TemplateListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [newTipe, setNewTipe] = useState<TipeEvaluasi>("evaluasi_umum");

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; nama: string } | null>(null);

  // Duplicate state
  const [duplicateTarget, setDuplicateTarget] = useState<{ id: number; nama: string } | null>(null);
  const [duplicateName, setDuplicateName] = useState("");

  // Filter
  const [filterTipe, setFilterTipe] = useState<TipeEvaluasi | "all">("all");

  // Load templates
  const loadTemplates = useCallback(() => {
    startTransition(async () => {
      try {
        const data = await listTemplates();
        setTemplates(data);
      } catch {
        toast.error("Gagal memuat template");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  // Load on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreate = () => {
    if (!newNama.trim()) {
      toast.error("Nama template wajib diisi");
      return;
    }
    if (newNama.length > 200) {
      toast.error("Nama template maksimal 200 karakter");
      return;
    }

    startTransition(async () => {
      const result = await createTemplate({
        nama: newNama.trim(),
        fields: [],
        tipeEvaluasi: newTipe,
      });
      if (result.ok) {
        toast.success("Template berhasil dibuat");
        setCreateOpen(false);
        setNewNama("");
        setNewTipe("evaluasi_umum");
        loadTemplates();
      } else {
        toast.error(result.error ?? "Gagal membuat template");
      }
    });
  };

  const handleDuplicate = () => {
    if (!duplicateTarget) return;
    const name = duplicateName.trim() || `${duplicateTarget.nama} (copy)`;
    if (name.length > 200) {
      toast.error("Nama template maksimal 200 karakter");
      return;
    }

    startTransition(async () => {
      const result = await duplicateTemplate(duplicateTarget.id, name);
      if (result.ok) {
        toast.success("Template berhasil diduplikasi");
        setDuplicateTarget(null);
        setDuplicateName("");
        loadTemplates();
      } else {
        toast.error(result.error ?? "Gagal menduplikasi template");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;

    startTransition(async () => {
      const result = await deleteTemplate(deleteTarget.id);
      if (result.ok) {
        toast.success("Template berhasil dihapus");
        setDeleteTarget(null);
        loadTemplates();
      } else {
        toast.error(result.error ?? "Gagal menghapus template");
      }
    });
  };

  const filteredTemplates =
    filterTipe === "all"
      ? templates
      : templates.filter((t) => t.tipeEvaluasi === filterTipe);

  return (
    <PageWrapper
      title="Kuesioner Evaluasi"
      description="Kelola template kuesioner evaluasi untuk kegiatan PPL."
    >
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Template Kuesioner
              </CardTitle>
              <CardDescription className="mt-1">
                Buat, edit, duplikasi, dan hapus template kuesioner.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={filterTipe}
                onValueChange={(v) => setFilterTipe(v as TipeEvaluasi | "all")}
              >
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue placeholder="Semua Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="evaluasi_umum">Evaluasi Umum</SelectItem>
                  <SelectItem value="evaluasi_materi">Evaluasi Materi</SelectItem>
                  <SelectItem value="evaluasi_narasumber">Evaluasi Narasumber</SelectItem>
                  <SelectItem value="evaluasi_logistik">Evaluasi Logistik</SelectItem>
                </SelectContent>
              </Select>

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-1" />
                    Buat Template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Buat Template Baru</DialogTitle>
                    <DialogDescription>
                      Buat template kuesioner baru. Field bisa ditambahkan nanti dari halaman detail kegiatan.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-nama">Nama Template</Label>
                      <Input
                        id="new-nama"
                        value={newNama}
                        onChange={(e) => {
                          if (e.target.value.length <= 200) setNewNama(e.target.value);
                        }}
                        placeholder="Masukkan nama template..."
                        maxLength={200}
                      />
                      <p className="text-xs text-muted-foreground">{newNama.length}/200</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-tipe">Tipe Evaluasi</Label>
                      <Select
                        value={newTipe}
                        onValueChange={(v) => setNewTipe(v as TipeEvaluasi)}
                      >
                        <SelectTrigger id="new-tipe">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="evaluasi_umum">Evaluasi Umum</SelectItem>
                          <SelectItem value="evaluasi_materi">Evaluasi Materi</SelectItem>
                          <SelectItem value="evaluasi_narasumber">Evaluasi Narasumber</SelectItem>
                          <SelectItem value="evaluasi_logistik">Evaluasi Logistik</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>
                      Batal
                    </Button>
                    <Button onClick={handleCreate} disabled={isPending}>
                      {isPending ? "Menyimpan..." : "Buat Template"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Memuat template...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-medium">Belum ada template kuesioner</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {filterTipe !== "all"
                  ? "Tidak ada template dengan tipe evaluasi yang dipilih."
                  : "Klik &quot;Buat Template&quot; untuk memulai."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Template</TableHead>
                    <TableHead>Tipe Evaluasi</TableHead>
                    <TableHead className="text-center">Jumlah Field</TableHead>
                    <TableHead className="text-center">Digunakan</TableHead>
                    <TableHead>Terakhir Diubah</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <span className="font-medium">{template.nama}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={TIPE_EVALUASI_VARIANTS[template.tipeEvaluasi] ?? "default"}
                          className="text-xs"
                        >
                          {TIPE_EVALUASI_LABELS[template.tipeEvaluasi] ?? template.tipeEvaluasi}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">
                          {template.fieldCount} field
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {template.linkedKegiatanCount > 0 ? (
                          <Badge variant="outline" className="text-xs">
                            <Link2 className="h-3 w-3 mr-1" />
                            {template.linkedKegiatanCount} kegiatan
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {template.updatedAt
                          ? format(template.updatedAt, "d MMM yyyy", { locale: localeId })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Pencil className="h-3 w-3 mr-1" />
                              Aksi
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => {
                                setDuplicateTarget(template);
                                setDuplicateName(`${template.nama} (copy)`);
                              }}
                            >
                              <Copy className="h-3 w-3 mr-2" />
                              Duplikasi
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() =>
                                setDeleteTarget({ id: template.id, nama: template.nama })
                              }
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-4 text-xs text-muted-foreground">
                {templates.length} template
                {filterTipe !== "all" && filteredTemplates.length !== templates.length
                  ? ` (${filteredTemplates.length} filtered)`
                  : ""}
                . Untuk mengedit konfigurasi field, buka detail kegiatan PPL &rarr; tab Kuesioner.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Template</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus template &quot;{deleteTarget?.nama}&quot;?
              Template yang masih terhubung dengan kegiatan tidak dapat dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate name dialog */}
      <Dialog
        open={duplicateTarget !== null}
        onOpenChange={(open) => !open && setDuplicateTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplikasi Template</DialogTitle>
            <DialogDescription>
              Masukkan nama untuk template hasil duplikasi.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="dup-name">Nama Template Baru</Label>
              <Input
                id="dup-name"
                value={duplicateName}
                onChange={(e) => {
                  if (e.target.value.length <= 200) setDuplicateName(e.target.value);
                }}
                placeholder="Nama template baru..."
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateTarget(null)}>
              Batal
            </Button>
            <Button onClick={handleDuplicate} disabled={isPending}>
              {isPending ? "Menduplikasi..." : "Duplikasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
