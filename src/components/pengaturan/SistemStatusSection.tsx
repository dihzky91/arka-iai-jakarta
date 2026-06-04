"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Database,
  HardDrive,
  Info,
  Mail,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { KonfigurasiSistemCard } from "./KonfigurasiSistemCard";
import { TestConnectionCard } from "./TestConnectionCard";
import { WhatsappBotStatusCard } from "./WhatsappBotStatusCard";
import type { SystemSettingsRow } from "@/server/actions/systemSettings";
import { WhatsappTemplateSettingsCard } from "./WhatsappTemplateSettingsCard";
import type { WhatsappTemplateRow } from "@/server/actions/jadwal-otomatis/whatsapp";

interface SistemStatusSectionProps {
  systemSettings: SystemSettingsRow;
  isAdmin: boolean;
  whatsappTemplates: WhatsappTemplateRow[];
}

type StatusTone = "ready" | "warning" | "neutral";

interface StatusItem {
  label: string;
  value: string;
  tone: StatusTone;
  detail?: string;
}

function normalizeStorageProvider(provider: string) {
  const normalized = provider.toLowerCase();
  if (normalized === "cloudinary" || normalized === "hosted" || normalized === "local") {
    return normalized;
  }
  return "local";
}

export function SistemStatusSection({
  systemSettings,
  isAdmin,
  whatsappTemplates,
}: SistemStatusSectionProps) {
  const [infraOpen, setInfraOpen] = useState(false);

  const storageProvider = normalizeStorageProvider(env.STORAGE_PROVIDER);
  const allowedMimeTypes = env.STORAGE_ALLOWED_MIME_TYPES.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const cloudinaryReady = Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  );
  const mailjetReady = Boolean(
    env.MAILJET_API_KEY &&
      env.MAILJET_API_SECRET &&
      env.MAILJET_FROM_EMAIL &&
      env.MAILJET_FROM_NAME,
  );
  const brevoReady = Boolean(
    env.BREVO_API_KEY && env.BREVO_FROM_EMAIL && env.BREVO_FROM_NAME,
  );

  const activeEmailProvider = systemSettings.emailProvider;
  const activeEmailReady = activeEmailProvider === "brevo" ? brevoReady : mailjetReady;
  const emailLabel = activeEmailProvider === "brevo" ? "Brevo" : "Mailjet";

  const storageItems: StatusItem[] = [
    {
      label: "Provider aktif",
      value: storageProvider,
      tone: storageProvider === "local" ? "neutral" : "ready",
      detail:
        storageProvider === "local"
          ? "Cocok untuk development dan operasional lokal terbatas."
          : "Pastikan sudah diuji end-to-end sebelum production.",
    },
    {
      label: "Batas ukuran file",
      value: `${env.STORAGE_MAX_FILE_MB} MB`,
      tone: "neutral",
    },
    {
      label: "Base URL publik",
      value: env.STORAGE_PUBLIC_BASE_URL || "-",
      tone: env.STORAGE_PUBLIC_BASE_URL ? "ready" : "warning",
    },
    {
      label: "Direktori lokal",
      value: env.STORAGE_LOCAL_DIR || "-",
      tone: storageProvider === "local" ? "ready" : "neutral",
    },
  ];

  const integrationItems: StatusItem[] = [
    {
      label: "Cloudinary",
      value: cloudinaryReady ? "Siap" : "Belum dikonfigurasi",
      tone: cloudinaryReady ? "ready" : "warning",
      detail:
        "Keputusan penggunaan Cloudinary tidak wajib menjadi blocker selama provider storage lain masih dipakai.",
    },
    {
      label: `Email ${emailLabel} (aktif)`,
      value: activeEmailReady ? "Siap" : "Belum lengkap",
      tone: activeEmailReady ? "ready" : "warning",
      detail: `Provider email aktif: ${emailLabel}. Dipakai untuk notifikasi disposisi dan komunikasi sistem.`,
    },
    {
      label: "Email Mailjet",
      value: mailjetReady ? "Siap" : "Belum dikonfigurasi",
      tone: mailjetReady ? "ready" : "neutral",
      detail: mailjetReady
        ? "Kredensial Mailjet lengkap."
        : "Env Mailjet belum lengkap. Tersedia sebagai opsi jika dikonfigurasi.",
    },
    {
      label: "Email Brevo",
      value: brevoReady ? "Siap" : "Belum dikonfigurasi",
      tone: brevoReady ? "ready" : "neutral",
      detail: brevoReady
        ? "Kredensial Brevo lengkap."
        : "Env Brevo belum lengkap. Tersedia sebagai opsi jika dikonfigurasi.",
    },
  ];

  const systemItems: StatusItem[] = [
    {
      label: "Environment",
      value: process.env.NODE_ENV || "development",
      tone: process.env.NODE_ENV === "production" ? "ready" : "neutral",
    },
    {
      label: "Timezone bisnis",
      value: "Asia/Jakarta",
      tone: "ready",
    },
    {
      label: "Database",
      value: env.DATABASE_URL ? "Tersedia" : "Belum dikonfigurasi",
      tone: env.DATABASE_URL ? "ready" : "warning",
    },
    {
      label: "Auth secret",
      value: env.BETTER_AUTH_SECRET ? "Tersedia" : "Belum dikonfigurasi",
      tone: env.BETTER_AUTH_SECRET ? "ready" : "warning",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Section 1: Actionable — Konfigurasi & Test */}
      <section className="grid gap-6 xl:grid-cols-2">
        <KonfigurasiSistemCard initial={systemSettings} isAdmin={isAdmin} />
        <TestConnectionCard isAdmin={isAdmin} emailProvider={systemSettings.emailProvider} />
      </section>

      {/* Section 2: WhatsApp */}
      <section>
        <WhatsappBotStatusCard
          enabled={systemSettings.whatsappBotEnabled}
          fonnteConfigured={Boolean(env.FONNTE_TOKEN)}
        />
      </section>

      <section>
        <WhatsappTemplateSettingsCard
          templates={whatsappTemplates}
          isAdmin={isAdmin}
        />
      </section>

      {/* Section 3: Status Infrastruktur — Collapsible */}
      <section>
        <div className="rounded-[24px] border border-border bg-card">
          <button
            type="button"
            onClick={() => setInfraOpen((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-muted/40 rounded-[24px]"
            aria-expanded={infraOpen}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Status Infrastruktur
                </p>
                <p className="text-xs text-muted-foreground">
                  Storage, integrasi eksternal, runtime — read-only dari environment.
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                infraOpen && "rotate-180",
              )}
            />
          </button>

          {infraOpen && (
            <div className="space-y-6 px-6 pb-6 pt-2">
              {/* Status cards grid */}
              <div className="grid gap-6 xl:grid-cols-2">
                <SettingsCard
                  icon={HardDrive}
                  title="Storage File"
                  description="Konfigurasi upload file untuk surat masuk, surat keluar, lampiran, dan file final."
                  items={storageItems}
                />
                <SettingsCard
                  icon={Mail}
                  title="Integrasi Eksternal"
                  description="Status provider tambahan. Nilai rahasia tidak ditampilkan di UI."
                  items={integrationItems}
                />
                <SettingsCard
                  icon={Database}
                  title="Sistem"
                  description="Status dasar runtime aplikasi dan komponen wajib server."
                  items={systemItems}
                />
              </div>

              {/* MIME types — inline */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Tipe File Diizinkan
                </p>
                <div className="flex flex-wrap gap-2">
                  {allowedMimeTypes.map((mimeType) => (
                    <Badge key={mimeType} variant="secondary" className="rounded-full">
                      {mimeType}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Inline info note — replaces "Catatan Pengelolaan" card */}
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/35 px-4 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Perubahan secret seperti database URL, auth secret, API key, dan API
                  secret tetap dilakukan melalui file environment atau panel hosting.
                  Jika Cloudinary belum diputuskan, sistem tetap bisa berjalan dengan
                  storage lokal.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  items,
}: {
  icon: typeof HardDrive;
  title: string;
  description: string;
  items: StatusItem[];
}) {
  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <StatusRow key={item.label} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}

function StatusRow({ item }: { item: StatusItem }) {
  const Icon = item.tone === "warning" ? TriangleAlert : CheckCircle2;
  return (
    <div className="rounded-2xl border border-border bg-muted/25 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{item.label}</p>
          {item.detail ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {item.detail}
            </p>
          ) : null}
        </div>
        <Badge
          variant="outline"
          className={cn(
            "w-fit gap-1.5 rounded-full",
            item.tone === "ready" && "border-emerald-200 bg-emerald-50 text-emerald-700",
            item.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
            item.tone === "neutral" && "border-border bg-background text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {item.value}
        </Badge>
      </div>
    </div>
  );
}
