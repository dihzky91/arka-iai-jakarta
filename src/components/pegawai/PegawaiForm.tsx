"use client";

import { useEffect, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pegawaiCreateSchema } from "@/lib/validators/pegawai.schema";
import {
  createPegawai,
  updatePegawai,
  type PegawaiListRow,
} from "@/server/actions/pegawai";

interface PegawaiFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: PegawaiListRow | null;
  divisiOptions: Array<{ id: number; nama: string }>;
}

const pegawaiFormSchema = z.object({
  namaLengkap: pegawaiCreateSchema.shape.namaLengkap,
  email: pegawaiCreateSchema.shape.email,
  emailPribadi: pegawaiCreateSchema.shape.emailPribadi,
  noHp: pegawaiCreateSchema.shape.noHp,
  role: pegawaiCreateSchema.shape.role,
  divisiId: z.string(),
  jabatan: pegawaiCreateSchema.shape.jabatan,
  levelJabatan: pegawaiCreateSchema.shape.levelJabatan,
  jenisPegawai: pegawaiCreateSchema.shape.jenisPegawai,
  tanggalMasuk: pegawaiCreateSchema.shape.tanggalMasuk,
  isActive: z.enum(["true", "false"]),
});

type PegawaiFormValues = z.infer<typeof pegawaiFormSchema>;

const ROLE_OPTIONS = ["admin", "staff", "pejabat", "viewer"] as const;
const JENIS_OPTIONS = ["Tetap", "Kontrak", "Magang", "Paruh Waktu"] as const;

export function PegawaiForm({
  open,
  onOpenChange,
  mode,
  initialData,
  divisiOptions,
}: PegawaiFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<PegawaiFormValues>({
    resolver: zodResolver(pegawaiFormSchema) as never,
    defaultValues: {
      namaLengkap: "",
      email: "",
      emailPribadi: "",
      noHp: "",
      role: "staff",
      divisiId: "0",
      jabatan: "",
      levelJabatan: "",
      jenisPegawai: "Tetap",
      tanggalMasuk: "",
      isActive: "true",
    },
  });

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && initialData) {
      form.reset({
        namaLengkap: initialData.namaLengkap,
        email: initialData.email,
        emailPribadi: initialData.emailPribadi ?? "",
        noHp: initialData.noHp ?? "",
        role: initialData.role ?? "staff",
        divisiId: initialData.divisiId ? String(initialData.divisiId) : "0",
        jabatan: initialData.jabatan ?? "",
        levelJabatan: initialData.levelJabatan ?? "",
        jenisPegawai: (initialData.jenisPegawai as PegawaiFormValues["jenisPegawai"]) ?? "Tetap",
        tanggalMasuk: initialData.tanggalMasuk ?? "",
        isActive: initialData.isActive === false ? "false" : "true",
      });
      return;
    }

    form.reset({
      namaLengkap: "",
      email: "",
      emailPribadi: "",
      noHp: "",
      role: "staff",
      divisiId: "0",
      jabatan: "",
      levelJabatan: "",
      jenisPegawai: "Tetap",
      tanggalMasuk: "",
      isActive: "true",
    });
  }, [open, mode, initialData, form]);

  function onSubmit(values: PegawaiFormValues) {
    startTransition(async () => {
      const payload = {
        ...values,
        emailPribadi: values.emailPribadi || undefined,
        noHp: values.noHp || undefined,
        jabatan: values.jabatan || undefined,
        levelJabatan: values.levelJabatan || undefined,
        tanggalMasuk: values.tanggalMasuk || undefined,
        divisiId:
          values.divisiId && values.divisiId !== "0"
            ? Number(values.divisiId)
            : undefined,
      };

      if (mode === "edit" && initialData) {
        const result = await updatePegawai({
          ...payload,
          id: initialData.id,
          isActive: values.isActive === "true",
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        toast.success("Data pegawai diperbarui.");
        onOpenChange(false);
        return;
      }

      try {
        const result = await createPegawai(payload);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        if (result.inviteSent) {
          toast.success("Pegawai dibuat. Email aktivasi telah dikirim.");
        } else {
          toast.warning(
            "Pegawai dibuat, namun email aktivasi gagal terkirim. Periksa konfigurasi email atau kirim ulang.",
          );
        }
        onOpenChange(false);
      } catch (error) {
        const message =
          error instanceof Error && error.message.includes("unique")
            ? "Email sudah digunakan."
            : error instanceof Error
              ? error.message
              : "Gagal menambahkan pegawai.";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Ubah Data Pegawai" : "Tambah Pegawai"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Perbarui data dasar pegawai untuk kebutuhan administrasi internal."
              : "Tambahkan data dasar pegawai. Kredensial login dapat dikelola terpisah sesuai konfigurasi auth yang digunakan."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="pegawai-form" className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="namaLengkap"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Nama Lengkap</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="Nama pegawai" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Kantor</FormLabel>
                  <FormControl>
                    <Input placeholder="nama@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emailPribadi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Pribadi</FormLabel>
                  <FormControl>
                    <Input placeholder="opsional" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="noHp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>No. HP</FormLabel>
                  <FormControl>
                    <Input placeholder="08xxxxxxxxxx" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jabatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jabatan</FormLabel>
                  <FormControl>
                    <Input placeholder="Mis. Staf Administrasi" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="levelJabatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Level Jabatan</FormLabel>
                  <FormControl>
                    <Input placeholder="Mis. Senior Staff" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tanggalMasuk"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal Masuk</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jenisPegawai"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jenis Pegawai</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "Tetap"}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih jenis pegawai" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {JENIS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="divisiId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Divisi</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Belum dipilih" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Tanpa divisi</SelectItem>
                      {divisiOptions.map((option) => (
                        <SelectItem key={option.id} value={String(option.id)}>
                          {option.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "edit" ? (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status Akun</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">Aktif</SelectItem>
                        <SelectItem value="false">Nonaktif</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </form>
        </Form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button type="submit" form="pegawai-form" disabled={isPending}>
            {isPending ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
