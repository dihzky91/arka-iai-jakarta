import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { kodeJenisSurat, systemSettings } from "@/server/db/schema";

const DEFAULT_PREFIX_ORGANISASI = "IAI-DKIJKT";

/**
 * Resolve kode jenis + prefix organisasi needed to allocate a nomor surat.
 * Throws with a clear message if kode jenis belum dikonfigurasi.
 */
export async function resolveNomorSuratParams(jenisSurat: string): Promise<{
  kodeJenis: string;
  prefixOrganisasi: string;
}> {
  // Lookup kode jenis
  const [kodeRow] = await db
    .select({ kode: kodeJenisSurat.kode })
    .from(kodeJenisSurat)
    .where(eq(kodeJenisSurat.jenisSurat, jenisSurat as typeof kodeJenisSurat.$inferInsert.jenisSurat))
    .limit(1);

  if (!kodeRow) {
    throw new Error(
      `Kode jenis untuk "${jenisSurat}" belum dikonfigurasi. Atur terlebih dahulu di halaman Nomor Surat.`,
    );
  }

  // Lookup prefix organisasi from system_settings
  const [settingsRow] = await db
    .select({ prefixOrganisasi: systemSettings.prefixOrganisasi })
    .from(systemSettings)
    .limit(1);

  const prefixOrganisasi = settingsRow?.prefixOrganisasi ?? DEFAULT_PREFIX_ORGANISASI;

  return {
    kodeJenis: kodeRow.kode,
    prefixOrganisasi,
  };
}
