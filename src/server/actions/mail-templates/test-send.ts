"use server";

import { db } from "@/server/db";
import { emailTemplates, emailSendLogs } from "@/server/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { sendEmail, getActiveEmailProvider } from "@/lib/email";
import { compileBlocksToHtml } from "@/lib/email/template-engine/compiler";
import { compileBlocksToText } from "@/lib/email/template-engine/text-compiler";
import { resolveVariables } from "@/lib/email/template-engine/variable-resolver";
import { wrapWithLayout } from "@/lib/email/template-engine/layout-wrapper";
import { getGlobalVariables } from "@/lib/email/template-engine/sample-data";
import { getAllSampleData } from "@/lib/email/template-engine/variable-registry";
import { testSendSchema } from "@/lib/validators/mail-templates";
import type { TemplateBlock } from "@/lib/email/template-engine/types";

const MAX_TEST_SENDS_PER_MINUTE = 5;

/**
 * Send a test email for a template.
 * Rate-limited to 5 sends per minute.
 */
export async function sendTestEmail(input: {
  templateId: string;
  recipientEmail: string;
  variables?: Record<string, string>;
}) {
  // Validate input
  const parsed = testSendSchema.parse(input);

  // Rate limit check: max 5 test sends in last 60 seconds
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const recentSends = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailSendLogs)
    .where(
      and(
        eq(emailSendLogs.templateKey, "__test_send__"),
        gte(emailSendLogs.sentAt, oneMinuteAgo),
      ),
    );

  const sendCount = Number(recentSends[0]?.count ?? 0);
  if (sendCount >= MAX_TEST_SENDS_PER_MINUTE) {
    return {
      success: false,
      error: `Rate limit: maksimal ${MAX_TEST_SENDS_PER_MINUTE} test email per menit. Coba lagi nanti.`,
    };
  }

  // Get template
  const result = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, parsed.templateId))
    .limit(1);

  const template = result[0];
  if (!template) {
    return { success: false, error: "Template tidak ditemukan" };
  }

  // Build variables: global + sample + custom overrides
  const sampleData = getAllSampleData();
  const variables: Record<string, string> = {
    ...getGlobalVariables(),
    ...sampleData,
    "recipient.nama": parsed.recipientEmail.split("@")[0] ?? "Test User",
    "recipient.email": parsed.recipientEmail,
    ...(parsed.variables ?? {}),
  };

  // Compile
  const blocks = template.bodyBlocks as TemplateBlock[];
  const subject = `[TEST] ${resolveVariables(template.subject, variables)}`;
  const bodyHtml = compileBlocksToHtml(blocks, variables);
  const htmlBody = await wrapWithLayout(bodyHtml, variables, template.layoutId);
  const textBody = compileBlocksToText(blocks, variables);

  // Send
  try {
    await sendEmail({
      to: parsed.recipientEmail,
      subject,
      htmlBody,
      textBody,
    });

    // Log as test send
    const provider = await getActiveEmailProvider();
    await db.insert(emailSendLogs).values({
      templateKey: "__test_send__",
      recipientEmail: parsed.recipientEmail,
      subject,
      status: "sent",
      provider,
      metadata: {
        templateId: template.id,
        templateKey: template.templateKey,
        isTest: true,
      },
    });

    return { success: true };
  } catch (err) {
    // Log failure
    const provider = await getActiveEmailProvider();
    await db.insert(emailSendLogs).values({
      templateKey: "__test_send__",
      recipientEmail: parsed.recipientEmail,
      subject,
      status: "failed",
      provider,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
      metadata: {
        templateId: template.id,
        templateKey: template.templateKey,
        isTest: true,
      },
    });

    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengirim email",
    };
  }
}
