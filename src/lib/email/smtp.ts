import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import type { EmailPayload } from "./types";

/**
 * SMTP transport untuk development (Mailpit).
 * Mailpit default: SMTP port 1025, Web UI port 8025.
 *
 * Env vars:
 *   SMTP_HOST (default: localhost)
 *   SMTP_PORT (default: 1025)
 *   SMTP_FROM_EMAIL (default: MAILJET_FROM_EMAIL fallback)
 *   SMTP_FROM_NAME  (default: MAILJET_FROM_NAME fallback)
 */

function getTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST || "localhost",
    port: Number(env.SMTP_PORT) || 1025,
    secure: false, // Mailpit tidak pakai TLS
    tls: { rejectUnauthorized: false },
  });
}

export function isSmtpReady(): boolean {
  // Di development cukup cek ada host saja (default localhost)
  return Boolean(env.SMTP_HOST || process.env.NODE_ENV === "development");
}

export function getMissingSmtpEnv(): string[] {
  const missing: string[] = [];
  if (!env.SMTP_HOST && process.env.NODE_ENV !== "development")
    missing.push("SMTP_HOST");
  return missing;
}

export async function sendEmailSmtp(payload: EmailPayload): Promise<void> {
  const transporter = getTransporter();

  const fromEmail = env.SMTP_FROM_EMAIL || env.MAILJET_FROM_EMAIL || "noreply@localhost";
  const fromName = env.SMTP_FROM_NAME || env.MAILJET_FROM_NAME || "ARKA Dev";

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: payload.toName ? `"${payload.toName}" <${payload.to}>` : payload.to,
    subject: payload.subject,
    html: payload.htmlBody,
    text: payload.textBody,
    attachments: payload.attachments?.map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.base64Content, "base64"),
      contentType: att.contentType,
    })),
  });
}
