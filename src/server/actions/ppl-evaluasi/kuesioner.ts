"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  pplKuesionerTemplate,
  pplKuesionerLink,
  pplKuesionerResponse,
} from "@/server/db/schema";
import { templateSchema } from "@/lib/validators/ppl-evaluasi";
import { requirePermission } from "@/server/actions/auth";
import { generateQRDataURL } from "@/lib/qr/generateQR";
import type {
  ActionResult,
  CreateTemplateInput,
  UpdateTemplateInput,
} from "./types";

// â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function generateAccessToken(): string {
  // Generate a 32-character hex token (64 chars max allowed by schema)
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildAccessUrl(token: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/evaluasi/${token}`;
}

// â”€â”€â”€ CREATE TEMPLATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createTemplate(
  data: CreateTemplateInput,
): Promise<ActionResult<{ id: number }>> {
  await requirePermission("pplEvaluasi", "manage");

  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return {
      ok: false,
      error: firstError?.message ?? "Data template tidak valid",
    };
  }

  const input = parsed.data;

  const [row] = await db
    .insert(pplKuesionerTemplate)
    .values({
      nama: input.nama,
      configJson: input.fields,
    })
    .returning({ id: pplKuesionerTemplate.id });

  if (!row) {
    return { ok: false, error: "Gagal membuat template kuesioner" };
  }

  revalidatePath("/ppl-evaluasi");
  return { ok: true, data: { id: row.id } };
}

// â”€â”€â”€ UPDATE TEMPLATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function updateTemplate(
  id: number,
  data: UpdateTemplateInput,
): Promise<ActionResult> {
  await requirePermission("pplEvaluasi", "manage");

  // Check if template exists
  const [existing] = await db
    .select({ id: pplKuesionerTemplate.id })
    .from(pplKuesionerTemplate)
    .where(eq(pplKuesionerTemplate.id, id))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Template tidak ditemukan" };
  }

  // Check if template is locked (has responses via any linked kegiatan)
  const [responseCount] = await db
    .select({ count: count() })
    .from(pplKuesionerResponse)
    .innerJoin(
      pplKuesionerLink,
      eq(pplKuesionerResponse.linkId, pplKuesionerLink.id),
    )
    .where(eq(pplKuesionerLink.templateId, id));

  if ((responseCount?.count ?? 0) > 0) {
    return {
      ok: false,
      error: "Template terkunci karena sudah memiliki respons",
    };
  }

  // Validate the update data
  const parsed = templateSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return {
      ok: false,
      error: firstError?.message ?? "Data template tidak valid",
    };
  }

  const input = parsed.data;

  await db
    .update(pplKuesionerTemplate)
    .set({
      nama: input.nama,
      configJson: input.fields,
      updatedAt: new Date(),
    })
    .where(eq(pplKuesionerTemplate.id, id));

  revalidatePath("/ppl-evaluasi");
  return { ok: true };
}

// â”€â”€â”€ DUPLICATE TEMPLATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function duplicateTemplate(
  id: number,
  newName: string,
): Promise<ActionResult<{ id: number }>> {
  await requirePermission("pplEvaluasi", "manage");

  // Validate new name
  if (!newName || newName.trim().length === 0) {
    return { ok: false, error: "Nama template baru wajib diisi" };
  }
  if (newName.length > 200) {
    return { ok: false, error: "Nama template maksimal 200 karakter" };
  }

  // Fetch the source template
  const [source] = await db
    .select({
      id: pplKuesionerTemplate.id,
      configJson: pplKuesionerTemplate.configJson,
    })
    .from(pplKuesionerTemplate)
    .where(eq(pplKuesionerTemplate.id, id))
    .limit(1);

  if (!source) {
    return { ok: false, error: "Template sumber tidak ditemukan" };
  }

  // Create independent copy with new name
  const [row] = await db
    .insert(pplKuesionerTemplate)
    .values({
      nama: newName.trim(),
      configJson: source.configJson,
    })
    .returning({ id: pplKuesionerTemplate.id });

  if (!row) {
    return { ok: false, error: "Gagal menduplikasi template" };
  }

  revalidatePath("/ppl-evaluasi");
  return { ok: true, data: { id: row.id } };
}

// â”€â”€â”€ LINK TEMPLATE TO KEGIATAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function linkTemplateToKegiatan(
  templateId: number,
  kegiatanId: number,
): Promise<ActionResult> {
  await requirePermission("pplEvaluasi", "manage");

  // Verify template exists
  const [template] = await db
    .select({ id: pplKuesionerTemplate.id })
    .from(pplKuesionerTemplate)
    .where(eq(pplKuesionerTemplate.id, templateId))
    .limit(1);

  if (!template) {
    return { ok: false, error: "Template tidak ditemukan" };
  }

  // Check if kegiatan already has a linked template
  const [existingLink] = await db
    .select({ id: pplKuesionerLink.id })
    .from(pplKuesionerLink)
    .where(eq(pplKuesionerLink.kegiatanId, kegiatanId))
    .limit(1);

  if (existingLink) {
    return {
      ok: false,
      error: "Kegiatan sudah memiliki kuesioner yang terhubung",
    };
  }

  // Generate access token for the link
  const accessToken = generateAccessToken();

  await db.insert(pplKuesionerLink).values({
    kegiatanId,
    templateId,
    accessToken,
    isActive: false,
  });

  revalidatePath("/ppl-evaluasi");
  revalidatePath(`/ppl-evaluasi/${kegiatanId}`);
  return { ok: true };
}

// â”€â”€â”€ ACTIVATE KUESIONER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function activateKuesioner(
  kegiatanId: number,
): Promise<ActionResult<{ url: string; qrDataUrl: string }>> {
  await requirePermission("pplEvaluasi", "manage");

  // Find the link for this kegiatan
  const [link] = await db
    .select({
      id: pplKuesionerLink.id,
      accessToken: pplKuesionerLink.accessToken,
      isActive: pplKuesionerLink.isActive,
    })
    .from(pplKuesionerLink)
    .where(eq(pplKuesionerLink.kegiatanId, kegiatanId))
    .limit(1);

  if (!link) {
    return {
      ok: false,
      error: "Kegiatan belum memiliki kuesioner yang terhubung",
    };
  }

  if (link.isActive) {
    // Already active â€” return existing URL and QR
    const url = buildAccessUrl(link.accessToken);
    const qrDataUrl = await generateQRDataURL(url);
    return { ok: true, data: { url, qrDataUrl } };
  }

  // Activate the kuesioner
  await db
    .update(pplKuesionerLink)
    .set({
      isActive: true,
      activatedAt: new Date(),
      deactivatedAt: null,
    })
    .where(eq(pplKuesionerLink.id, link.id));

  const url = buildAccessUrl(link.accessToken);
  const qrDataUrl = await generateQRDataURL(url);

  revalidatePath("/ppl-evaluasi");
  revalidatePath(`/ppl-evaluasi/${kegiatanId}`);
  return { ok: true, data: { url, qrDataUrl } };
}

// â”€â”€â”€ GET TEMPLATE FOR KEGIATAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getTemplateForKegiatan(kegiatanId: number) {
  await requirePermission("pplEvaluasi", "manage");

  // Find the link for this kegiatan
  const [link] = await db
    .select({
      id: pplKuesionerLink.id,
      templateId: pplKuesionerLink.templateId,
    })
    .from(pplKuesionerLink)
    .where(eq(pplKuesionerLink.kegiatanId, kegiatanId))
    .limit(1);

  if (!link) {
    return null;
  }

  // Get the template
  const [template] = await db
    .select({
      id: pplKuesionerTemplate.id,
      nama: pplKuesionerTemplate.nama,
      configJson: pplKuesionerTemplate.configJson,
      createdAt: pplKuesionerTemplate.createdAt,
      updatedAt: pplKuesionerTemplate.updatedAt,
    })
    .from(pplKuesionerTemplate)
    .where(eq(pplKuesionerTemplate.id, link.templateId))
    .limit(1);

  if (!template) {
    return null;
  }

  // Check if template is locked (has responses)
  const [responseCount] = await db
    .select({ count: count() })
    .from(pplKuesionerResponse)
    .where(eq(pplKuesionerResponse.linkId, link.id));

  return {
    id: template.id,
    nama: template.nama,
    fields: template.configJson,
    isLocked: (responseCount?.count ?? 0) > 0,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

// â”€â”€â”€ DEACTIVATE KUESIONER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function deactivateKuesioner(
  kegiatanId: number,
): Promise<ActionResult> {
  await requirePermission("pplEvaluasi", "manage");

  // Find the link for this kegiatan
  const [link] = await db
    .select({
      id: pplKuesionerLink.id,
      isActive: pplKuesionerLink.isActive,
    })
    .from(pplKuesionerLink)
    .where(eq(pplKuesionerLink.kegiatanId, kegiatanId))
    .limit(1);

  if (!link) {
    return {
      ok: false,
      error: "Kegiatan belum memiliki kuesioner yang terhubung",
    };
  }

  if (!link.isActive) {
    return { ok: true }; // Already deactivated
  }

  await db
    .update(pplKuesionerLink)
    .set({
      isActive: false,
      deactivatedAt: new Date(),
    })
    .where(eq(pplKuesionerLink.id, link.id));

  revalidatePath("/ppl-evaluasi");
  revalidatePath(`/ppl-evaluasi/${kegiatanId}`);
  return { ok: true };
}

// ─── LIST ALL TEMPLATES ──────────────────────────────────────────────────────

export interface TemplateListRow {
  id: number;
  nama: string;
  fieldCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  linkedKegiatanCount: number;
}

export async function listTemplates(): Promise<TemplateListRow[]> {
  await requirePermission("pplEvaluasi", "manage");

  const templates = await db
    .select({
      id: pplKuesionerTemplate.id,
      nama: pplKuesionerTemplate.nama,
      configJson: pplKuesionerTemplate.configJson,
      createdAt: pplKuesionerTemplate.createdAt,
      updatedAt: pplKuesionerTemplate.updatedAt,
    })
    .from(pplKuesionerTemplate)
    .orderBy(pplKuesionerTemplate.updatedAt);

  // Count linked kegiatan per template
  const linkCounts = await db
    .select({
      templateId: pplKuesionerLink.templateId,
      count: count(),
    })
    .from(pplKuesionerLink)
    .groupBy(pplKuesionerLink.templateId);

  const linkCountMap = new Map(linkCounts.map((r) => [r.templateId, r.count]));

  return templates.map((t) => ({
    id: t.id,
    nama: t.nama,
    fieldCount: Array.isArray(t.configJson) ? t.configJson.length : 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    linkedKegiatanCount: linkCountMap.get(t.id) ?? 0,
  }));
}
