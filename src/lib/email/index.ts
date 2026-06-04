import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { systemSettings } from "@/server/db/schema";
import { env } from "@/lib/env";
import { sendEmailMailjet, isMailjetReady, getMissingMailjetEnv } from "./mailjet";
import { sendEmailBrevo, isBrevoReady, getMissingBrevoEnv } from "./brevo";
import { sendEmailSmtp, isSmtpReady } from "./smtp";
import type { EmailPayload, EmailProviderType } from "./types";

export type { EmailPayload, EmailProviderType } from "./types";
export {
  buildInviteEmail,
  buildResetPasswordEmail,
  buildDisposisiEmail,
  buildSuratKeluarReviewEmail,
  buildSuratKeluarRevisiEmail,
  buildSuratKeluarSelesaiEmail,
} from "./templates";

// ─── Provider resolution ──────────────────────────────────────────────────────

const getEmailProviderFromDb = cache(async (): Promise<EmailProviderType> => {
  try {
    const rows = await db
      .select({ emailProvider: systemSettings.emailProvider })
      .from(systemSettings)
      .limit(1);
    return rows[0]?.emailProvider ?? "mailjet";
  } catch {
    return "mailjet";
  }
});

function resolveEffectiveProvider(
  dbProvider: EmailProviderType,
): EmailProviderType {
  if (dbProvider === "brevo" && isBrevoReady()) return "brevo";
  if (dbProvider === "mailjet" && isMailjetReady()) return "mailjet";
  // Fallback: jika provider pilihan belum siap, coba provider lain
  if (dbProvider === "brevo" && isMailjetReady()) {
    console.warn(
      "[email] Brevo belum lengkap — fallback ke Mailjet. Missing env:",
      getMissingBrevoEnv().join(", "),
    );
    return "mailjet";
  }
  if (dbProvider === "mailjet" && isBrevoReady()) {
    console.warn(
      "[email] Mailjet belum lengkap — fallback ke Brevo. Missing env:",
      getMissingMailjetEnv().join(", "),
    );
    return "brevo";
  }
  return dbProvider;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Di development, jika SMTP_HOST di-set (atau NODE_ENV=development dan Mailpit jalan),
 * semua email akan dikirim via SMTP ke Mailpit (localhost:1025).
 * Ini memastikan tidak ada email keluar ke dunia nyata saat development.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  // Override: gunakan SMTP/Mailpit di development
  if (process.env.NODE_ENV !== "production" && isSmtpReady()) {
    return sendEmailSmtp(payload);
  }

  const dbProvider = await getEmailProviderFromDb();
  const effective = resolveEffectiveProvider(dbProvider);

  if (effective === "brevo") {
    return sendEmailBrevo(payload);
  }
  return sendEmailMailjet(payload);
}

export async function getActiveEmailProvider(): Promise<EmailProviderType> {
  const dbProvider = await getEmailProviderFromDb();
  return resolveEffectiveProvider(dbProvider);
}

export function isEmailProviderReady(provider: EmailProviderType): boolean {
  return provider === "brevo" ? isBrevoReady() : isMailjetReady();
}

export function getMissingEmailEnv(provider: EmailProviderType): string[] {
  return provider === "brevo" ? getMissingBrevoEnv() : getMissingMailjetEnv();
}
