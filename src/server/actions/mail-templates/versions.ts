"use server";

import { db } from "@/server/db";
import {
  emailTemplates,
  emailTemplateVersions,
} from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { compileBlocksToHtml } from "@/lib/email/template-engine/compiler";
import { compileBlocksToText } from "@/lib/email/template-engine/text-compiler";
import { getAllSampleData } from "@/lib/email/template-engine/variable-registry";
import type { TemplateBlock } from "@/lib/email/template-engine/types";

/**
 * List all versions for a template, ordered by version desc.
 */
export async function listVersions(templateId: string) {
  return db
    .select()
    .from(emailTemplateVersions)
    .where(eq(emailTemplateVersions.templateId, templateId))
    .orderBy(desc(emailTemplateVersions.version));
}

/**
 * Get a specific version by ID.
 */
export async function getVersionById(versionId: string) {
  const result = await db
    .select()
    .from(emailTemplateVersions)
    .where(eq(emailTemplateVersions.id, versionId))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Rollback a template to a specific version.
 * Creates a NEW version from the old snapshot (non-destructive).
 */
export async function rollbackToVersion(
  templateId: string,
  versionId: string,
  userId?: string,
) {
  // Get the version to rollback to
  const version = await getVersionById(versionId);
  if (!version) throw new Error("Version tidak ditemukan");
  if (version.templateId !== templateId) throw new Error("Version tidak sesuai template");

  // Get current template for version increment
  const currentResult = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, templateId))
    .limit(1);
  const current = currentResult[0];
  if (!current) throw new Error("Template tidak ditemukan");

  const newVersion = current.version + 1;
  const blocks = version.bodyBlocks as TemplateBlock[];
  const sampleData = getAllSampleData();
  const compiledHtml = compileBlocksToHtml(blocks, sampleData);
  const compiledText = compileBlocksToText(blocks, sampleData);

  // Update template to the rolled-back content
  await db
    .update(emailTemplates)
    .set({
      subject: version.subject,
      bodyBlocks: version.bodyBlocks,
      compiledHtml,
      compiledText,
      version: newVersion,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.id, templateId));

  // Create a new version entry (rollback is a new version)
  await db.insert(emailTemplateVersions).values({
    templateId,
    version: newVersion,
    subject: version.subject,
    bodyBlocks: version.bodyBlocks,
    compiledHtml,
    compiledText,
    changedBy: userId,
    changeNote: `Rollback ke versi ${version.version}`,
  });

  return { success: true, newVersion };
}
