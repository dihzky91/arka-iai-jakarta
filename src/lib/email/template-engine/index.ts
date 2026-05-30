import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  emailTemplates,
  emailSendLogs,
} from "@/server/db/schema";
import { sendEmail, getActiveEmailProvider } from "@/lib/email";
import {
  buildInviteEmail,
  buildResetPasswordEmail,
  buildDisposisiEmail,
  buildSuratKeluarReviewEmail,
  buildSuratKeluarRevisiEmail,
  buildSuratKeluarSelesaiEmail,
} from "@/lib/email/templates";
import { compileBlocksToHtml } from "./compiler";
import { compileBlocksToText } from "./text-compiler";
import { resolveVariables } from "./variable-resolver";
import { wrapWithLayout } from "./layout-wrapper";
import { getGlobalVariables } from "./sample-data";
import type {
  TemplateBlock,
  SendTemplatedEmailOptions,
  SendTemplatedEmailResult,
} from "./types";

export type { TemplateBlock, SendTemplatedEmailOptions, SendTemplatedEmailResult };
export { compileBlocksToHtml } from "./compiler";
export { compileBlocksToText } from "./text-compiler";
export { resolveVariables } from "./variable-resolver";
export { wrapWithLayout } from "./layout-wrapper";
export { getGlobalVariables, generateSampleData } from "./sample-data";
export { getVariablesByCategory, getAllVariables, getSampleData } from "./variable-registry";

/**
 * Kirim email menggunakan template dari DB.
 * Fallback ke hardcoded template jika DB template tidak ditemukan.
 */
export async function sendTemplatedEmail(
  templateKey: string,
  options: SendTemplatedEmailOptions,
): Promise<SendTemplatedEmailResult> {
  try {
    // 1. Lookup template from DB
    const templates = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.templateKey, templateKey))
      .limit(1);

    const template = templates[0];

    if (!template) {
      // Fallback ke hardcoded
      const fallback = getFallbackTemplate(templateKey, options);
      if (fallback) {
        await sendEmail({
          to: options.to,
          toName: options.toName,
          ...fallback,
        });
        await logSend(templateKey, options, "sent");
        return { success: true };
      }
      return { success: false, error: `Template "${templateKey}" not found` };
    }

    if (!template.isActive) {
      return { success: false, error: `Template "${templateKey}" is inactive` };
    }

    // 2. Resolve variables
    const allVars: Record<string, string> = {
      ...getGlobalVariables(),
      "recipient.nama": options.toName ?? options.to,
      "recipient.email": options.to,
      ...options.variables,
    };

    // 3. Compile
    const subject = resolveVariables(template.subject, allVars);
    const blocks = template.bodyBlocks as TemplateBlock[];
    const bodyHtml = compileBlocksToHtml(blocks, allVars);
    const htmlBody = await wrapWithLayout(bodyHtml, allVars, template.layoutId);
    const textBody = compileBlocksToText(blocks, allVars);

    // 4. Send
    await sendEmail({
      to: options.to,
      toName: options.toName,
      subject,
      htmlBody,
      textBody,
      attachments: options.attachments,
    });

    // 5. Log success
    const logId = await logSend(templateKey, options, "sent", subject);
    return { success: true, logId };
  } catch (err) {
    // Log failure
    await logSend(
      templateKey,
      options,
      "failed",
      undefined,
      err instanceof Error ? err.message : "Unknown error",
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : "Send failed",
    };
  }
}

// ─── FALLBACK TEMPLATES ───────────────────────────────────────────────────────

function getFallbackTemplate(
  templateKey: string,
  options: SendTemplatedEmailOptions,
): { subject: string; htmlBody: string; textBody?: string } | null {
  const vars = options.variables;

  switch (templateKey) {
    case "auth_invite":
      return buildInviteEmail({
        namaLengkap: vars["recipient.nama"] ?? options.toName ?? "",
        resetUrl: vars["auth.invite_url"] ?? vars["auth.reset_url"] ?? "",
        inviterName: vars["auth.inviter_name"],
      });
    case "auth_reset_password":
      return buildResetPasswordEmail({
        namaLengkap: vars["recipient.nama"] ?? options.toName ?? "",
        resetUrl: vars["auth.reset_url"] ?? "",
      });
    case "disposisi_baru":
      return buildDisposisiEmail({
        penerimaNama: vars["recipient.nama"] ?? options.toName ?? "",
        pengirimNama: vars["disposisi.dari"] ?? "",
        perihalSurat: vars["surat.perihal"] ?? "",
        instruksi: vars["disposisi.instruksi"],
        batasWaktu: vars["disposisi.batas_waktu"],
        inboxUrl: vars["disposisi.url"] ?? "",
      });
    case "surat_keluar_review":
      return buildSuratKeluarReviewEmail({
        pejabatNama: vars["recipient.nama"] ?? options.toName ?? "",
        pengirimNama: vars["surat.pengirim"] ?? "",
        perihal: vars["surat.perihal"] ?? "",
        tujuan: vars["surat.tujuan"],
        reviewUrl: vars["surat.review_url"] ?? "",
      });
    case "surat_keluar_revisi":
      return buildSuratKeluarRevisiEmail({
        pembuatNama: vars["recipient.nama"] ?? options.toName ?? "",
        pejabatNama: vars["pejabat.nama"] ?? "",
        perihal: vars["surat.perihal"] ?? "",
        catatan: vars["catatan.revisi"] ?? "",
        suratUrl: vars["surat.url"] ?? "",
      });
    case "surat_keluar_selesai":
      return buildSuratKeluarSelesaiEmail({
        pembuatNama: vars["recipient.nama"] ?? options.toName ?? "",
        perihal: vars["surat.perihal"] ?? "",
        nomorSurat: vars["surat.nomor"] ?? null,
        suratUrl: vars["surat.url"] ?? "",
      });
    default:
      return null;
  }
}

// ─── LOGGING ──────────────────────────────────────────────────────────────────

async function logSend(
  templateKey: string,
  options: SendTemplatedEmailOptions,
  status: "sent" | "failed",
  subject?: string,
  errorMessage?: string,
): Promise<string | undefined> {
  try {
    const provider = await getActiveEmailProvider();
    const result = await db
      .insert(emailSendLogs)
      .values({
        templateKey,
        recipientEmail: options.to,
        recipientName: options.toName,
        subject: subject ?? templateKey,
        status,
        provider,
        errorMessage,
        metadata: { variables: options.variables },
      })
      .returning({ id: emailSendLogs.id });
    return result[0]?.id;
  } catch {
    // Don't fail the email send if logging fails
    console.error("[email-template-engine] Failed to log email send");
    return undefined;
  }
}
