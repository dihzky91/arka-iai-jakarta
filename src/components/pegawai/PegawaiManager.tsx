"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Copy,
  FileBadge2,
  HeartPulse,
  MoreHorizontal,
  Pencil,
  Plus,
  QrCode,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatTanggal } from "@/lib/utils";
import { BiodataForm } from "@/components/pegawai/BiodataForm";
import { KelengkapanTab } from "@/components/pegawai/KelengkapanTab";
import { KeluargaTab } from "@/components/pegawai/KeluargaTab";
import { PendidikanTab } from "@/components/pegawai/PendidikanTab";
import { PekerjaanTab } from "@/components/pegawai/PekerjaanTab";
import { KesehatanTab } from "@/components/pegawai/KesehatanTab";
import { IntegritasTab } from "@/components/pegawai/IntegritasTab";
import { PegawaiForm } from "@/components/pegawai/PegawaiForm";
import { deletePegawai, type PegawaiListRow } from "@/server/actions/pegawai";
import { generateQRContact } from "@/server/actions/qr";

const DETAIL_TABS = [
  { value: "biodata", label: "Biodata", icon: UserRound },
  { value: "kelengkapan", label: "Kelengkapan", icon: FileBadge2 },
  { value: "keluarga", label: "Keluarga", icon: UsersRound },
  { value: "pendidikan", label: "Pendidikan", icon: Briefcase },
  { value: "pekerjaan", label: "Pekerjaan", icon: Briefcase },
  { value: "kesehatan", label: "Kesehatan", icon: HeartPulse },
  { value: "integritas", label: "Integritas", icon: ShieldCheck },
] as const;

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: PegawaiDetailRow };

export type PegawaiDetailRow = PegawaiListRow & {
  biodata: {
    userId: string;
    noKtp: string | null;
    gender: "Laki-laki" | "Perempuan" | null;
    statusPernikahan: "BM" | "M" | "C" | "D" | "J" | null;
    tempatLahir: string | null;
    tanggalLahir: string | null;
    alamatTinggal: string | null;
    kodePos: string | null;
    provinsi: string | null;
    kotaKabupaten: string | null;
    alamatKtp: string | null;
  } | null;
};

export function PegawaiManager({
  initialData,
  divisiOptions,
  canManage,
  currentUserId,
}: {
  initialData: PegawaiDetailRow[];
  divisiOptions: Array<{ id: number; nama: string }>;
  canManage: boolean;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialData[0]?.id ?? null);
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<PegawaiDetailRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isQrPending, startQrTransition] = useTransition();

  const filteredData = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return initialData;

    return initialData.filter((row) =>
      [row.namaLengkap, row.email, row.divisiNama ?? "", row.jabatan ?? "", row.role ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [initialData, query]);

  const selected =
    filteredData.find((item) => item.id === selectedId) ?? filteredData[0] ?? null;

  // Admin bisa edit siapa saja; non-admin hanya bisa edit profil sendiri
  const canEditSelected = canManage || (!!currentUserId && selected?.id === currentUserId);

  function handleDeleteConfirm() {
    if (!deleteTarget) return;

    startDeleteTransition(async () => {
      const result = await deletePegawai({ id: deleteTarget.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`Pegawai "${deleteTarget.namaLengkap}" dihapus.`);
      setDeleteTarget(null);
      setSelectedId(null);
      router.refresh();
    });
  }

  function handleGenerateQrContact(userId: string) {
    startQrTransition(async () => {
      try {
        await generateQRContact({ userId });
        toast.success("QR Contact berhasil dibuat.");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal membuat QR Contact.",
        );
      }
    });
  }

  async function handleCopyQrLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link QR Contact berhasil disalin.");
    } catch {
      toast.error("Gagal menyalin link QR Contact.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Total Pegawai" value={String(initialData.length)} hint="Data akun pegawai yang tercatat" />
        <SummaryCard
          label="Pegawai Aktif"
          value={String(initialData.filter((item) => item.isActive !== false).length)}
          hint="Status akun aktif di sistem"
        />
        <SummaryCard
          label="Sudah Isi Biodata"
          value={String(initialData.filter((item) => item.biodata).length)}
          hint="Tab biodata sudah mulai terisi"
        />
        <SummaryCard
          label="Divisi Terhubung"
          value={String(new Set(initialData.map((item) => item.divisiId).filter(Boolean)).size)}
          hint="Distribusi pegawai ke divisi"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="gap-0 overflow-hidden rounded-[24px]">
          <CardContent className="px-0 pt-5">
            <div className="mb-3 flex flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
              {canManage ? (
                <Button onClick={() => setFormState({ open: true, mode: "create" })}>
                  <Plus className="h-4 w-4" />
                  Tambah Pegawai
                </Button>
              ) : null}
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama, email, jabatan, atau divisi..."
                className="max-w-md"
              />
            </div>
            <div className="divide-y divide-border/60">
              {filteredData.length ? (
                filteredData.map((row) => {
                  const isSelected = selected?.id === row.id;

                  return (
                    <div
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(row.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedId(row.id); }}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/40",
                        isSelected && "bg-primary/5",
                      )}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-medium text-primary">
                        {getInitials(row.namaLengkap)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-foreground">{row.namaLengkap}</p>
                          <Badge variant={row.isActive === false ? "outline" : "secondary"}>
                            {row.isActive === false ? "Nonaktif" : "Aktif"}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{row.email}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{row.divisiNama ?? "Tanpa divisi"}</span>
                          <span>•</span>
                          <span>{row.jabatan ?? "Jabatan belum diisi"}</span>
                        </div>
                      </div>
                      {canManage ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Aksi</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setFormState({ open: true, mode: "edit", row })}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Ubah Data Dasar
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
                  );
                })
              ) : (
                <div className="px-6 py-8">
                  <EmptyState
                    icon={UsersRound}
                    title="Tidak ada pegawai yang cocok"
                    description="Coba ubah kata kunci pencarian atau tambah pegawai baru jika datanya belum tersedia."
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selected ? (
          <Card className="rounded-[24px]">
            <CardHeader className="border-b border-border/60">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{selected.namaLengkap}</CardTitle>
                    <Badge>{selected.role ?? "staff"}</Badge>
                    <Badge variant="outline">{selected.jenisPegawai ?? "Tetap"}</Badge>
                  </div>
                  <CardDescription className="mt-2">
                    {selected.email} · {selected.divisiNama ?? "Tanpa divisi"}
                  </CardDescription>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <span>Tanggal masuk: {selected.tanggalMasuk ? formatTanggal(selected.tanggalMasuk) : "-"}</span>
                  <span>Biodata terakhir: {selected.biodata ? formatTanggal(selected.biodataUpdatedAt) : "Belum diisi"}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="biodata" className="gap-6">
                <div className="-mx-6 overflow-x-auto px-6 pb-px">
                  <TabsList variant="line" className="h-auto w-max min-w-full flex-nowrap justify-start gap-2 rounded-none p-0">
                    {DETAIL_TABS.map((tab) => (
                      <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 rounded-full border border-border/60 bg-background px-4 py-2 transition-colors hover:bg-muted/40 data-[state=active]:border-primary data-[state=active]:bg-primary/5">
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <TabsContent value="biodata">
                  <div className="space-y-4">
                    <Card className="rounded-[24px] border border-border/60 bg-muted/20 shadow-none">
                      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-xl">
                          <div className="flex items-center gap-2">
                            <QrCode className="h-4 w-4 text-primary" />
                            <p className="text-sm font-medium text-foreground">
                              QR Contact Pegawai
                            </p>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            QR Contact berisi vCard Nama, No. HP, Email, dan Jabatan.
                            Jika ada perubahan pada data tersebut, silakan generate
                            ulang agar kode QR tetap akurat.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleGenerateQrContact(selected.id)}
                              disabled={!canEditSelected || isQrPending}
                            >
                              <QrCode className="h-4 w-4" />
                              {selected.qrContactUrl
                                ? "Generate Ulang QR Contact"
                                : "Generate QR Contact"}
                            </Button>
                            {selected.qrContactUrl ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    window.open(
                                      selected.qrContactUrl!,
                                      "_blank",
                                      "noopener,noreferrer",
                                    )
                                  }
                                >
                                  Buka QR Contact
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleCopyQrLink(selected.qrContactUrl!)
                                  }
                                >
                                  <Copy className="h-4 w-4" />
                                  Salin Link QR
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex min-h-32 min-w-32 items-center justify-center rounded-2xl border bg-background p-3">
                          {selected.qrContactUrl ? (
                            <img
                              src={selected.qrContactUrl}
                              alt={`QR Contact ${selected.namaLengkap}`}
                              className="h-28 w-28 rounded-md bg-white p-1"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
                              <QrCode className="h-5 w-5" />
                              <span>QR Contact belum dibuat</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <BiodataForm
                      userId={selected.id}
                      initialData={
                        selected.biodata
                          ? {
                              userId: selected.biodata.userId,
                              noKtp: selected.biodata.noKtp ?? undefined,
                              gender: selected.biodata.gender ?? undefined,
                              statusPernikahan:
                                selected.biodata.statusPernikahan ?? undefined,
                              tempatLahir: selected.biodata.tempatLahir ?? undefined,
                              tanggalLahir: selected.biodata.tanggalLahir ?? undefined,
                              alamatTinggal: selected.biodata.alamatTinggal ?? undefined,
                              kodePos: selected.biodata.kodePos ?? undefined,
                              provinsi: selected.biodata.provinsi ?? undefined,
                              kotaKabupaten:
                                selected.biodata.kotaKabupaten ?? undefined,
                              alamatKtp: selected.biodata.alamatKtp ?? undefined,
                            }
                          : null
                      }
                      canEdit={canEditSelected}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="kelengkapan">
                  <KelengkapanTab userId={selected.id} canEdit={canEditSelected} />
                </TabsContent>

                <TabsContent value="keluarga">
                  <KeluargaTab userId={selected.id} canEdit={canEditSelected} />
                </TabsContent>

                <TabsContent value="pendidikan">
                  <PendidikanTab userId={selected.id} canEdit={canEditSelected} />
                </TabsContent>

                <TabsContent value="pekerjaan">
                  <PekerjaanTab userId={selected.id} canEdit={canEditSelected} />
                </TabsContent>

                <TabsContent value="kesehatan">
                  <KesehatanTab userId={selected.id} canEdit={canEditSelected} />
                </TabsContent>

                <TabsContent value="integritas">
                  <IntegritasTab userId={selected.id} canEdit={canEditSelected} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-[24px]">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Pilih satu pegawai untuk melihat detail dan tab administrasinya.
            </CardContent>
          </Card>
        )}
      </section>

      <PegawaiForm
        open={formState.open}
        onOpenChange={(open) => !open && setFormState({ open: false })}
        mode={formState.open ? formState.mode : "create"}
        initialData={formState.open && formState.mode === "edit" ? formState.row : null}
        divisiOptions={divisiOptions}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Pegawai?</DialogTitle>
            <DialogDescription>
              Data dasar pegawai <span className="font-medium text-foreground">{deleteTarget?.namaLengkap}</span> akan dihapus dari sistem. Pastikan data ini memang tidak lagi dibutuhkan.
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
        <p className="text-xs font-normal tracking-[0.2em] text-muted-foreground uppercase">{label}</p>
        <p className="text-3xl font-medium text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function TabPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <p className="text-base font-medium text-foreground">Tab {title} sedang disiapkan</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Kerangka modul sudah tersedia agar struktur 7 tab pegawai tetap konsisten. Form dan daftar rinci pada tab ini dapat dilanjutkan tanpa mengubah layout utama.
      </p>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
