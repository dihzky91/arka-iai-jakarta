"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { kodeJenisSurat } from "@/server/db/schema";
import { jenisSuratValues } from "@/lib/jenis-surat";
import { requirePermission, requireSession } from "./auth";

// ─── Types ──────────────────────────────────────────────────────────────────

export type KodeJenisSuratRow = {
  id: number;
  jenisSurat: string;
  kode: string;
  keterangan: string | null;
  updatedAt: Date | null;
};

// ─── Schemas ────────────────────────────────────────────────────────────────

const createSchema = z.object({
  jenisSurat: z.enum(jenisSuratValues),
  kode: z
    .string()
    .trim()
    .min(1, "Kode wajib diisi.")
    .max(20, "Kode maksimal 20 karakter."),
  keterangan: z.string().trim().max(200).optional().or(z.literal("")),
});

const updateSchema = z.object({
  id: z.number().int().positive(),
  kode: z
    .string()
    .trim()
    .min(1, "Kode wajib diisi.")
    .max(20, "Kode maksimal 20 karakter."),
  keterangan: z.string().trim().max(200).optional().or(z.literal("")),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listKodeJenisSurat(): Promise<KodeJenisSuratRow[]> {
  await requireSession();
  const rows = await db
    .select()
    .from(kodeJenisSurat)
    .orderBy(kodeJenisSurat.jenisSurat);
  return rows;
}

/** Lookup kode for a given jenisSurat — returns null if not configured yet. */
export async function getKodeByJenisSurat(
  jenis: string,
): Promise<string | null> {
  const [row] = await db
    .select({ kode: kodeJenisSurat.kode })
    .from(kodeJenisSurat)
    .where(eq(kodeJenisSurat.jenisSurat, jenis as typeof kodeJenisSurat.$inferInsert.jenisSurat))
    .limit(1);
  return row?.kode ?? null;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createKodeJenisSurat(input: unknown) {
  const data = createSchema.parse(input);
  const session = await requirePermission("nomor", "generate");

  const [row] = await db
    .insert(kodeJenisSurat)
    .values({
      jenisSurat: data.jenisSurat,
      kode: data.kode,
      keterangan: data.keterangan || null,
    })
    .returning();

  if (!row) {
    return { ok: false as const, error: "Gagal membuat kode jenis surat." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_KODE_JENIS_SURAT",
    entitasType: "kode_jenis_surat",
    entitasId: String(row.id),
    detail: { jenisSurat: data.jenisSurat, kode: data.kode },
  });

  return { ok: true as const, data: row };
}

export async function updateKodeJenisSurat(input: unknown) {
  const data = updateSchema.parse(input);
  const session = await requirePermission("nomor", "generate");

  const [row] = await db
    .update(kodeJenisSurat)
    .set({
      kode: data.kode,
      keterangan: data.keterangan || null,
      updatedAt: new Date(),
    })
    .where(eq(kodeJenisSurat.id, data.id))
    .returning();

  if (!row) {
    return {
      ok: false as const,
      error: "Kode jenis surat tidak ditemukan.",
    };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_KODE_JENIS_SURAT",
    entitasType: "kode_jenis_surat",
    entitasId: String(data.id),
    detail: { kode: data.kode },
  });

  return { ok: true as const, data: row };
}

export async function deleteKodeJenisSurat(input: { id: number }) {
  const session = await requirePermission("nomor", "generate");

  const [row] = await db
    .delete(kodeJenisSurat)
    .where(eq(kodeJenisSurat.id, input.id))
    .returning({ id: kodeJenisSurat.id, jenisSurat: kodeJenisSurat.jenisSurat });

  if (!row) {
    return {
      ok: false as const,
      error: "Kode jenis surat tidak ditemukan.",
    };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_KODE_JENIS_SURAT",
    entitasType: "kode_jenis_surat",
    entitasId: String(row.id),
    detail: { jenisSurat: row.jenisSurat },
  });

  return { ok: true as const };
}
