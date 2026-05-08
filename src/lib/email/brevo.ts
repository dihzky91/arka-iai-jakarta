import { env } from "@/lib/env";
import type { EmailPayload } from "./types";

export function isBrevoReady(): boolean {
  return Boolean(
    env.BREVO_API_KEY && env.BREVO_FROM_EMAIL && env.BREVO_FROM_NAME,
  );
}

export function getMissingBrevoEnv(): string[] {
  const missing: string[] = [];
  if (!env.BREVO_API_KEY) missing.push("BREVO_API_KEY");
  if (!env.BREVO_FROM_EMAIL) missing.push("BREVO_FROM_EMAIL");
  if (!env.BREVO_FROM_NAME) missing.push("BREVO_FROM_NAME");
  return missing;
}

export async function sendEmailBrevo(payload: EmailPayload): Promise<void> {
  if (!env.BREVO_API_KEY) {
    console.warn(
      "[brevo] BREVO_API_KEY kosong — email tidak dikirim:",
      payload.subject,
    );
    return;
  }

  const body: Record<string, unknown> = {
    sender: {
      email: env.BREVO_FROM_EMAIL || "noreply@example.com",
      name: env.BREVO_FROM_NAME || "ARKA",
    },
    to: [{ email: payload.to, name: payload.toName ?? payload.to }],
    subject: payload.subject,
    htmlContent: payload.htmlBody,
    textContent: payload.textBody ?? "",
  };

  if (payload.attachments?.length) {
    body.attachment = payload.attachments.map((a) => ({
      name: a.filename,
      content: a.base64Content,
    }));
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.BREVO_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo API error (${res.status}): ${text}`);
  }
}
