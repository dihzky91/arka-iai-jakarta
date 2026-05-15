"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
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
import { createInstructor } from "@/server/actions/jadwal-otomatis/instructors";

const expertiseLevelOptions = [
  { value: "basic", label: "Basic" },
  { value: "middle", label: "Middle" },
  { value: "senior", label: "Senior" },
] as const;

const schema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(200),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  expertise: z
    .array(
      z.object({
        programId: z.string().min(1, "Program wajib dipilih"),
        materiBlock: z.string().trim().min(1, "Blok materi wajib dipilih").max(100),
        level: z.enum(["basic", "middle", "senior"]),
      }),
    )
    .min(1, "Minimal satu keahlian wajib diisi"),
});

type ProgramOption = {
  id: string;
  name: string;
};

type ProgramBlockOption = {
  programId: string;
  materiBlock: string;
};

interface FormBuatInstrukturProps {
  programs: ProgramOption[];
  programBlocks: ProgramBlockOption[];
}

export function FormBuatInstruktur({ programs, programBlocks }: FormBuatInstrukturProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      expertise: [{ programId: "", materiBlock: "", level: "middle" }],
    },
  });

  const expertiseFieldArray = useFieldArray({
    control: form.control,
    name: "expertise",
  });

  function onSubmit(values: z.infer<typeof schema>) {
    start(async () => {
      const result = await createInstructor(values);
      if (!result.ok) {
        toast.error("Gagal menyimpan instruktur.");
        return;
      }

      toast.success("Instruktur ditambahkan.");
      router.push("/jadwal-otomatis/instruktur");
    });
  }

  return (
    <Card className="rounded-[24px] max-w-4xl">
      <CardHeader>
        <CardTitle>Form Instruktur</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl>
                      <Input placeholder="Nama instruktur" {...field} />
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
                    <FormLabel>
                      Email <span className="text-muted-foreground">(opsional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Telepon <span className="text-muted-foreground">(opsional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="08xxxxxxxxxx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Keahlian</p>
                  <p className="text-xs text-muted-foreground">
                    Minimal satu keahlian untuk rekomendasi alokasi.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    expertiseFieldArray.append({
                      programId: "",
                      materiBlock: "",
                      level: "middle",
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Tambah Keahlian
                </Button>
              </div>

              {expertiseFieldArray.fields.map((row, index) => {
                const selectedProgramId = form.watch(`expertise.${index}.programId`);
                const blockOptions = programBlocks.filter(
                  (block) => block.programId === selectedProgramId,
                );

                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-border p-3 grid gap-3 md:grid-cols-3"
                  >
                    <FormField
                      control={form.control}
                      name={`expertise.${index}.programId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Program</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue(`expertise.${index}.materiBlock`, "");
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih program" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {programs.map((program) => (
                                <SelectItem key={program.id} value={program.id}>
                                  {program.name}
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
                      name={`expertise.${index}.materiBlock`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Blok Materi</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!selectedProgramId}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih blok materi" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {blockOptions.map((block) => (
                                <SelectItem
                                  key={`${block.programId}-${block.materiBlock}`}
                                  value={block.materiBlock}
                                >
                                  {block.materiBlock}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-3 grid-cols-[1fr_auto] items-end">
                      <FormField
                        control={form.control}
                        name={`expertise.${index}.level`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Level</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {expertiseLevelOptions.map((levelOption) => (
                                  <SelectItem key={levelOption.value} value={levelOption.value}>
                                    {levelOption.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (expertiseFieldArray.fields.length === 1) return;
                          expertiseFieldArray.remove(index);
                        }}
                        disabled={expertiseFieldArray.fields.length === 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {form.formState.errors.expertise?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.expertise.message}
                </p>
              ) : null}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={pending}
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
