"use client";

import { useMemo, useState, useTransition } from "react";
import { BriefcaseBusiness, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { deletePejabat, type PejabatRow } from "@/server/actions/pejabat";
import { PejabatForm } from "./PejabatForm";

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: PejabatRow };

export function PejabatManager({
  initialData,
  canManage,
  userOptions,
}: {
  initialData: PejabatRow[];
  canManage: boolean;
  userOptions: Array<{ id: string; label: string }>;
}) {
  const [query, setQuery] = useState("");
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<PejabatRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const filteredData = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return initialData;

    return initialData.filter((row) =>
      [row.namaJabatan, row.wilayah ?? "", row.userNama ?? "", row.userEmail ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [initialData, query]);

  function handleDeleteConfirm() {
    if (!deleteTarget) return;

    startDeleteTransition(async () => {
      const result = await deletePejabat({ id: deleteTarget.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`Pejabat "${deleteTarget.namaJabatan}" dihapus.`);
      setDeleteTarget(null);
    });
  }

  const activeCount = initialData.filter((item) => item.isActive !== false).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total Pejabat" value={String(initialData.length)} hint="Semua data pejabat penandatangan" />
        <SummaryCard label="Pejabat Aktif" value={String(activeCount)} hint="Dipakai sebagai opsi pada surat keluar" />
        <SummaryCard label="Terhubung ke Pegawai" value={String(initialData.filter((item) => item.userId).length)} hint="Sudah ditautkan ke akun internal" />
      </section>

      <Card className="rounded-[24px]">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {canManage ? (
              <Button onClick={() => setFormState({ open: true, mode: "create" })}>
                <Plus className="h-4 w-4" />
                Tambah Pejabat
              </Button>
            ) : null}
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama jabatan, wilayah, atau pegawai terkait..."
              className="max-w-md"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredData.length ? (
            filteredData.map((row) => (
              <Card key={row.id} className="rounded-[24px] border border-border shadow-none">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <BriefcaseBusiness className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{row.namaJabatan}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{row.wilayah ?? "Wilayah belum diisi"}</p>
                      </div>
                    </div>
                    {canManage ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Aksi</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setFormState({ open: true, mode: "edit", row })}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Ubah
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant={row.isActive === false ? "outline" : "secondary"}>
                      {row.isActive === false ? "Nonaktif" : "Aktif"}
                    </Badge>
                    {row.userNama ? <Badge variant="outline">Tertaut ke pegawai</Badge> : null}
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Pegawai terkait: {row.userNama ?? "-"}</p>
                    <p>Email: {row.userEmail ?? "-"}</p>
                    <p>Tanda tangan: {row.ttdUrl ? "Tersedia" : "Belum diisi"}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center text-sm text-muted-foreground">
              Tidak ada data pejabat yang sesuai dengan pencarian.
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      <PejabatForm
        open={formState.open}
        onOpenChange={(open) => !open && setFormState({ open: false })}
        mode={formState.open ? formState.mode : "create"}
        initialData={formState.open && formState.mode === "edit" ? formState.row : null}
        userOptions={userOptions}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Pejabat?</DialogTitle>
            <DialogDescription>
              Data pejabat <span className="font-medium text-foreground">{deleteTarget?.namaJabatan}</span> akan dihapus dari sistem jika belum dipakai pada dokumen lain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Batal
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="rounded-[24px] py-5">
      <CardContent className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">{label}</p>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
