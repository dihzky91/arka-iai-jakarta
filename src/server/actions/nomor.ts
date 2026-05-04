"use server";

import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { nomorSuratCounter, auditLog } from "@/server/db/schema";
import { jenisSuratValues } from "@/lib/jenis-surat";
import { allocateNomorSurat } from "@/lib/nomor-surat";
import { requirePermission, requireSession } from "./auth";

const generateNomorSchema = z.object({
  jenisSurat: z.enum(jenisSuratValues),
  bulan: z.number().int().min(1).max(12),
  tahun: z.number().int().min(2020).max(2100),
  prefixOverride: z.string().max(80).optional(),
});

const generateBulkNomorSchema = generateNomorSchema.extend({
  jumlah: z.number().int().min(1).max(100),
});

const updatePrefixSchema = z.object({
  id: z.number().int().positive(),
  prefix: z.string().min(1, "Prefix wajib diisi.").max(80),
});

export type NomorSuratCounterRow = {
  id: number;
  tahun: number;
  bulan: number;
  jenisSurat: string;
  counter: number;
  prefix: string | null;
  updatedAt: Date | null;
};

export async function listNomorSuratCounters(): Promise<NomorSuratCounterRow[]> {
  await requireSession();
  return db
    .select({
      id: nomorSuratCounter.id,
      tahun: nomorSuratCounter.tahun,
      bulan: nomorSuratCounter.bulan,
      jenisSurat: nomorSuratCounter.jenisSurat,
      counter: nomorSuratCounter.counter,
      prefix: nomorSuratCounter.prefix,
      updatedAt: nomorSuratCounter.updatedAt,
    })
    .from(nomorSuratCounter)
    .orderBy(
      desc(nomorSuratCounter.tahun),
      desc(nomorSuratCounter.bulan),
      desc(nomorSuratCounter.updatedAt),
    )
    .limit(200);
}

// Generate nomor surat atomic.
// Format final: "{counter}/{prefix}/{bulanRomawi}/{tahun}"
// WAJIB: pakai DB transaction + SELECT FOR UPDATE untuk mencegah race condition
export async function generateNomorSurat(input: unknown) {
  const data = generateNomorSchema.parse(input);
  const session = await requirePermission("nomor", "generate");

  const result = await allocateNomorSurat({
    tahun: data.tahun,
    bulan: data.bulan,
    jenisSurat: data.jenisSurat,
    prefixOverride: data.prefixOverride,
  });
  const nomor = result.nomorList[0];
  if (!nomor) {
    throw new Error("Gagal menggenerate nomor surat");
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "GENERATE_NOMOR_SURAT",
    entitasType: "nomor_surat_counter",
    entitasId: `${data.tahun}-${data.bulan}-${data.jenisSurat}`,
    detail: { nomor },
  });

  return {
    nomor,
    counter: result.endCounter,
    prefix: result.prefix,
    bulanRomawi: result.bulanRomawi,
    tahun: result.tahun,
  };
}

export async function generateBulkNomorSurat(input: unknown) {
  const data = generateBulkNomorSchema.parse(input);
  const session = await requirePermission("nomor", "generate");

  const result = await allocateNomorSurat({
    tahun: data.tahun,
    bulan: data.bulan,
    jenisSurat: data.jenisSurat,
    jumlah: data.jumlah,
    prefixOverride: data.prefixOverride,
  });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "GENERATE_BULK_NOMOR_SURAT",
    entitasType: "nomor_surat_counter",
    entitasId: `${data.tahun}-${data.bulan}-${data.jenisSurat}`,
    detail: {
      jumlah: result.jumlah,
      startCounter: result.startCounter,
      endCounter: result.endCounter,
      nomorAwal: result.nomorList[0],
      nomorAkhir: result.nomorList[result.nomorList.length - 1],
    },
  });

  return result;
}

export async function updateNomorSuratCounterPrefix(input: unknown) {
  const data = updatePrefixSchema.parse(input);
  const session = await requirePermission("nomor", "update");

  const [row] = await db
    .update(nomorSuratCounter)
    .set({
      prefix: data.prefix,
      updatedAt: new Date(),
    })
    .where(eq(nomorSuratCounter.id, data.id))
    .returning();

  if (!row) {
    return { ok: false as const, error: "Counter nomor surat tidak ditemukan." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PREFIX_NOMOR_SURAT",
    entitasType: "nomor_surat_counter",
    entitasId: String(data.id),
    detail: { prefix: data.prefix },
  });

  return { ok: true as const, data: row };
}
