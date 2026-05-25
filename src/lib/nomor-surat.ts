import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { formatBulanRomawi } from "@/lib/utils";

type DbExecutor = Pick<typeof db, "execute">;

type AllocateNomorSuratInput = {
  tahun: number;
  bulan: number;
  kodeJenis: string;
  prefixOrganisasi: string;
  jumlah?: number;
};

export type AllocateNomorSuratResult = {
  nomorList: string[];
  kodeJenis: string;
  prefixOrganisasi: string;
  bulanRomawi: string;
  tahun: number;
  startCounter: number;
  endCounter: number;
  jumlah: number;
};

export async function allocateNomorSurat(
  input: AllocateNomorSuratInput,
  executor: DbExecutor = db,
): Promise<AllocateNomorSuratResult> {
  const jumlah = input.jumlah ?? 1;

  const upsert = await executor.execute(sql`
    INSERT INTO nomor_surat_counter (tahun, bulan, counter, updated_at)
    VALUES (${input.tahun}, ${input.bulan}, ${jumlah}, NOW())
    ON CONFLICT (tahun, bulan)
    DO UPDATE SET
      counter = nomor_surat_counter.counter + ${jumlah},
      updated_at = NOW()
    RETURNING counter
  `);

  const row = (upsert.rows as { counter: number }[])[0];
  if (!row) {
    throw new Error(
      jumlah > 1 ? "Gagal menggenerate bulk nomor surat" : "Gagal menggenerate nomor surat",
    );
  }

  const endCounter = row.counter;
  const startCounter = endCounter - jumlah + 1;
  const bulanRomawi = formatBulanRomawi(input.bulan);

  const nomorList = Array.from({ length: jumlah }, (_, index) => {
    const counter = startCounter + index;
    return `${counter}/${input.kodeJenis}/${input.prefixOrganisasi}/${bulanRomawi}/${input.tahun}`;
  });

  return {
    nomorList,
    kodeJenis: input.kodeJenis,
    prefixOrganisasi: input.prefixOrganisasi,
    bulanRomawi,
    tahun: input.tahun,
    startCounter,
    endCounter,
    jumlah,
  };
}
