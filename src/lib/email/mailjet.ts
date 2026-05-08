import Mailjet from "node-mailjet";
import { env } from "@/lib/env";
import type { EmailPayload } from "./types";

let client: ReturnType<typeof Mailjet.apiConnect> | null = null;

function getClient() {
  if (client) return client;
  if (!env.MAILJET_API_KEY || !env.MAILJET_API_SECRET) {
    return null;
  }
  client = Mailjet.apiConnect(env.MAILJET_API_KEY, env.MAILJET_API_SECRET);
  return client;
}

export function isMailjetReady(): boolean {
  return Boolean(
    env.MAILJET_API_KEY &&
      env.MAILJET_API_SECRET &&
      env.MAILJET_FROM_EMAIL &&
      env.MAILJET_FROM_NAME,
  );
}

export function getMissingMailjetEnv(): string[] {
  const missing: string[] = [];
  if (!env.MAILJET_API_KEY) missing.push("MAILJET_API_KEY");
  if (!env.MAILJET_API_SECRET) missing.push("MAILJET_API_SECRET");
  if (!env.MAILJET_FROM_EMAIL) missing.push("MAILJET_FROM_EMAIL");
  if (!env.MAILJET_FROM_NAME) missing.push("MAILJET_FROM_NAME");
  return missing;
}

export async function sendEmailMailjet(payload: EmailPayload): Promise<void> {
  const mj = getClient();
  if (!mj) {
    console.warn(
      "[mailjet] Env kosong — email tidak dikirim:",
      payload.subject,
    );
    return;
  }
  await mj.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: env.MAILJET_FROM_EMAIL,
          Name: env.MAILJET_FROM_NAME,
        },
        To: [{ Email: payload.to, Name: payload.toName ?? payload.to }],
        Subject: payload.subject,
        HTMLPart: payload.htmlBody,
        TextPart: payload.textBody,
        Attachments: payload.attachments?.map((attachment) => ({
          ContentType: attachment.contentType,
          Filename: attachment.filename,
          Base64Content: attachment.base64Content,
        })),
      },
    ],
  });
}
