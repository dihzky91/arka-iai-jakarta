"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { systemSettings, auditLog } from "@/server/db/schema";
import { requirePermission, requireSession } from "./auth";
import { sendEmail, getActiveEmailProvider, getMissingEmailEnv, isEmailProviderReady } from "@/lib/email";
import { getStorageProvider } from "@/lib/storage";
import { env } from "@/lib/env";
import { APP_BRAND_FULL_NAME } from "@/lib/branding";
import { enforceUploadRateLimit } from "@/lib/rate-limit/upload-guard";

// â”€â”€â”€ Update non-secret config (admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const configSchema = z.object({
  defaultDisposisiDeadlineDays: z.number().int().min(0).max(365),
  notificationEmailEnabled: z.boolean(),
  whatsappBotEnabled: z.boolean(),
  emailProvider: z.enum(["mailjet", "brevo"]),
  financeContactName: z.string().trim().max(200).optional().nullable(),
  financeWhatsappNumber: z.string().trim().max(30).optional().nullable(),
});

export async function updateSystemConfig(input: unknown) {
  const session = await requirePermission("pengaturan", "update");

  const parsed = configSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }
  const financeContactName = parsed.data.financeContactName?.trim() || null;
  const financeWhatsappNumber = parsed.data.financeWhatsappNumber?.trim() || null;
  const normalizedConfig = {
    defaultDisposisiDeadlineDays: parsed.data.defaultDisposisiDeadlineDays,
    notificationEmailEnabled: parsed.data.notificationEmailEnabled,
    whatsappBotEnabled: parsed.data.whatsappBotEnabled,
    emailProvider: parsed.data.emailProvider,
    financeContactName,
    financeWhatsappNumber,
  };

  const existing = await db
    .select({ id: systemSettings.id })
    .from(systemSettings)
    .limit(1);

  if (existing.length === 0) {
    await db.insert(systemSettings).values({
      ...normalizedConfig,
      logoUrl: "/iai-logo.png",
      updatedBy: session.user.id,
      updatedAt: new Date(),
    });
  } else {
    await db
      .update(systemSettings)
      .set({
        ...normalizedConfig,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.id, existing[0]!.id));
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_SYSTEM_CONFIG",
    entitasType: "system_settings",
    entitasId: String(existing[0]?.id ?? "new"),
    detail: normalizedConfig,
  });

  revalidatePath("/pengaturan");
  return { ok: true as const };
}

// â”€â”€â”€ Test connections (admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function testEmailConnection() {
  const session = await requirePermission("pengaturan", "configure");

  const provider = await getActiveEmailProvider();
  const missing = getMissingEmailEnv(provider);

  if (missing.length > 0) {
    const label = provider === "brevo" ? "Brevo" : "Mailjet";
    return {
      ok: false as const,
      error: `${label} belum dikonfigurasi. Env hilang: ${missing.join(", ")}.`,
    };
  }

  const label = provider === "brevo" ? "Brevo" : "Mailjet";

  try {
    await sendEmail({
      to: session.user.email,
      toName: session.user.name ?? "Admin",
      subject: `[TEST] Koneksi ${label} - ${APP_BRAND_FULL_NAME}`,
      htmlBody: `
        <h2>Test Email Berhasil</h2>
        <p>Halo ${session.user.name ?? "Admin"},</p>
        <p>Email ini dikirim dari halaman Pengaturan untuk memverifikasi koneksi ${label}.</p>
        <p>Jika Anda menerima email ini, integrasi ${label} sudah siap digunakan.</p>
        <hr/>
        <p><small>Dikirim pada ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</small></p>
      `,
      textBody: `Test Email Berhasil\n\nHalo ${session.user.name ?? "Admin"},\nEmail ini dikirim dari halaman Pengaturan untuk memverifikasi koneksi ${label}.\n\nDikirim ${new Date().toISOString()}`,
    });
    return {
      ok: true as const,
      message: `Email test terkirim ke ${session.user.email} via ${label}. Cek inbox Anda.`,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Gagal mengirim email test.",
    };
  }
}

export async function testStorageConnection() {
  const session = await requirePermission("pengaturan", "configure");
  enforceUploadRateLimit(session.user.id);
  try {
    const storage = getStorageProvider();
    const payload = `storage-test-${Date.now()}`;
    const result = await storage.upload({
      body: Buffer.from(payload, "utf-8"),
      fileName: `test-${Date.now()}.txt`,
      contentType: "text/plain",
      folder: "system-tests",
      publicId: `test-${Date.now()}`,
    });
    return {
      ok: true as const,
      message: `Upload berhasil. URL: ${result.url}`,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Gagal upload test.",
    };
  }
}

export async function testDatabaseConnection() {
  await requireSession();
  try {
    const start = Date.now();
    const result = await db.execute(sql`SELECT 1 as ok`);
    const elapsed = Date.now() - start;
    return {
      ok: true as const,
      message: `Database OK (${elapsed}ms). Rows: ${result.rowCount ?? result.rows?.length ?? 0}`,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Gagal koneksi database.",
    };
  }
}

export async function testDingtalkConnection() {
  await requireSession();
  if (!env.DINGTALK_APP_KEY || !env.DINGTALK_APP_SECRET) {
    return { ok: false as const, error: "DINGTALK_APP_KEY atau DINGTALK_APP_SECRET belum di-set." };
  }
  try {
    const start = Date.now();
    const res = await fetch(`${env.DINGTALK_BASE_URL}/v1.0/oauth2/accessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appKey: env.DINGTALK_APP_KEY, appSecret: env.DINGTALK_APP_SECRET }),
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      const text = await res.text();
      return { ok: false as const, error: `HTTP ${res.status}: ${text}` };
    }
    const data = (await res.json()) as { accessToken?: string; message?: string };
    if (!data.accessToken) {
      return { ok: false as const, error: data.message ?? "Token tidak diterima." };
    }
    return { ok: true as const, message: `DingTalk OK (${elapsed}ms). Token diterima.` };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Gagal koneksi DingTalk." };
  }
}
