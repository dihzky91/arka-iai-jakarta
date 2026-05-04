"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  kelasOtomatisCreateSchema,
  type KelasOtomatisCreateInput,
} from "@/lib/validators/jadwalOtomatis.schema";
import { createKelasOtomatis } from "@/server/actions/jadwal-otomatis/kelasOtomatis";
import type { Program, ClassType } from "@/server/db/schema";

const defaultValues: KelasOtomatisCreateInput = {
  namaKelas: "",
  programId: "",
  classTypeId: "",
  mode: "offline",
  angkatan: undefined,
  certificateClassCode: "",
  startDate: "",
  lokasi: "",
  excludedDates: [],
};

interface FormBuatKelasOtomatisProps {
  programs: Program[];
  classTypes: ClassType[];
}

export function FormBuatKelasOtomatis({ programs, classTypes }: FormBuatKelasOtomatisProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [excludedDates, setExcludedDates] = useState<{ date: string; reason: string }[]>([]);
  const [excludeInput, setExcludeInput] = useState("");
  const [excludeReason, setExcludeReason] = useState("");

  const form = useForm<KelasOtomatisCreateInput>({
    resolver: zodResolver(kelasOtomatisCreateSchema),
    defaultValues,
  });

  const selectedProgramId = form.watch("programId");
  const selectedProgram = programs.find((p) => p.id === selectedProgramId);

  function addExcludedDate() {
    if (!excludeInput) return;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(excludeInput)) {
      toast.error("Format tanggal harus YYYY-MM-DD");
      return;
    }
    if (excludedDates.some((d) => d.date === excludeInput)) {
      toast.error("Tanggal sudah ditambahkan");
      return;
    }
    const entry = { date: excludeInput, reason: excludeReason.trim() };
    const updated = [...excludedDates, entry];
    setExcludedDates(updated);
    form.setValue("excludedDates", updated);
    setExcludeInput("");
    setExcludeReason("");
  }

  function removeExcludedDate(date: string) {
    const updated = excludedDates.filter((d) => d.date !== date);
    setExcludedDates(updated);
    form.setValue("excludedDates", updated);
  }

  function onSubmit(values: KelasOtomatisCreateInput) {
    startTransition(async () => {
      const res = await createKelasOtomatis(values);
      if (!res.ok) {
        toast.error("Gagal membuat kelas.");
        return;
      }
      toast.success("Kelas berhasil dibuat dengan jadwal otomatis.");
      router.push("/jadwal-otomatis");
    });
  }

  return (
    <Card className="rounded-[28px]">
      <CardHeader className="border-b border-border">
        <CardTitle>Form Kelas Baru</CardTitle>
        <CardDescription className="mt-1">
          Isi data kelas dan pilih program. Jadwal akan digenerate otomatis.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
            <FormField
              control={form.control}
              name="namaKelas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Kelas</FormLabel>
                  <FormControl>
                    <Input placeholder="mis. Brevet AB Reguler 2025-A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="programId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih program" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {programs.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProgram && (
                      <FormDescription>
                        {selectedProgram.totalSessions} sesi / {selectedProgram.totalMeetings} pertemuan
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="classTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipe Kelas</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih tipe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {classTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metode</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="offline">Offline (Tatap Muka)</SelectItem>
                      <SelectItem value="online">Online (Virtual)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="angkatan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Angkatan Sertifikat</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={100}
                        max={999}
                        placeholder="mis. 223"
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value ? Number(event.target.value) : undefined,
                          )
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>Dipakai untuk format nomor sertifikat.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="certificateClassCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode Kelas Sertifikat</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="01">01 - Kelas pagi</SelectItem>
                        <SelectItem value="02">02 - Kelas siang</SelectItem>
                        <SelectItem value="03">03 - Kelas sore / ekstra</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Online/offline tidak mengubah kode nomor.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal Mulai</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    Tanggal pertama kelas akan berlangsung.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lokasi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Lokasi <span className="text-muted-foreground font-normal">(opsional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="mis. Ruang 301, Gedung A" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Tanggal Eksklusi <span className="text-muted-foreground font-normal">(opsional)</span></FormLabel>
              <FormDescription>
                Tanggal-tanggal yang dilewati (libur nasional, hari besar, dll).
              </FormDescription>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={excludeInput}
                  onChange={(e) => setExcludeInput(e.target.value)}
                  className="w-44"
                />
                <Input
                  type="text"
                  value={excludeReason}
                  onChange={(e) => setExcludeReason(e.target.value)}
                  placeholder="Keterangan (opsional, mis. Libur Nasional)"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExcludedDate())}
                />
                <Button type="button" variant="outline" onClick={addExcludedDate}>
                  Tambah
                </Button>
              </div>
              {excludedDates.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {excludedDates.map(({ date, reason }) => (
                    <Badge key={date} variant="secondary" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {date}
                      {reason && <span className="text-muted-foreground">· {reason}</span>}
                      <button
                        type="button"
                        onClick={() => removeExcludedDate(date)}
                        className="ml-1 hover:text-destructive"
                      >
                        &times;
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </FormItem>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Membuat & Generate Jadwal..." : "Buat & Generate Jadwal"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/jadwal-otomatis")}
                disabled={isPending}
              >
                Batal
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
