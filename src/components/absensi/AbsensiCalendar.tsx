"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { id } from "date-fns/locale";
import { CalendarDays, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listAbsensiKaryawan,
  type AbsensiRow,
} from "@/server/actions/absensi";
import { parseIsoDateInJakarta } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  hadir: "bg-green-100 text-green-800",
  terlambat: "bg-yellow-100 text-yellow-800",
  alpha: "bg-red-100 text-red-800",
  cuti: "bg-blue-100 text-blue-800",
  sakit: "bg-purple-100 text-purple-800",
  izin: "bg-gray-100 text-gray-800",
  dinas_luar: "bg-indigo-100 text-indigo-800",
};

const STATUS_LABEL: Record<string, string> = {
  hadir: "Hadir",
  terlambat: "Terlambat",
  alpha: "Alpha",
  cuti: "Cuti",
  sakit: "Sakit",
  izin: "Izin",
  dinas_luar: "Dinas Luar",
};

export function AbsensiCalendar({
  viewMode = "table",
  userId,
}: {
  viewMode?: "table" | "calendar";
  userId?: string;
}) {
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<AbsensiRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const from = format(startOfMonth(month), "yyyy-MM-dd");
      const to = format(endOfMonth(month), "yyyy-MM-dd");
      const res = await listAbsensiKaryawan({
        tanggalMulai: from,
        tanggalSelesai: to,
        userId,
        pageSize: 500,
      });
      setData(res.rows);
    } finally {
      setLoading(false);
    }
  }, [month, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (viewMode === "calendar") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1))
            }
          >
            &larr; Sebelumnya
          </Button>
          <span className="font-semibold capitalize">
            {format(month, "MMMM yyyy", { locale: id })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1))
            }
          >
            Berikutnya &rarr;
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
            <div key={d} className="py-2 text-muted-foreground font-medium">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const absen = data.find((r) =>
              isSameDay(parseIsoDateInJakarta(r.tanggal), day),
            );
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`p-2 border rounded-lg min-h-[60px] ${
                  isToday ? "border-primary" : "border-border"
                }`}
              >
                <div className="text-xs font-medium mb-1">
                  {format(day, "d")}
                </div>
                {absen && (
                  <Badge className={`text-[10px] px-1 py-0 ${STATUS_BADGE[absen.status] ?? ""}`}>
                    {STATUS_LABEL[absen.status] ?? absen.status}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1))
            }
          >
            &larr;
          </Button>
          <span className="font-semibold self-center">
            {format(month, "MMMM yyyy", { locale: id })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1))
            }
          >
            &rarr;
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Nama</TableHead>
            <TableHead>Jam Masuk</TableHead>
            <TableHead>Jam Pulang</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Keterlambatan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Belum ada data absensi.
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.tanggal}</TableCell>
                <TableCell>
                  {row.namaUser ?? row.dingtalkNama ?? "-"}
                  {!row.userId && (
                    <span className="ml-1 text-xs text-muted-foreground">(DingTalk)</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.jamMasuk
                    ? format(new Date(row.jamMasuk), "HH:mm")
                    : "-"}
                </TableCell>
                <TableCell>
                  {row.jamPulang
                    ? format(new Date(row.jamPulang), "HH:mm")
                    : "-"}
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_BADGE[row.status] ?? ""}>
                    {STATUS_LABEL[row.status] ?? row.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.keterlambatanMenit
                    ? `${row.keterlambatanMenit} mnt`
                    : "-"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
