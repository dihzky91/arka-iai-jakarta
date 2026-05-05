import {
  CheckCircle2,
  Cloud,
  Database,
  HardDrive,
  Info,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
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
      label: "Email Mailjet",
      value: mailjetReady ? "Siap" : "Belum lengkap",
      tone: mailjetReady ? "ready" : "warning",
      detail: "Dipakai untuk notifikasi disposisi dan komunikasi sistem.",
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
      <section className="grid gap-6 xl:grid-cols-2">
        <KonfigurasiSistemCard initial={systemSettings} isAdmin={isAdmin} />
        <TestConnectionCard isAdmin={isAdmin} />
      </section>

      <section>
        <WhatsappTemplateSettingsCard
          templates={whatsappTemplates}
          isAdmin={isAdmin}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          icon={HardDrive}
          label="Storage"
          value={storageProvider}
          status={
            storageProvider === "local" ? "Development ready" : "Provider eksternal"
          }
        />
        <SummaryCard
          icon={Cloud}
          label="Cloudinary"
          value={cloudinaryReady ? "Siap" : "Opsional"}
          status={cloudinaryReady ? "Env lengkap" : "Belum diputuskan"}
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Hardening"
          value="Hardening"
          status="Polish, deploy, RBAC, dan E2E"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
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
        <Card className="rounded-[24px]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Catatan Pengelolaan</CardTitle>
                <CardDescription>
                  Batas aman antara pengaturan UI dan konfigurasi server.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl border border-border bg-muted/35 p-4">
              Provider, batas file, dan status integrasi bisa dipantau di sini.
              Perubahan secret seperti database URL, auth secret, API key, dan API
              secret tetap dilakukan melalui file environment atau panel hosting.
            </div>
            <div className="rounded-2xl border border-border bg-muted/35 p-4">
              Jika Cloudinary belum diputuskan, sistem tetap bisa berjalan dengan
              storage lokal selama skenario upload sudah tervalidasi untuk kebutuhan
              operasional.
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[24px]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Tipe File Diizinkan</CardTitle>
              <CardDescription>
                MIME type yang diterima validator upload saat ini.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {allowedMimeTypes.map((mimeType) => (
              <Badge key={mimeType} variant="secondary" className="rounded-full">
                {mimeType}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: typeof HardDrive;
  label: string;
  value: string;
  status: string;
}) {
  return (
    <Card className="gap-4 rounded-[24px]">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold text-foreground sm:text-3xl">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{status}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-11 sm:w-11">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
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
