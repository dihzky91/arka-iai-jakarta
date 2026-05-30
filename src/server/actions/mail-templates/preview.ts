"use server";

import { db } from "@/server/db";
import { emailTemplates } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { compileBlocksToHtml } from "@/lib/email/template-engine/compiler";
import { compileBlocksToText } from "@/lib/email/template-engine/text-compiler";
import { resolveVariables } from "@/lib/email/template-engine/variable-resolver";
import { wrapWithLayout } from "@/lib/email/template-engine/layout-wrapper";
import { getGlobalVariables } from "@/lib/email/template-engine/sample-data";
import { getAllSampleData } from "@/lib/email/template-engine/variable-registry";
import type { TemplateBlock } from "@/lib/email/template-engine/types";

/**
 * Compile a template with custom or sample variables and return the full HTML.
 * Used for server-side preview rendering.
 */
export async function compileTemplatePreview(
  templateId: string,
  customVariables?: Record<string, string>,
) {
  const result = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, templateId))
    .limit(1);

  const template = result[0];
  if (!template) return null;

  const sampleData = getAllSampleData();
  const variables: Record<string, string> = {
    ...getGlobalVariables(),
    ...sampleData,
    ...(customVariables ?? {}),
  };

  const blocks = template.bodyBlocks as TemplateBlock[];
  const subject = resolveVariables(template.subject, variables);
  const bodyHtml = compileBlocksToHtml(blocks, variables);
  const htmlBody = await wrapWithLayout(bodyHtml, variables, template.layoutId);
  const textBody = compileBlocksToText(blocks, variables);

  return { subject, htmlBody, textBody };
}
