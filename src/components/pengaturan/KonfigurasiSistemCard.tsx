"use client";

import { useState, useTransition } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { SystemSettingsRow } from "@/server/actions/systemSettings";
import { updateSystemConfig } from "@/server/actions/systemConfig";

interface Props {
  initial: SystemSettingsRow;
  isAdmin: boolean;
}

export function KonfigurasiSistemCard({ initial, isAdmin }: Props) {
  const [isPending, startTransition] = useTransition();
  const [defaultDeadline, setDefaultDeadline] = useState(
    initial.defaultDisposisiDeadlineDays,
  );
  const [emailEnabled, setEmailEnabled] = useState(initial.notificationEmailEnabled);
  const [financeContactName, setFinanceContactName] = useState(initial.financeContactName ?? "");
  const [financeWhatsappNumber, setFinanceWhatsappNumber] = useState(
    initial.financeWhatsappNumber ?? "",
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateSystemConfig({
        defaultDisposisiDeadlineDays: defaultDeadline,
        notificationEmailEnabled: emailEnabled,
        financeContactName: financeContactName.trim() || null,
        financeWhatsappNumber: financeWhatsappNumber.trim() || null,
      });
      if (result.ok) {
        toast.success("Konfigurasi sistem berhasil disimpan.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Konfigurasi Aplikasi</CardTitle>
            <CardDescription>
              Preferensi runtime non-secret yang dapat diubah dari UI.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isAdmin ? (
          <div className="rounded-2xl border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
            Hanya admin yang dapat mengubah konfigurasi aplikasi.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="defaultDeadline">
                Default Deadline Disposisi (hari)
              </Label>
              <Input
                id="defaultDeadline"
                type="number"
                min={0}
                max={365}
                value={defaultDeadline}
                onChange={(e) =>
                  setDefaultDeadline(
                    Math.max(0, Math.min(365, Number(e.target.value) || 0)),
                  )
                }
                className="w-full max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Jumlah hari default yang disarankan saat membuat disposisi tanpa
                batas waktu eksplisit. Set 0 untuk menonaktifkan saran.
              </p>
            </div>

            <Separator />

            <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
              <div>
                <Label className="text-sm font-medium">
                  Kontak Keuangan Global (WhatsApp)
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dipakai sebagai fallback terakhir untuk reminder pengajuan honorarium.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="financeContactName">Nama Kontak</Label>
                  <Input
                    id="financeContactName"
                    value={financeContactName}
                    onChange={(event) => setFinanceContactName(event.target.value)}
                    placeholder="Mis. Tim Keuangan Pusat"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="financeWhatsappNumber">Nomor WhatsApp</Label>
                  <Input
                    id="financeWhatsappNumber"
                    value={financeWhatsappNumber}
                    onChange={(event) => setFinanceWhatsappNumber(event.target.value)}
                    placeholder="Mis. 6281234567890"
                    maxLength={30}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/25 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Label className="text-sm font-medium">
                  Notifikasi Email Global
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Kill switch untuk menghentikan semua pengiriman email
                  notifikasi sistem-wide. User-level preference tetap dihormati.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailEnabled}
                onClick={() => setEmailEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  emailEnabled ? "bg-primary" : "bg-muted-foreground/25"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    emailEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Konfigurasi
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
