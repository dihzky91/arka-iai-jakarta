"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ConflictBadge } from "./ConflictBadge";
import type { JadwalPengawasRow } from "@/server/actions/jadwal-ujian/penugasan";
import { APP_TIME_ZONE, parseIsoDateInJakarta } from "@/lib/utils";

interface JadwalPengawasViewProps {
  pengawasList: { id: string; nama: string }[];
  allPenugasan: JadwalPengawasRow[];
}

export function JadwalPengawasView({ pengawasList, allPenugasan }: JadwalPengawasViewProps) {
  const [filterPengawasId, setFilterPengawasId] = useState("__all__");
  const [filterTanggalMulai, setFilterTanggalMulai] = useState("");
  const [filterTanggalSelesai, setFilterTanggalSelesai] = useState("");

  const filteredData = useMemo(() => {
    return allPenugasan.filter((p) => {
      if (filterPengawasId !== "__all__" && p.pengawasId !== filterPengawasId) return false;
      if (filterTanggalMulai && p.tanggalUjian < filterTanggalMulai) return false;
      if (filterTanggalSelesai && p.tanggalUjian > filterTanggalSelesai) return false;
      return true;
    });
  }, [allPenugasan, filterPengawasId, filterTanggalMulai, filterTanggalSelesai]);

  const columns = useMemo<ColumnDef<JadwalPengawasRow>[]>(
    () => [
      {
        accessorKey: "tanggalUjian",
        header: "Tanggal",
        cell: ({ row }) => {
          const d = parseIsoDateInJakarta(row.original.tanggalUjian);
          return (
            <span className="tabular-nums text-sm whitespace-nowrap">
              {d.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                timeZone: APP_TIME_ZONE,
              })}
            </span>
          );
        },
      },
      {
        id: "jam",
        header: "Waktu",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground whitespace-nowrap">
            {row.original.jamMulai} – {row.original.jamSelesai}
          </span>
        ),
      },
      {
        accessorKey: "mataPelajaran",
        header: "Mata Pelajaran",
        cell: ({ row }) => <span className="font-medium">{row.original.mataPelajaran.join(" & ")}</span>,
      },
      {
        accessorKey: "namaKelas",
        header: "Kelas",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">{row.original.namaKelas}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.program} · {row.original.tipe}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "namaPengawas",
        header: "Pengawas",
        cell: ({ row }) => <span className="text-sm">{row.original.namaPengawas}</span>,
      },
      {
        accessorKey: "lokasi",
        header: "Lokasi",
        cell: ({ row }) =>
          row.original.lokasi ? (
            <span className="text-sm text-muted-foreground">{row.original.lokasi}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        accessorKey: "konflik",
        header: "Status",
        cell: ({ row }) =>
          row.original.konflik ? (
            <ConflictBadge />
          ) : (
            <Badge variant="outline" className="text-emerald-600 border-emerald-200">
              OK
            </Badge>
          ),
      },
    ],
    [],
  );

  return (
    <Card className="rounded-[28px]">
      <CardHeader className="border-b border-border">
        <CardTitle>Jadwal Pengawas</CardTitle>
        <CardDescription className="mt-1">
          Lihat jadwal penugasan semua pengawas. Filter berdasarkan nama pengawas atau periode.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterPengawasId} onValueChange={setFilterPengawasId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Semua Pengawas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua Pengawas</SelectItem>
              {pengawasList.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-37.5"
              value={filterTanggalMulai}
              onChange={(e) => setFilterTanggalMulai(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">s/d</span>
            <Input
              type="date"
              className="w-37.5"
              value={filterTanggalSelesai}
              onChange={(e) => setFilterTanggalSelesai(e.target.value)}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredData}
          searchColumnId="mataPelajaran"
          searchPlaceholder="Cari mata pelajaran..."
          emptyMessage="Tidak ada jadwal penugasan untuk filter ini."
        />
      </CardContent>
    </Card>
  );
}
