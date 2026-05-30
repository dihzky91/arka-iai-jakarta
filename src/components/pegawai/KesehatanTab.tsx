"use client";

import { useEffect, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { kesehatanSchema, type KesehatanInput } from "@/lib/validators/pegawai.schema";
import { getKesehatan, upsertKesehatan } from "@/server/actions/pegawai";

const GOLONGAN_DARAH_OPTIONS = ["A", "B", "AB", "O", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function KesehatanTab({
  userId,
  canEdit,
}: {
  userId: string;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<KesehatanInput>({
    resolver: zodResolver(kesehatanSchema),
    defaultValues: {
      userId,
      golonganDarah: undefined,
      tinggiBadan: undefined,
      beratBadan: undefined,
      riwayatPenyakit: "",
      alergi: "",
      catatanKesehatan: "",
    },
  });

  useEffect(() => {
    getKesehatan(userId).then((data) => {
      if (data) {
        form.reset({
          userId,
          golonganDarah: data.golonganDarah ?? undefined,
          tinggiBadan: data.tinggiBadan ?? undefined,
          beratBadan: data.beratBadan ?? undefined,
          riwayatPenyakit: data.riwayatPenyakit ?? "",
          alergi: data.alergi ?? "",
          catatanKesehatan: data.catatanKesehatan ?? "",
        });
      }
    });
  }, [userId, form]);

  function onSubmit(values: KesehatanInput) {
    startTransition(async () => {
      try {
        await upsertKesehatan({
          ...values,
          golonganDarah: values.golonganDarah || undefined,
          riwayatPenyakit: values.riwayatPenyakit || undefined,
          alergi: values.alergi || undefined,
          catatanKesehatan: values.catatanKesehatan || undefined,
        });
        toast.success("Data kesehatan diperbarui.");
      } catch {
        toast.error("Gagal menyimpan data kesehatan.");
      }
    });
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField control={form.control} name="golonganDarah" render={({ field }) => (
            <FormItem>
              <FormLabel>Golongan Darah</FormLabel>
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => field.onChange(value || undefined)}
                disabled={!canEdit || isPending}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {GOLONGAN_DARAH_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="tinggiBadan" render={({ field }) => (
            <FormItem>
              <FormLabel>Tinggi Badan (cm)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={300}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  disabled={!canEdit || isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="beratBadan" render={({ field }) => (
            <FormItem>
              <FormLabel>Berat Badan (kg)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={500}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  disabled={!canEdit || isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="riwayatPenyakit" render={({ field }) => (
          <FormItem>
            <FormLabel>Riwayat Penyakit</FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} value={field.value ?? ""} disabled={!canEdit || isPending} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="alergi" render={({ field }) => (
          <FormItem>
            <FormLabel>Alergi</FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} value={field.value ?? ""} disabled={!canEdit || isPending} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="catatanKesehatan" render={({ field }) => (
          <FormItem>
            <FormLabel>Catatan Kesehatan</FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} value={field.value ?? ""} disabled={!canEdit || isPending} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {canEdit ? (
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan Data Kesehatan"}
            </Button>
          </div>
        ) : null}
      </form>
    </Form>
  );
}
