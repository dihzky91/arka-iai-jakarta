"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createKonfig, deleteKonfig, type ConfigJenis, type ConfigRow } from "@/server/actions/jadwal-ujian/config";

interface JadwalUjianPengaturanProps {
  rows: ConfigRow[];
}

const TAB_LABELS: Record<ConfigJenis, string> = {
  program: "Program",
  tipe: "Tipe",
  mode: "Mode",
};

const TAB_DESCRIPTIONS: Record<ConfigJenis, string> = {
  program: "Daftar program studi yang tersedia saat membuat kelas ujian.",
  tipe: "Tipe jadwal kelas (mis. Reguler Pagi, Weekend).",
  mode: "Mode pembelajaran (mis. Offline, Online).",
};

export function JadwalUjianPengaturan({ rows }: JadwalUjianPengaturanProps) {
  const [deleteTarget, setDeleteTarget] = useState<ConfigRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const res = await deleteKonfig(deleteTarget.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`"${deleteTarget.nilai}" dihapus.`);
      setDeleteTarget(null);
    });
  }

  return (
    <>
      <Tabs defaultValue="program">
        <TabsList>
          {(["program", "tipe", "mode"] as ConfigJenis[]).map((jenis) => (
            <TabsTrigger key={jenis} value={jenis}>
              {TAB_LABELS[jenis]}
            </TabsTrigger>
          ))}
        </TabsList>

        {(["program", "tipe", "mode"] as ConfigJenis[]).map((jenis) => {
          const jenisRows = rows.filter((r) => r.jenis === jenis);
          return (
            <TabsContent key={jenis} value={jenis}>
              <KonfigSection
                jenis={jenis}
                description={TAB_DESCRIPTIONS[jenis]}
                rows={jenisRows}
                onDeleteRequest={setDeleteTarget}
              />
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus nilai?</DialogTitle>
            <DialogDescription>
              Nilai{" "}
              <span className="font-medium text-foreground">&ldquo;{deleteTarget?.nilai}&rdquo;</span>{" "}
              akan dihapus dari daftar{" "}
              <span className="font-medium text-foreground">{deleteTarget?.jenis}</span>.
              Kelas yang sudah menggunakan nilai ini tidak terpengaruh.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KonfigSection({
  jenis,
  description,
  rows,
  onDeleteRequest,
}: {
  jenis: ConfigJenis;
  description: string;
  rows: ConfigRow[];
  onDeleteRequest: (row: ConfigRow) => void;
}) {
  const [nilai, setNilai] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const trimmed = nilai.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createKonfig({ jenis, nilai: trimmed });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`"${trimmed}" ditambahkan ke ${jenis}.`);
      setNilai("");
    });
  }

  return (
    <Card className="mt-4 rounded-[24px]">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-base">{TAB_LABELS[jenis]}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder={`Tambah ${jenis} baru...`}
            value={nilai}
            onChange={(e) => setNilai(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            disabled={isPending}
            className="max-w-xs"
          />
          <Button onClick={handleAdd} disabled={isPending || !nilai.trim()}>
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada nilai. Tambahkan di atas.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="flex items-center gap-1">
                <Badge variant="secondary" className="rounded-full text-sm font-normal py-1 px-3">
                  {row.nilai}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDeleteRequest(row)}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="sr-only">Hapus {row.nilai}</span>
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
