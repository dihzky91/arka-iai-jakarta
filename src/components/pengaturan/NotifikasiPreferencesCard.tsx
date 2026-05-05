"use client";

import { useState, useTransition } from "react";
import { Bell, Loader2, Mail } from "lucide-react";
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
import {
  updateMyNotificationPreferences,
  type NotificationPreferencesRow,
} from "@/server/actions/notificationPreferences";

interface Props {
  initial: NotificationPreferencesRow;
}

const NOTIFICATION_TYPES: Array<{
  key: string;
  label: string;
  description: string;
  inAppField: keyof NotificationPreferencesRow;
  emailField: keyof NotificationPreferencesRow;
}> = [
  {
    key: "disposisi_baru",
    label: "Disposisi Baru",
    description: "Saat Anda menerima disposisi baru.",
    inAppField: "inAppDisposisiBaru",
    emailField: "emailDisposisiBaru",
  },
  {
    key: "disposisi_deadline",
    label: "Pengingat Deadline Disposisi",
    description: "Pengingat sebelum batas waktu disposisi.",
    inAppField: "inAppDisposisiDeadline",
    emailField: "emailDisposisiDeadline",
  },
  {
    key: "surat_keluar_approval",
    label: "Permintaan Persetujuan Surat Keluar",
    description: "Saat ada surat keluar menunggu persetujuan Anda.",
    inAppField: "inAppSuratKeluarApproval",
    emailField: "emailSuratKeluarApproval",
  },
  {
    key: "surat_keluar_revisi",
    label: "Surat Keluar Direvisi",
    description: "Saat surat keluar yang Anda buat butuh revisi.",
    inAppField: "inAppSuratKeluarRevisi",
    emailField: "emailSuratKeluarRevisi",
  },
  {
    key: "surat_keluar_selesai",
    label: "Surat Keluar Selesai",
    description: "Saat surat keluar Anda selesai diarsipkan.",
    inAppField: "inAppSuratKeluarSelesai",
    emailField: "emailSuratKeluarSelesai",
  },
  {
    key: "surat_masuk_baru",
    label: "Surat Masuk Baru",
    description: "Saat ada surat masuk baru di unit Anda.",
    inAppField: "inAppSuratMasukBaru",
    emailField: "emailSuratMasukBaru",
  },
  {
    key: "project_invitation",
    label: "Undangan Project",
    description: "Saat Anda ditambahkan sebagai anggota project.",
    inAppField: "inAppProjectInvitation",
    emailField: "emailProjectInvitation",
  },
  {
    key: "mention",
    label: "Mention Project",
    description: "Saat nama Anda disebut dalam komentar project.",
    inAppField: "inAppProjectMention",
    emailField: "emailProjectMention",
  },
  {
    key: "project_update",
    label: "Update Project",
    description: "Saat ada pembaruan penting pada project Anda.",
    inAppField: "inAppProjectUpdate",
    emailField: "emailProjectUpdate",
  },
  {
    key: "honorarium_status",
    label: "Status Honorarium",
    description: "Saat batch honorarium berubah status.",
    inAppField: "inAppHonorariumStatus",
    emailField: "emailHonorariumStatus",
  },
  {
    key: "system",
    label: "Sistem",
    description: "Notifikasi operasional umum dari sistem.",
    inAppField: "inAppSystem",
    emailField: "emailSystem",
  },
];

export function NotifikasiPreferencesCard({ initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<NotificationPreferencesRow>(initial);

  function setField<K extends keyof NotificationPreferencesRow>(
    key: K,
    value: NotificationPreferencesRow[K],
  ) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateMyNotificationPreferences({
        inAppDisposisiBaru: state.inAppDisposisiBaru,
        inAppDisposisiDeadline: state.inAppDisposisiDeadline,
        inAppSuratKeluarApproval: state.inAppSuratKeluarApproval,
        inAppSuratKeluarRevisi: state.inAppSuratKeluarRevisi,
        inAppSuratKeluarSelesai: state.inAppSuratKeluarSelesai,
        inAppSuratMasukBaru: state.inAppSuratMasukBaru,
        inAppProjectInvitation: state.inAppProjectInvitation,
        inAppProjectMention: state.inAppProjectMention,
        inAppProjectUpdate: state.inAppProjectUpdate,
        inAppHonorariumStatus: state.inAppHonorariumStatus,
        inAppSystem: state.inAppSystem,
        emailDisposisiBaru: state.emailDisposisiBaru,
        emailDisposisiDeadline: state.emailDisposisiDeadline,
        emailSuratKeluarApproval: state.emailSuratKeluarApproval,
        emailSuratKeluarRevisi: state.emailSuratKeluarRevisi,
        emailSuratKeluarSelesai: state.emailSuratKeluarSelesai,
        emailSuratMasukBaru: state.emailSuratMasukBaru,
        emailProjectInvitation: state.emailProjectInvitation,
        emailProjectMention: state.emailProjectMention,
        emailProjectUpdate: state.emailProjectUpdate,
        emailHonorariumStatus: state.emailHonorariumStatus,
        emailSystem: state.emailSystem,
        deadlineReminderDays: state.deadlineReminderDays,
      });
      if (result.ok) {
        toast.success("Preferensi notifikasi berhasil disimpan.");
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
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Preferensi Notifikasi</CardTitle>
            <CardDescription>
              Atur jenis notifikasi yang Anda terima di aplikasi maupun email.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header row */}
          <div className="hidden grid-cols-[1fr_auto_auto] items-center gap-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
            <div>Jenis Notifikasi</div>
            <div className="flex w-20 items-center justify-center gap-1.5">
              <Bell className="h-3.5 w-3.5" /> In-App
            </div>
            <div className="flex w-20 items-center justify-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email
            </div>
          </div>

          <div className="space-y-3">
            {NOTIFICATION_TYPES.map((item) => (
              <div
                key={item.key}
                className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-muted/25 px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Toggle
                  label="In-App"
                  checked={Boolean(state[item.inAppField])}
                  onChange={(v) => setField(item.inAppField, v as never)}
                />
                <Toggle
                  label="Email"
                  checked={Boolean(state[item.emailField])}
                  onChange={(v) => setField(item.emailField, v as never)}
                />
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="deadlineReminderDays">
              Pengingat Deadline Disposisi (hari sebelum)
            </Label>
            <Input
              id="deadlineReminderDays"
              type="number"
              min={0}
              max={30}
              value={state.deadlineReminderDays}
              onChange={(e) =>
                setField(
                  "deadlineReminderDays",
                  Math.max(0, Math.min(30, Number(e.target.value) || 0)) as never,
                )
              }
              className="w-full max-w-[180px]"
            />
            <p className="text-xs text-muted-foreground">
              Berapa hari sebelum deadline disposisi Anda mendapat pengingat. Atur 0
              untuk menonaktifkan.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Preferensi
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex w-full cursor-pointer items-center justify-between gap-2 sm:w-20 sm:justify-center">
      <span className="text-xs text-muted-foreground sm:hidden">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/25"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
