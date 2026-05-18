"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ClipboardList } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listResponses } from "@/server/actions/ppl-evaluasi/responses";
import type {
  PaginatedResult,
  ResponseRow,
} from "@/server/actions/ppl-evaluasi/types";

interface ResponsesListClientProps {
  kegiatanId: number;
  initialData: PaginatedResult<ResponseRow>;
}

export function ResponsesListClient({
  kegiatanId,
  initialData,
}: ResponsesListClientProps) {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const fetchData = useCallback(
    (newPage: number) => {
      startTransition(async () => {
        const result = await listResponses(kegiatanId, {
          page: newPage,
          pageSize: 10,
        });
        setData(result);
      });
    },
    [kegiatanId],
  );

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchData(newPage);
  }

  const columns = useMemo<ColumnDef<ResponseRow>[]>(
    () => [
      {
        accessorKey: "namaResponden",
        header: "Nama Responden",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.namaResponden}</span>
        ),
      },
      {
        accessorKey: "emailResponden",
        header: "Email Responden",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.emailResponden}
          </span>
        ),
      },
      {
        accessorKey: "submittedAt",
        header: "Tanggal Submit",
        cell: ({ row }) => {
          const date = row.original.submittedAt;
          try {
            return (
              <span className="text-sm">
                {format(new Date(date), "d MMM yyyy, HH:mm", {
                  locale: localeId,
                })}
              </span>
            );
          } catch {
            return <span className="text-sm">-</span>;
          }
        },
      },
    ],
    [],
  );

  return (
    <Card className="rounded-[24px]">
      <CardHeader className="border-b border-border/60">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Daftar Responses</CardTitle>
            <CardDescription className="mt-1">
              {data.total} responden telah mengisi kuesioner evaluasi.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Table */}
          <div className={isPending ? "opacity-60 pointer-events-none" : ""}>
            <DataTable
              columns={columns}
              data={data.data}
              emptyMessage="Belum ada respons untuk kegiatan ini."
              pageSize={data.pageSize}
            />
          </div>

          {/* Server-side Pagination */}
          {data.totalPages > 1 && (
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted-foreground">
                {data.total} respons · Halaman {data.page} / {data.totalPages}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1 || isPending}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= data.totalPages || isPending}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
