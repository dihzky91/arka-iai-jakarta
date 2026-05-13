"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  CalendarPlus,
  Eye,
  Grid2X2,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTanggal } from "@/lib/utils";
import {
  createEvent,
  deleteEvent,
  listEvents,
  updateEventStatus,
  updateEvent,
  type EventListResult,
  type EventTemplateOption,
  type EventRow,
  type KategoriKegiatan,
  type StatusEvent,
} from "@/server/actions/sertifikat/events";
import type { SignatoryRow } from "@/server/actions/sertifikat/signatories";

const categories = ["Workshop", "Brevet AB", "Brevet C", "BFA", "Lainnya"] as const;
const statusOptions = ["aktif", "dibatalkan", "ditunda", "arsip"] as const;

const eventFormSchema = z.object({
  kodeEvent: z.string().trim().min(1, "Kode event wajib diisi.").max(30),
  namaKegiatan: z.string().trim().min(1, "Nama kegiatan wajib diisi."),
  kategori: z.enum(categories),
  statusEvent: z.enum(statusOptions),
  tanggalMulai: z.string().min(1, "Tanggal mulai wajib diisi."),
  tanggalSelesai: z.string().min(1, "Tanggal selesai wajib diisi."),
  lokasi: z.string().optional(),
  skp: z.string().optional(),
  keterangan: z.string().optional(),
  certificateTemplateId: z.coerce.number().int().positive().optional().nullable(),
  signatories: z.array(
    z.object({
      signatoryId: z.coerce.number().int().positive(),
      urutan: z.coerce.number().int().positive(),
    }),
  ),
}).refine(
  (data) => !data.tanggalMulai || !data.tanggalSelesai || data.tanggalSelesai >= data.tanggalMulai,
  { message: "Tanggal selesai tidak boleh sebelum tanggal mulai.", path: ["tanggalSelesai"] },
);

type EventFormValues = z.infer<typeof eventFormSchema>;
type ViewMode = "grid" | "table";

type FilterState = {
  search: string;
  kategori: KategoriKegiatan | "all";
  status: "active" | "inactive" | StatusEvent | "all";
  location: string;
  skpMin: string;
  skpMax: string;
  dateFrom: string;
  dateTo: string;
};

const defaultFilters: FilterState = {
  search: "",
  kategori: "all",
  status: "all",
  location: "",
  skpMin: "",
  skpMax: "",
  dateFrom: "",
  dateTo: "",
};

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toFormValues(event?: EventRow): EventFormValues {
  return {
    kodeEvent: event?.kodeEvent ?? "",
    namaKegiatan: event?.namaKegiatan ?? "",
    kategori: event?.kategori ?? "Workshop",
    statusEvent: event?.statusEvent ?? "aktif",
    tanggalMulai: event?.tanggalMulai ?? "",
    tanggalSelesai: event?.tanggalSelesai ?? "",
    lokasi: event?.lokasi ?? "",
    skp: event?.skp ?? "",
    keterangan: event?.keterangan ?? "",
    certificateTemplateId: event?.certificateTemplateId ?? null,
    signatories:
      event?.signatories.map((item, index) => ({
        signatoryId: item.id,
        urutan: item.urutan || index + 1,
      })) ?? [],
  };
}

export function EventManager({
  initialEventList,
  signatoryOptions,
  templateOptions,
}: {
  initialEventList: EventListResult;
  signatoryOptions: SignatoryRow[];
  templateOptions: EventTemplateOption[];
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [data, setData] = useState<EventListResult>(initialEventList);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: toFormValues(),
  });
  const signatoryFields = useFieldArray({
    control: form.control,
    name: "signatories",
  });

  function fetchData(overrides: Partial<FilterState & { page?: number }> = {}) {
    startTransition(async () => {
      const f = { ...filters, ...overrides };
      const result = await listEvents({
        search: f.search || undefined,
        kategori: f.kategori !== "all" ? f.kategori as KategoriKegiatan : undefined,
        statusEvent: (f.status !== "all" && f.status !== "active" && f.status !== "inactive") ? f.status as StatusEvent : undefined,
        location: f.location || undefined,
        skpMin: f.skpMin || undefined,
        skpMax: f.skpMax || undefined,
        dateFrom: f.dateFrom || undefined,
        dateTo: f.dateTo || undefined,
        page: f.page ?? page,
        pageSize: 25,
      });
      setData(result);
    });
  }

  const filteredEvents = data.rows;

  function openCreateDialog() {
    setEditingEvent(null);
    form.reset(toFormValues());
    setDialogOpen(true);
  }

  function openEditDialog(event: EventRow) {
    setEditingEvent(event);
    form.reset(toFormValues(event));
    setDialogOpen(true);
  }

  function handleSubmit(values: EventFormValues) {
    startTransition(async () => {
      const result = editingEvent
        ? await updateEvent(editingEvent.id, values)
        : await createEvent(values);

      if (result.ok) {
        toast.success(editingEvent ? "Kegiatan berhasil diperbarui." : "Kegiatan berhasil ditambahkan.");
        setDialogOpen(false);
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(event: EventRow) {
    const confirmed = window.confirm(`Hapus kegiatan "${event.namaKegiatan}"?`);
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (result.ok) {
        toast.success("Kegiatan berhasil dihapus.");
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleStatusChange(event: EventRow, statusEvent: StatusEvent) {
    startTransition(async () => {
      const result = await updateEventStatus(event.id, statusEvent);
      if (result.ok) {
        toast.success("Status kegiatan berhasil diperbarui.");
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  }

  function addSignatory(signatoryId: string) {
    const id = Number(signatoryId);
    const current = form.getValues("signatories");
    if (current.some((item) => item.signatoryId === id)) return;
    signatoryFields.append({ signatoryId: id, urutan: current.length + 1 });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(7,minmax(0,1fr))_auto]">
          <Input
            placeholder="Cari kegiatan"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
          />
          <Select
            value={filters.kategori}
            onValueChange={(value) => {
              setFilters((prev) => ({ ...prev, kategori: value as FilterState["kategori"] }));
              fetchData({ kategori: value as FilterState["kategori"] });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(value) => {
              setFilters((prev) => ({ ...prev, status: value as FilterState["status"] }));
              fetchData({ status: value as FilterState["status"] });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Lewat Tanggal</SelectItem>
              <SelectItem value="dibatalkan">Dibatalkan</SelectItem>
              <SelectItem value="ditunda">Ditunda</SelectItem>
              <SelectItem value="arsip">Arsip</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Lokasi"
            value={filters.location}
            onChange={(event) => setFilters((prev) => ({ ...prev, location: event.target.value }))}
          />
          <Input
            type="number"
            placeholder="SKP min"
            value={filters.skpMin}
            onChange={(event) => setFilters((prev) => ({ ...prev, skpMin: event.target.value }))}
          />
          <Input
            type="number"
            placeholder="SKP max"
            value={filters.skpMax}
            onChange={(event) => setFilters((prev) => ({ ...prev, skpMax: event.target.value }))}
          />
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
          />
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "table" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Tambah
            </Button>
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredEvents.map((event) => (
            <Card key={event.id} className="rounded-xl transition-all hover:border-primary/20 hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="leading-6">{event.namaKegiatan}</CardTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-mono">{event.kodeEvent}</span>
                      <span className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {formatTanggal(event.tanggalMulai)} - {formatTanggal(event.tanggalSelesai)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="secondary">{event.kategori}</Badge>
                    <StatusBadge status={event.statusEvent} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <Info label="Lokasi" value={event.lokasi ?? "-"} />
                  <Info label="SKP" value={event.skp ?? "-"} />
                  <Info label="Peserta" value={String(event.participantCount)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/sertifikat/kegiatan/${event.id}`}>
                      <Eye className="h-4 w-4" />
                      Detail
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(event)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                        Status
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {statusOptions.map((status) => (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => handleStatusChange(event, status)}
                        >
                          {statusLabel(status)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(event)}>
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-xl">
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Kegiatan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>SKP</TableHead>
                  <TableHead>Peserta</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-mono">{event.kodeEvent}</TableCell>
                    <TableCell className="font-medium">{event.namaKegiatan}</TableCell>
                    <TableCell>{event.kategori}</TableCell>
                    <TableCell><StatusBadge status={event.statusEvent} /></TableCell>
                    <TableCell>
                      {formatTanggal(event.tanggalMulai)} - {formatTanggal(event.tanggalSelesai)}
                    </TableCell>
                    <TableCell>{event.lokasi ?? "-"}</TableCell>
                    <TableCell>{event.skp ?? "-"}</TableCell>
                    <TableCell>{event.participantCount}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="icon-sm">
                          <Link href={`/sertifikat/kegiatan/${event.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="outline" size="icon-sm" onClick={() => openEditDialog(event)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon-sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {statusOptions.map((status) => (
                              <DropdownMenuItem
                                key={status}
                                onClick={() => handleStatusChange(event, status)}
                              >
                                {statusLabel(status)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="destructive" size="icon-sm" onClick={() => handleDelete(event)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {filteredEvents.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="Belum ada kegiatan"
          description={
            filters.search ||
            filters.kategori !== "all" ||
            filters.status !== "all" ||
            filters.location ||
            filters.skpMin ||
            filters.skpMax ||
            filters.dateFrom ||
            filters.dateTo
              ? "Tidak ada kegiatan yang sesuai dengan filter saat ini."
              : "Tambahkan kegiatan untuk mulai mengelola peserta dan penerbitan sertifikat."
          }
          action={
            <Button type="button" size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Tambah Kegiatan
            </Button>
          }
        />
      ) : null}

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Halaman {data.page} dari {data.totalPages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => { setPage(data.page - 1); fetchData({ page: data.page - 1 }); }}>
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => { setPage(data.page + 1); fetchData({ page: data.page + 1 }); }}>
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit Kegiatan" : "Tambah Kegiatan"}</DialogTitle>
            <DialogDescription>Lengkapi data kegiatan dan penandatangan sertifikat.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Kode Event</Label>
                <Input placeholder="Contoh: WS-TEST-001" {...form.register("kodeEvent")} />
                <FormError message={form.formState.errors.kodeEvent?.message} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.watch("statusEvent")}
                  onValueChange={(value) => form.setValue("statusEvent", value as StatusEvent)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nama Kegiatan</Label>
              <Input {...form.register("namaKegiatan")} />
              <FormError message={form.formState.errors.namaKegiatan?.message} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select
                  value={form.watch("kategori")}
                  onValueChange={(value) => form.setValue("kategori", value as KategoriKegiatan)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jumlah SKP</Label>
                <Input {...form.register("skp")} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tanggal Mulai</Label>
                <Input type="date" {...form.register("tanggalMulai")} />
                <FormError message={form.formState.errors.tanggalMulai?.message} />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Selesai</Label>
                <Input type="date" {...form.register("tanggalSelesai")} />
                <FormError message={form.formState.errors.tanggalSelesai?.message} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lokasi</Label>
              <Input {...form.register("lokasi")} />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea {...form.register("keterangan")} />
            </div>
            <div className="space-y-2">
              <Label>Template Sertifikat</Label>
              <Select
                value={form.watch("certificateTemplateId") ? String(form.watch("certificateTemplateId")) : "__default__"}
                onValueChange={(value) =>
                  form.setValue("certificateTemplateId", value === "__default__" ? null : Number(value))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Gunakan default kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Gunakan default kategori</SelectItem>
                  {templateOptions
                    .filter((template) => template.kategori === form.watch("kategori"))
                    .map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.nama}{template.isDefault ? " (Default)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 rounded-xl border border-border/60 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <Label>Penandatangan</Label>
                <Select onValueChange={addSignatory}>
                  <SelectTrigger className="w-full md:w-72">
                    <SelectValue placeholder="Tambah penandatangan" />
                  </SelectTrigger>
                  <SelectContent>
                    {signatoryOptions.map((signatory) => (
                      <SelectItem key={signatory.id} value={String(signatory.id)}>
                        {signatory.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                {signatoryFields.fields.map((field, index) => {
                  const option = signatoryOptions.find(
                    (item) => item.id === form.watch(`signatories.${index}.signatoryId`),
                  );
                  return (
                    <div key={field.id} className="grid gap-2 rounded-lg bg-muted/35 p-3 md:grid-cols-[1fr_90px_auto] md:items-center">
                      <div className="text-sm">
                        <p className="font-medium">{option?.nama ?? "Penandatangan"}</p>
                        <p className="text-muted-foreground">{option?.jabatan ?? "-"}</p>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        {...form.register(`signatories.${index}.urutan`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => signatoryFields.remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                {signatoryFields.fields.length === 0 ? (
                  <EmptyState
                    title="Belum ada penandatangan dipilih"
                    description="Tambahkan penandatangan agar sertifikat kegiatan siap diterbitkan."
                    className="min-h-28 px-4 py-6"
                  />
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}

function statusLabel(status: StatusEvent) {
  const labels: Record<StatusEvent, string> = {
    aktif: "Aktif",
    dibatalkan: "Dibatalkan",
    ditunda: "Ditunda",
    arsip: "Arsip",
  };
  return labels[status];
}

function StatusBadge({ status }: { status: StatusEvent }) {
  const classes: Record<StatusEvent, string> = {
    aktif: "border-green-200 bg-green-50 text-green-700",
    dibatalkan: "border-red-200 bg-red-50 text-red-700",
    ditunda: "border-orange-200 bg-orange-50 text-orange-700",
    arsip: "border-gray-200 bg-gray-50 text-gray-700",
  };
  return (
    <Badge variant="outline" className={classes[status]}>
      {statusLabel(status)}
    </Badge>
  );
}

function FormError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}
