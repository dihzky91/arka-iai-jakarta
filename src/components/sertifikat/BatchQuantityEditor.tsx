"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBatchQuantity } from "@/server/actions/sertifikat/nomor/batches";

// ─── Schema ───────────────────────────────────────────────────────────────────

const formSchema = z.object({
  newQuantity: z.coerce
    .number()
    .int("Harus bilangan bulat.")
    .min(1, "Minimal 1 sertifikat."),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface BatchQuantityEditorProps {
  open:            boolean;
  onOpenChange:    (v: boolean) => void;
  batchId:         string;
  currentQuantity: number;
  onSuccess:       () => void;
}

// ─── Komponen ─────────────────────────────────────────────────────────────────

export function BatchQuantityEditor({
  open,
  onOpenChange,
  batchId,
  currentQuantity,
  onSuccess,
}: BatchQuantityEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { newQuantity: currentQuantity },
  });

  const watchQty   = form.watch("newQuantity");
  const diff       = (watchQty || 0) - currentQuantity;
  const isDecrease = diff < 0;
  const isIncrease = diff > 0;
  const noChange   = diff === 0;

  function handleSubmit(values: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateBatchQuantity({
        batchId,
        newQuantity: values.newQuantity,
      });

      if (result.ok) {
        toast.success(
          isDecrease
            ? `${Math.abs(diff)} nomor berhasil dihapus dari batch.`
            : `${diff} nomor baru berhasil ditambahkan ke batch.`,
        );
        onOpenChange(false);
        onSuccess();
      } else {
        setServerError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setServerError(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Jumlah Batch</DialogTitle>
          <DialogDescription>
            Ubah jumlah sertifikat dalam batch ini. Pengurangan hanya diizinkan jika batch
            ini memiliki serial tertinggi (batch terakhir).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 py-2">
          {/* Info jumlah saat ini */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Jumlah saat ini</p>
            <p className="mt-1 text-2xl font-semibold">{currentQuantity}</p>
          </div>

          {/* Input jumlah baru */}
          <div className="space-y-1.5">
            <Label htmlFor="newQuantity">Jumlah Baru</Label>
            <Input
              id="newQuantity"
              type="number"
              min={1}
              {...form.register("newQuantity")}
            />
            {form.formState.errors.newQuantity?.message && (
              <p className="text-xs text-destructive">
                {form.formState.errors.newQuantity.message}
              </p>
            )}
          </div>

          {/* Preview perubahan */}
          {!noChange && watchQty > 0 && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                isIncrease
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {isIncrease ? (
                <p>
                  <strong>+{diff} nomor</strong> baru akan digenerate melanjutkan serial
                  global.
                </p>
              ) : (
                <p>
                  <strong>{Math.abs(diff)} nomor</strong> dari ekor batch akan dihapus
                  permanen.
                </p>
              )}
            </div>
          )}

          {/* Peringatan pengurangan */}
          {isDecrease && (
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Perhatian</p>
                <p>
                  Pengurangan hanya diizinkan untuk batch dengan serial tertinggi. Jika
                  batch ini bukan yang terakhir, server akan menolak permintaan ini.
                </p>
              </div>
            </div>
          )}

          {/* Error dari server */}
          {serverError && (
            <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>{serverError}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { onOpenChange(false); setServerError(null); }}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isPending || noChange}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
