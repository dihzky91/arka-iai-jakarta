"use server";

import { access } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { revalidatePath, unstable_cache, updateTag } from "next/cache";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { systemSettings, auditLog } from "@/server/db/schema";
import { systemSettingsUpdateSchema } from "@/lib/validators/systemSettings.schema";
import { APP_BRAND_NAME } from "@/lib/branding";
import { getCurrentUserAccess, requirePermission, getSession } from "./auth";
import { getStorageProvider } from "@/lib/storage";
import { env } from "@/lib/env";
import { enforceUploadRateLimit } from "@/lib/rate-limit/upload-guard";

export type SystemSettingsRow = {
  id: number;
  namaSistem: string;
  singkatan: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  financeContactName: string | null;
  financeWhatsappNumber: string | null;
  defaultDisposisiDeadlineDays: number;
  notificationEmailEnabled: boolean;
  whatsappBotEnabled: boolean;
  emailProvider: "mailjet" | "brevo";
  prefixOrganisasi: string;
  updatedAt: Date | null;
};

const FALLBACK: SystemSettingsRow = {
  id: 0,
  namaSistem: process.env.NEXT_PUBLIC_APP_NAME ?? APP_BRAND_NAME,
  singkatan: null,
  logoUrl: "/iai-logo.png",
  faviconUrl: null,
  financeContactName: null,
  financeWhatsappNumber: null,
  defaultDisposisiDeadlineDays: 7,
  notificationEmailEnabled: true,
  whatsappBotEnabled: false,
  emailProvider: "mailjet",
  prefixOrganisasi: "IAI-DKIJKT",
  updatedAt: null,
};

async function resolveExistingLocalAssetUrl(
  url: string | null,
  fallbackUrl: string | null,
) {
  if (!url || env.STORAGE_PROVIDER !== "local") return url;

  const publicBaseUrl = (env.STORAGE_PUBLIC_BASE_URL || "/api/files").replace(
    /\/$/,
    "",
  );
  if (!url.startsWith(`${publicBaseUrl}/`)) return url;

  const key = url.slice(publicBaseUrl.length + 1);
  const segments = key.split("/").map((segment) => decodeURIComponent(segment));
  if (
    !segments.length ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\0"),
    )
  ) {
    return fallbackUrl;
  }

  const baseDir = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);
  const candidate = path.resolve(baseDir, ...segments);
  const baseWithSep = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
  if (candidate !== baseDir && !candidate.startsWith(baseWithSep)) {
    return fallbackUrl;
  }

  try {
    await access(candidate);
    return url;
  } catch {
    return fallbackUrl;
  }
}

async function withResolvedAssetUrls(
  settings: SystemSettingsRow,
): Promise<SystemSettingsRow> {
  return {
    ...settings,
    logoUrl: await resolveExistingLocalAssetUrl(
      settings.logoUrl,
      FALLBACK.logoUrl,
    ),
    faviconUrl: await resolveExistingLocalAssetUrl(settings.faviconUrl, null),
  };
}

// cache() deduplicates DB calls within a single request
// (dipakai di root layout + dashboard layout sekaligus)
export const getSystemSettings = cache(async (): Promise<SystemSettingsRow> => {
  return cachedSystemSettingsInternal();
});

// unstable_cache provides cross-request caching (revalidates every 300s or on tag)
const cachedSystemSettingsInternal = unstable_cache(
  async () => {
    try {
      const rows = await db
        .select({
          id: systemSettings.id,
          namaSistem: systemSettings.namaSistem,
          singkatan: systemSettings.singkatan,
          logoUrl: systemSettings.logoUrl,
          faviconUrl: systemSettings.faviconUrl,
          financeContactName: systemSettings.financeContactName,
          financeWhatsappNumber: systemSettings.financeWhatsappNumber,
          defaultDisposisiDeadlineDays:
            systemSettings.defaultDisposisiDeadlineDays,
          notificationEmailEnabled: systemSettings.notificationEmailEnabled,
          whatsappBotEnabled: systemSettings.whatsappBotEnabled,
          emailProvider: systemSettings.emailProvider,
          prefixOrganisasi: systemSettings.prefixOrganisasi,
          updatedAt: systemSettings.updatedAt,
        })
        .from(systemSettings)
        .limit(1);
      const settings = rows[0] ?? FALLBACK;
      return withResolvedAssetUrls({
        ...settings,
        namaSistem:
          settings.namaSistem === "IAI Jakarta"
            ? APP_BRAND_NAME
            : settings.namaSistem,
      });
    } catch {
      return FALLBACK;
    }
  },
  ["system-settings"],
  { revalidate: 300 },
);

const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];
const ALLOWED_FAVICON_TYPES = [
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/png",
  "image/svg+xml",
];

export async function updateSystemSettings(formData: FormData) {
  const session = await requirePermission("pengaturan", "update");

  const parsed = systemSettingsUpdateSchema.parse({
    namaSistem: formData.get("namaSistem"),
    singkatan: formData.get("singkatan"),
  });

  const storage = getStorageProvider();
  const maxBytes = env.STORAGE_MAX_FILE_MB * 1024 * 1024;

  let logoUrl: string | undefined;
  let faviconUrl: string | undefined;

  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile.size > 0) {
    enforceUploadRateLimit(session.user.id);
    if (!ALLOWED_LOGO_TYPES.includes(logoFile.type)) {
      return {
        ok: false as const,
        error: "Format logo tidak didukung. Gunakan PNG, JPG, WebP, atau SVG.",
      };
    }
    if (logoFile.size > maxBytes) {
      return {
        ok: false as const,
        error: `Logo melebihi batas ${env.STORAGE_MAX_FILE_MB} MB.`,
      };
    }
    const result = await storage.upload({
      body: Buffer.from(await logoFile.arrayBuffer()),
      fileName: logoFile.name,
      contentType: logoFile.type,
      folder: "system-identity",
      publicId: "logo",
    });
    logoUrl = result.url;
  }

  const faviconFile = formData.get("favicon") as File | null;
  if (faviconFile && faviconFile.size > 0) {
    enforceUploadRateLimit(session.user.id);
    if (!ALLOWED_FAVICON_TYPES.includes(faviconFile.type)) {
      return {
        ok: false as const,
        error: "Format favicon tidak didukung. Gunakan ICO, PNG, atau SVG.",
      };
    }
    if (faviconFile.size > maxBytes) {
      return {
        ok: false as const,
        error: `Favicon melebihi batas ${env.STORAGE_MAX_FILE_MB} MB.`,
      };
    }
    const result = await storage.upload({
      body: Buffer.from(await faviconFile.arrayBuffer()),
      fileName: faviconFile.name,
      contentType: faviconFile.type,
      folder: "system-identity",
      publicId: "favicon",
    });
    faviconUrl = result.url;
  }

  const updates = {
    namaSistem: parsed.namaSistem,
    singkatan: parsed.singkatan || null,
    updatedBy: session.user.id,
    updatedAt: new Date(),
    ...(logoUrl !== undefined && { logoUrl }),
    ...(faviconUrl !== undefined && { faviconUrl }),
  };

  const existing = await db
    .select({ id: systemSettings.id })
    .from(systemSettings)
    .limit(1);

  let rowId: number;
  if (existing.length === 0) {
    const rows = await db
      .insert(systemSettings)
      .values({ logoUrl: logoUrl ?? "/iai-logo.png", ...updates })
      .returning({ id: systemSettings.id });
    rowId = rows[0]!.id;
  } else {
    await db
      .update(systemSettings)
      .set(updates)
      .where(eq(systemSettings.id, existing[0]!.id));
    rowId = existing[0]!.id;
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_SYSTEM_SETTINGS",
    entitasType: "system_settings",
    entitasId: String(rowId),
    detail: {
      namaSistem: parsed.namaSistem,
      singkatan: parsed.singkatan,
      logoUpdated: !!logoUrl,
      faviconUpdated: !!faviconUrl,
    },
  });

  updateTag("system-settings");
  revalidatePath("/pengaturan");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

// Untuk cek role di pengaturan page (server component)
export async function getSessionRole(): Promise<string | null> {
  const access = await getCurrentUserAccess();
  if (access?.isSuperAdmin) return "admin";
  if (access?.role) return access.role;
  const session = await getSession();
  return session ? ((session.user as { role?: string }).role ?? null) : null;
}
