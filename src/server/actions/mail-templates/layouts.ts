"use server";

import { db } from "@/server/db";
import { emailLayouts } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  createLayoutSchema,
  type CreateLayoutInput,
} from "@/lib/validators/mail-templates";

export async function listLayouts() {
  return db.select().from(emailLayouts).orderBy(emailLayouts.name);
}

export async function getLayoutById(id: string) {
  const result = await db
    .select()
    .from(emailLayouts)
    .where(eq(emailLayouts.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function createLayout(input: CreateLayoutInput, userId?: string) {
  const parsed = createLayoutSchema.parse(input);

  // If setting as default, unset other defaults
  if (parsed.isDefault) {
    await db
      .update(emailLayouts)
      .set({ isDefault: false })
      .where(eq(emailLayouts.isDefault, true));
  }

  const result = await db
    .insert(emailLayouts)
    .values({
      name: parsed.name,
      description: parsed.description,
      headerHtml: parsed.headerHtml,
      footerHtml: parsed.footerHtml,
      cssInline: parsed.cssInline,
      isDefault: parsed.isDefault ?? false,
      createdBy: userId,
    })
    .returning();

  return result[0];
}

export async function updateLayout(
  id: string,
  input: Partial<CreateLayoutInput>,
  userId?: string,
) {
  // If setting as default, unset other defaults
  if (input.isDefault) {
    await db
      .update(emailLayouts)
      .set({ isDefault: false })
      .where(eq(emailLayouts.isDefault, true));
  }

  const result = await db
    .update(emailLayouts)
    .set({
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.headerHtml !== undefined && { headerHtml: input.headerHtml }),
      ...(input.footerHtml !== undefined && { footerHtml: input.footerHtml }),
      ...(input.cssInline !== undefined && { cssInline: input.cssInline }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      updatedAt: new Date(),
    })
    .where(eq(emailLayouts.id, id))
    .returning();

  return result[0];
}

export async function deleteLayout(id: string) {
  await db.delete(emailLayouts).where(eq(emailLayouts.id, id));
  return { success: true };
}
