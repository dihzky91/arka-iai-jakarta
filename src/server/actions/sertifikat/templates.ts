"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { imageSize } from "image-size";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  auditLog,
  certificateTemplates,
  type TemplateFieldMap,
} from "@/server/db/schema";
import { requirePermission } from "../auth";

const kategoriValues = ["Workshop", "Brevet AB", "Brevet C", "BFA", "Lainnya"] as const;
const fontFamilies = ["Helvetica", "Times-Roman", "Courier"] as const;
const alignValues = ["left", "center", "right"] as const;

const idSchema = z.coerce.number().int().positive();
const templateInputSchema = z.object({
  nama: z.string().trim().min(1, "Nama template wajib diisi.").max(200),
  kategori: z.enum(kategoriValues),
});

const positionSchema = z.object({
  enabled: z.boolean(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100).optional(),
  fontSize: z.number().min(8).max(72),
  fontWeight: z.enum(["normal", "bold"]),
  fontStyle: z.enum(["normal", "italic"]),
  fontFamily: z.enum(fontFamilies),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Warna harus dalam format hex #RRGGBB."),
  align: z.enum(alignValues),
});

const fieldPositionsSchema = z.record(positionSchema);

const updateTemplateSchema = z.object({
  nama: z.string().trim().min(1).max(200).optional(),
  kategori: z.enum(kategoriValues).optional(),
  fieldPositions: fieldPositionsSchema.optional(),
  isActive: z.boolean().optional(),
});

export type TemplateRow = typeof certificateTemplates.$inferSelect;

export async function listTemplates(filters: {
  kategori?: string;
  isActive?: boolean;
} = {}): Promise<TemplateRow[]> {
  await requirePermission("sertifikat", "configure");

  const conditions = [];
  if (filters.kategori && kategoriValues.includes(filters.kategori as (typeof kategoriValues)[number])) {
    conditions.push(eq(certificateTemplates.kategori, filters.kategori as (typeof kategoriValues)[number]));
  }
  if (filters.isActive !== undefined) {
    conditions.push(eq(certificateTemplates.isActive, filters.isActive));
  }

  return db
    .select()
    .from(certificateTemplates)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(certificateTemplates.kategori), asc(certificateTemplates.nama));
}

export async function getTemplate(id: number): Promise<TemplateRow | null> {
  await requirePermission("sertifikat", "configure");
  const parsedId = idSchema.parse(id);
  const [row] = await db
    .select()
    .from(certificateTemplates)
    .where(eq(certificateTemplates.id, parsedId))
    .limit(1);
  return row ?? null;
}

function normalizeUpload(file: File) {
  const mime = file.type;
  if (mime !== "image/png" && mime !== "image/jpeg") {
    throw new Error("File template harus PNG atau JPG.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Ukuran file template maksimal 2 MB.");
  }
  const extension = mime === "image/png" ? "png" : "jpg";
  return { mime, extension };
}

function validateDimensions(width?: number, height?: number) {
  if (!width || !height) throw new Error("Dimensi gambar tidak dapat dibaca.");
  if (width < 1000 || width > 3000 || height < 1000 || height > 3000) {
    throw new Error("Dimensi gambar harus berada di antara 1000 sampai 3000 piksel.");
  }
}

export async function createTemplate(input: {
  nama: string;
  kategori: string;
  formData: FormData;
}): Promise<{ ok: true; data: TemplateRow } | { ok: false; error: string }> {
  const parsed = templateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data template tidak valid." };
  }

  const session = await requirePermission("sertifikat", "configure");
  const file = input.formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Gambar template wajib diunggah." };
  }

  try {
    const { extension } = normalizeUpload(file);
    const buffer = Buffer.from(await file.arrayBuffer());
    const dimensions = imageSize(buffer);
    validateDimensions(dimensions.width, dimensions.height);

    const filename = `${crypto.randomUUID()}.${extension}`;
    const publicDir = path.join(process.cwd(), "public", "templates");
    await mkdir(publicDir, { recursive: true });
    // TODO: Migrasikan penyimpanan template ke Cloudinary setelah alur upload diverifikasi end-to-end.
    await writeFile(path.join(publicDir, filename), buffer);

    const [row] = await db
      .insert(certificateTemplates)
      .values({
        nama: parsed.data.nama,
        kategori: parsed.data.kategori,
        imageUrl: `/templates/${filename}`,
        imageWidth: dimensions.width!,
        imageHeight: dimensions.height!,
        fieldPositions: {},
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning();

    if (!row) throw new Error("Gagal membuat template.");

    await writeAuditLog({
      userId: session.user.id,
      aksi: "CREATE_CERTIFICATE_TEMPLATE",
      entitasType: "sertifikat_template",
      entitasId: String(row.id),
      detail: { nama: row.nama, kategori: row.kategori },
    });

    revalidatePath("/sertifikat/template");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gagal mengunggah template.",
    };
  }
}

export async function updateTemplate(
  id: number,
  input: {
    nama?: string;
    kategori?: string;
    fieldPositions?: TemplateFieldMap;
    isActive?: boolean;
  },
): Promise<{ ok: true; data: TemplateRow } | { ok: false; error: string }> {
  const parsedId = idSchema.parse(id);
  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data template tidak valid." };
  }

  const session = await requirePermission("sertifikat", "configure");
  const [row] = await db
    .update(certificateTemplates)
    .set({
      ...parsed.data,
      fieldPositions: parsed.data.fieldPositions as TemplateFieldMap | undefined,
      updatedAt: new Date(),
    })
    .where(eq(certificateTemplates.id, parsedId))
    .returning();

  if (!row) return { ok: false, error: "Template tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_CERTIFICATE_TEMPLATE",
    entitasType: "sertifikat_template",
    entitasId: String(parsedId),
    detail: { nama: row.nama, kategori: row.kategori },
  });

  revalidatePath("/sertifikat/template");
  revalidatePath("/sertifikat/kegiatan");
  return { ok: true, data: row };
}

export async function deleteTemplate(id: number): Promise<{ ok: true; data: TemplateRow } | { ok: false; error: string }> {
  const parsedId = idSchema.parse(id);
  const session = await requirePermission("sertifikat", "configure");

  const [row] = await db
    .update(certificateTemplates)
    .set({ isActive: false, isDefault: false, updatedAt: new Date() })
    .where(eq(certificateTemplates.id, parsedId))
    .returning();

  if (!row) return { ok: false, error: "Template tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_CERTIFICATE_TEMPLATE",
    entitasType: "sertifikat_template",
    entitasId: String(parsedId),
    detail: { nama: row.nama, kategori: row.kategori },
  });

  revalidatePath("/sertifikat/template");
  return { ok: true, data: row };
}

export async function setDefaultTemplate(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsedId = idSchema.parse(id);
  const session = await requirePermission("sertifikat", "configure");

  const [selected] = await db
    .select({
      id: certificateTemplates.id,
      nama: certificateTemplates.nama,
      kategori: certificateTemplates.kategori,
    })
    .from(certificateTemplates)
    .where(and(eq(certificateTemplates.id, parsedId), eq(certificateTemplates.isActive, true)))
    .limit(1);

  if (!selected) return { ok: false, error: "Template aktif tidak ditemukan." };

  await db.transaction(async (tx) => {
    await tx
      .update(certificateTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(certificateTemplates.kategori, selected.kategori));
    await tx
      .update(certificateTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(certificateTemplates.id, selected.id));
  });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "SET_DEFAULT_CERTIFICATE_TEMPLATE",
    entitasType: "sertifikat_template",
    entitasId: String(selected.id),
    detail: { nama: selected.nama, kategori: selected.kategori },
  });

  revalidatePath("/sertifikat/template");
  return { ok: true };
}
