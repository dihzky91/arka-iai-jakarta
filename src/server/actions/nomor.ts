"use server";

import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { nomorSuratCounter } from "@/server/db/schema";
import { allocateNomorSurat } from "@/lib/nomor-surat";
import { resolveNomorSuratParams } from "@/lib/nomor-surat-helpers";
import { requirePermission, requireSession } from "./auth";

const generateNomorSchema = z.object({
  jenisSurat: z.string().min(1),
  bulan: z.number().int().min(1).max(12),
  tahun: z.number().int().min(2020).max(2100),
});

const generateBulkNomorSchema = generateNomorSchema.extend({
  jumlah: z.number().int().min(1).max(100),
});

export type NomorSuratCounterRow = {
  id: number;
  tahun: number;
  bulan: number;
  counter: number;
  updatedAt: Date | null;
};

export async function listNomorSuratCounters(): Promise<NomorSuratCounterRow[]> {
  await requireSession();
  return db
    .select({
      id: nomorSuratCounter.id,
      tahun: nomorSuratCounter.tahun,
      bulan: nomorSuratCounter.bulan,
      counter: nomorSuratCounter.counter,
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
// Format final: "{counter}/{kodeJenis}/{prefixOrganisasi}/{bulanRomawi}/{tahun}"
export async function generateNomorSurat(input: unknown) {
  const data = generateNomorSchema.parse(input);
  const session = await requirePermission("nomor", "generate");

  const { kodeJenis, prefixOrganisasi } = await resolveNomorSuratParams(data.jenisSurat);

  const result = await allocateNomorSurat({
    tahun: data.tahun,
    bulan: data.bulan,
    kodeJenis,
    prefixOrganisasi,
  });
  const nomor = result.nomorList[0];
  if (!nomor) {
    throw new Error("Gagal menggenerate nomor surat");
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "GENERATE_NOMOR_SURAT",
    entitasType: "nomor_surat_counter",
    entitasId: `${data.tahun}-${data.bulan}`,
    detail: { nomor },
  });

  return {
    nomor,
    counter: result.endCounter,
    kodeJenis: result.kodeJenis,
    prefixOrganisasi: result.prefixOrganisasi,
    bulanRomawi: result.bulanRomawi,
    tahun: result.tahun,
  };
}

export async function generateBulkNomorSurat(input: unknown) {
  const data = generateBulkNomorSchema.parse(input);
  const session = await requirePermission("nomor", "generate");

  const { kodeJenis, prefixOrganisasi } = await resolveNomorSuratParams(data.jenisSurat);

  const result = await allocateNomorSurat({
    tahun: data.tahun,
    bulan: data.bulan,
    kodeJenis,
    prefixOrganisasi,
    jumlah: data.jumlah,
  });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "GENERATE_BULK_NOMOR_SURAT",
    entitasType: "nomor_surat_counter",
    entitasId: `${data.tahun}-${data.bulan}`,
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
