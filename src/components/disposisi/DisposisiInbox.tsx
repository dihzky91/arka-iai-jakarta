"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { CheckCheck, Clock3, Eye, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  updateStatusDisposisi,
  type DisposisiTimelineRow,
} from "@/server/actions/disposisi";
import {
  cn,
  formatTanggal,
  formatTanggalPendek,
  getTodayIsoInJakarta,
} from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  belum_dibaca: {
    label: "Belum Dibaca",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
  },
  dibaca: {
    label: "Dibaca",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
  },
  diproses: {
    label: "Diproses",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  },
  selesai: {
    label: "Selesai",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  const config = STATUS_CONFIG[status ?? "belum_dibaca"] ?? {
    label: status ?? "-",
    className: "bg-secondary text-secondary-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

export function DisposisiInbox({
  items,
  canCreateDisposisi = false,
}: {
  items: DisposisiTimelineRow[];
  canCreateDisposisi?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localItems, setLocalItems] = useState(items);
  const [activeFilter, setActiveFilter] = useState<
    "semua" | "belum_dibaca" | "diproses" | "selesai" | "deadline"
  >("semua");

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const todayKey = getTodayIsoInJakarta();
  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case "belum_dibaca":
        return localItems.filter((item) => item.status === "belum_dibaca");
      case "diproses":
        return localItems.filter((item) => item.status === "diproses");
      case "selesai":
        return localItems.filter((item) => item.status === "selesai");
      case "deadline":
        return localItems.filter(
          (item) =>
            !!item.batasWaktu &&
            item.batasWaktu <= todayKey &&
            item.status !== "selesai",
        );
      default:
        return localItems;
    }
  }, [activeFilter, localItems, todayKey]);

  const columns = useMemo<ColumnDef<DisposisiTimelineRow>[]>(() => {
    return [
      {
        id: "index",
        header: "No.",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.index + 1}
          </span>
        ),
      },
      {
        id: "surat",
        header: "Surat",
        accessorKey: "suratPerihal",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium leading-tight">
              {row.original.suratPerihal ?? "-"}
            </p>
            <p className="text-xs leading-tight text-muted-foreground">
              {row.original.suratPengirim ?? "-"}
            </p>
          </div>
        ),
      },
      {
        id: "pengirim",
        header: "Dari",
        cell: ({ row }) => (
          <span className="text-sm text-foreground">
            {row.original.dariNama ?? "-"}
          </span>
        ),
      },
      {
        id: "instruksi",
        header: "Instruksi",
        cell: ({ row }) => (
          <div className="max-w-[260px] text-sm text-foreground">
            {row.original.instruksi ?? (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </div>
        ),
      },
      {
        id: "deadline",
        header: "Batas Waktu",
        cell: ({ row }) => {
          const isUrgent =
            !!row.original.batasWaktu &&
            row.original.batasWaktu <= todayKey &&
            row.original.status !== "selesai";

          return (
            <span
              className={cn(
                "text-sm",
                isUrgent ? "font-medium text-rose-700" : "text-muted-foreground",
              )}
            >
              {row.original.batasWaktu
                ? formatTanggalPendek(row.original.batasWaktu)
                : "-"}
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "chain",
        header: "Chain",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.parentDisposisiId ? "Turunan" : "Utama"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {row.original.status === "belum_dibaca" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatus(row.original.id, "dibaca")}
                disabled={isPending}
              >
                <Eye className="h-4 w-4" />
                Baca
              </Button>
            ) : null}
            {row.original.status !== "diproses" && row.original.status !== "selesai" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatus(row.original.id, "diproses")}
                disabled={isPending}
              >
                <Clock3 className="h-4 w-4" />
                Proses
              </Button>
            ) : null}
            {row.original.status !== "selesai" ? (
              <Button
                size="sm"
                onClick={() => handleStatus(row.original.id, "selesai")}
                disabled={isPending}
              >
                <CheckCheck className="h-4 w-4" />
                Selesai
              </Button>
            ) : null}
          </div>
        ),
      },
    ];
  }, [isPending, todayKey]);

  function handleStatus(
    id: string,
    status: "dibaca" | "diproses" | "selesai",
  ) {
    startTransition(async () => {
      const now = new Date();
      const previousItems = localItems;
      setLocalItems((current) =>
        current.map((item) => {
          if (item.id !== id) return item;

          return {
            ...item,
            status,
            tanggalDibaca:
              status === "dibaca" && !item.tanggalDibaca ? now : item.tanggalDibaca,
            tanggalSelesai: status === "selesai" ? now : item.tanggalSelesai,
          };
        }),
      );

      const result = await updateStatusDisposisi({ id, status });
      if (!result.ok) {
        setLocalItems(previousItems);
        toast.error(result.error);
        return;
      }
      toast.success("Status disposisi diperbarui.");
      router.refresh();
    });
  }

  const unreadCount = localItems.filter(
    (item) => item.status === "belum_dibaca",
  ).length;
  const selesaiCount = localItems.filter(
    (item) => item.status === "selesai",
  ).length;
  const dueCount = localItems.filter(
    (item) =>
      !!item.batasWaktu &&
      item.batasWaktu <= todayKey &&
      item.status !== "selesai",
  ).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard
          label="Inbox"
          value={String(items.length)}
          hint="Total disposisi yang masuk ke akun Anda"
        />
        <SummaryCard
          label="Belum Dibaca"
          value={String(unreadCount)}
          hint="Perlu dibuka lebih dulu"
        />
        <SummaryCard
          label="Selesai"
          value={String(selesaiCount)}
          hint="Sudah dituntaskan"
        />
        <SummaryCard
          label="Jatuh Tempo"
          value={String(dueCount)}
          hint="Perlu prioritas hari ini"
        />
      </section>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Inbox Disposisi</CardTitle>
              <CardDescription className="mt-1">
                Buka instruksi masuk, tandai progres, dan selesaikan tindak
                lanjut langsung dari inbox pribadi.
              </CardDescription>
            </div>
            <Badge variant="outline" className="h-fit rounded-full px-3 py-1">
              {unreadCount} belum dibaca
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <FilterChip
              label={`Semua (${localItems.length})`}
              active={activeFilter === "semua"}
              onClick={() => setActiveFilter("semua")}
            />
            <FilterChip
              label={`Belum Dibaca (${unreadCount})`}
              active={activeFilter === "belum_dibaca"}
              onClick={() => setActiveFilter("belum_dibaca")}
            />
            <FilterChip
              label={`Diproses (${localItems.filter((item) => item.status === "diproses").length})`}
              active={activeFilter === "diproses"}
              onClick={() => setActiveFilter("diproses")}
            />
            <FilterChip
              label={`Selesai (${selesaiCount})`}
              active={activeFilter === "selesai"}
              onClick={() => setActiveFilter("selesai")}
            />
            <FilterChip
              label={`Jatuh Tempo (${dueCount})`}
              active={activeFilter === "deadline"}
              onClick={() => setActiveFilter("deadline")}
            />
          </div>
          <DataTable
            columns={columns}
            data={filteredItems}
            searchColumnId="surat"
            searchPlaceholder="Cari perihal disposisi..."
            emptyMessage="Tidak ada disposisi pada filter ini."
          />
          {isPending ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Memperbarui status disposisi...
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="rounded-[24px] py-5">
      <CardContent className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
