"use server";

import { db } from "@/server/db";
import {
  emailTemplates,
  emailTemplateVersions,
} from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { compileBlocksToHtml } from "@/lib/email/template-engine/compiler";
import { compileBlocksToText } from "@/lib/email/template-engine/text-compiler";
import { getAllSampleData } from "@/lib/email/template-engine/variable-registry";
import type { TemplateBlock } from "@/lib/email/template-engine/types";
import {
  createTemplateSchema,
  updateTemplateSchema,
  type CreateTemplateInput,
  type UpdateTemplateInput,
} from "@/lib/validators/mail-templates";

// ─── LIST TEMPLATES ───────────────────────────────────────────────────────────

export async function listTemplates(opts?: {
  category?: string;
  search?: string;
}) {
  const conditions = [];

  if (opts?.category && opts.category !== "all") {
    conditions.push(
      eq(emailTemplates.category, opts.category as typeof emailTemplates.category.enumValues[number]),
    );
  }

  if (opts?.search) {
    conditions.push(
      sql`(${emailTemplates.templateName} ILIKE ${"%" + opts.search + "%"} OR ${emailTemplates.templateKey} ILIKE ${"%" + opts.search + "%"})`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select()
    .from(emailTemplates)
    .where(where)
    .orderBy(emailTemplates.category, emailTemplates.templateName);
}

// ─── GET TEMPLATE BY ID ───────────────────────────────────────────────────────

export async function getTemplateById(id: string) {
  const result = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, id))
    .limit(1);
  return result[0] ?? null;
}

// ─── GET TEMPLATE BY KEY ──────────────────────────────────────────────────────

export async function getTemplateByKey(key: string) {
  const result = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.templateKey, key))
    .limit(1);
  return result[0] ?? null;
}

// ─── CREATE TEMPLATE ──────────────────────────────────────────────────────────

export async function createTemplate(
  input: CreateTemplateInput,
  userId?: string,
) {
  const parsed = createTemplateSchema.parse(input);
  const blocks = parsed.bodyBlocks as TemplateBlock[];
  const sampleData = getAllSampleData();

  // Compile with sample data for storage
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
      isActive: parsed.isActive ?? true,
      isSystem: false,
      version: 1,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  const template = result[0];

  // Create initial version
  if (template) {
    await db.insert(emailTemplateVersions).values({
      templateId: template.id,
      version: 1,
      subject: parsed.subject,
      bodyBlocks: parsed.bodyBlocks,
      compiledHtml,
      compiledText,
      changedBy: userId,
      changeNote: "Template dibuat",
    });
  }

  return template;
}

// ─── UPDATE TEMPLATE ──────────────────────────────────────────────────────────

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
  userId?: string,
) {
  const parsed = updateTemplateSchema.parse(input);

  // Get current template for version increment
  const current = await getTemplateById(id);
  if (!current) throw new Error("Template not found");

  const blocks = (parsed.bodyBlocks ?? current.bodyBlocks) as TemplateBlock[];
  const sampleData = getAllSampleData();

  const compiledHtml = compileBlocksToHtml(blocks, sampleData);
  const compiledText = compileBlocksToText(blocks, sampleData);
  const newVersion = current.version + 1;

  const result = await db
    .update(emailTemplates)
    .set({
      ...(parsed.templateName && { templateName: parsed.templateName }),
      ...(parsed.description !== undefined && { description: parsed.description }),
      ...(parsed.category && { category: parsed.category }),
      ...(parsed.subject && { subject: parsed.subject }),
      ...(parsed.bodyBlocks && { bodyBlocks: parsed.bodyBlocks }),
      ...(parsed.layoutId !== undefined && { layoutId: parsed.layoutId }),
      ...(parsed.isActive !== undefined && { isActive: parsed.isActive }),
      compiledHtml,
      compiledText,
      version: newVersion,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.id, id))
    .returning();

  const updated = result[0];

  // Save version snapshot
  if (updated) {
    await db.insert(emailTemplateVersions).values({
      templateId: id,
      version: newVersion,
      subject: parsed.subject ?? current.subject,
      bodyBlocks: parsed.bodyBlocks ?? current.bodyBlocks,
      compiledHtml,
      compiledText,
      changedBy: userId,
      changeNote: parsed.changeNote ?? undefined,
    });
  }

  return updated;
}

// ─── DELETE TEMPLATE ──────────────────────────────────────────────────────────

export async function deleteTemplate(id: string) {
  const template = await getTemplateById(id);
  if (!template) throw new Error("Template not found");
  if (template.isSystem) {
    throw new Error("System template tidak bisa dihapus");
  }

  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  return { success: true };
}

// ─── TOGGLE ACTIVE ────────────────────────────────────────────────────────────

export async function toggleTemplateActive(id: string) {
  const template = await getTemplateById(id);
  if (!template) throw new Error("Template not found");

  const result = await db
    .update(emailTemplates)
    .set({ isActive: !template.isActive, updatedAt: new Date() })
    .where(eq(emailTemplates.id, id))
    .returning();

  return result[0];
}

// ─── DUPLICATE TEMPLATE ───────────────────────────────────────────────────────

export async function duplicateTemplate(id: string, userId?: string) {
  const template = await getTemplateById(id);
  if (!template) throw new Error("Template not found");

  const newKey = `${template.templateKey}_copy_${Date.now()}`;
  const newName = `${template.templateName} (Copy)`;

  return createTemplate(
    {
      templateKey: newKey,
      templateName: newName,
      description: template.description ?? undefined,
      category: template.category,
      subject: template.subject,
      bodyBlocks: template.bodyBlocks as TemplateBlock[],
      layoutId: template.layoutId,
      isActive: false,
    },
    userId,
  );
}
