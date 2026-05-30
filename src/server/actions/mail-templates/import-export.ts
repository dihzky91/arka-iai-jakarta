"use server";

import { db } from "@/server/db";
import { emailTemplates } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { compileBlocksToHtml } from "@/lib/email/template-engine/compiler";
import { compileBlocksToText } from "@/lib/email/template-engine/text-compiler";
import { getAllSampleData } from "@/lib/email/template-engine/variable-registry";
import { createTemplateSchema } from "@/lib/validators/mail-templates";
import type { TemplateBlock } from "@/lib/email/template-engine/types";

export interface TemplateExportData {
  _format: "arka-mail-template-v1";
  templateKey: string;
  templateName: string;
  description?: string;
  category: string;
  subject: string;
  bodyBlocks: TemplateBlock[];
  layoutId?: string | null;
  exportedAt: string;
}

/**
 * Export a template as JSON.
 */
export async function exportTemplate(templateId: string): Promise<TemplateExportData | null> {
  const result = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, templateId))
    .limit(1);

  const template = result[0];
  if (!template) return null;

  return {
    _format: "arka-mail-template-v1",
    templateKey: template.templateKey,
    templateName: template.templateName,
    description: template.description ?? undefined,
    category: template.category,
    subject: template.subject,
    bodyBlocks: template.bodyBlocks as TemplateBlock[],
    layoutId: template.layoutId,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Import a template from JSON.
 * If templateKey already exists, creates with a suffixed key.
 */
export async function importTemplate(
  data: TemplateExportData,
  userId?: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Validate format
    if (data._format !== "arka-mail-template-v1") {
      return { success: false, error: "Format tidak valid. Pastikan file adalah export dari ARKA." };
    }

    // Check if key already exists
    let templateKey = data.templateKey;
    const existing = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.templateKey, templateKey))
      .limit(1);

    if (existing.length > 0) {
      templateKey = `${data.templateKey}_imported_${Date.now()}`;
    }

    // Validate with schema
    const parsed = createTemplateSchema.parse({
      templateKey,
      templateName: data.templateName,
      description: data.description,
      category: data.category,
      subject: data.subject,
      bodyBlocks: data.bodyBlocks,
      layoutId: data.layoutId ?? null,
    });

    const blocks = parsed.bodyBlocks as TemplateBlock[];
    const sampleData = getAllSampleData();
    const compiledHtml = compileBlocksToHtml(blocks, sampleData);
    const compiledText = compileBlocksToText(blocks, sampleData);

    const result = await db
      .insert(emailTemplates)
      .values({
        templateKey: parsed.templateKey,
        templateName: parsed.templateName,
        description: parsed.description,
        category: parsed.category,
        subject: parsed.subject,
        bodyBlocks: parsed.bodyBlocks,
        compiledHtml,
        compiledText,
        layoutId: parsed.layoutId ?? null,
        isActive: true,
        isSystem: false,
        version: 1,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({ id: emailTemplates.id });

    return { success: true, id: result[0]?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal import template",
    };
  }
}
