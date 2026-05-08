import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { formatBulanRomawi } from "@/lib/utils";

const DEFAULT_PREFIX = "KWT";
type DbExecutor = Pick<typeof db, "execute">;

type AllocateNomorKuitansiInput = {
  tahun: number;
  bulan: number;
  prefixOverride?: string;
};

export type AllocateNomorKuitansiResult = {
  nomorKuitansi: string;
  prefix: string;
  counter: number;
  bulanRomawi: string;
  tahun: number;
};

export async function allocateNomorKuitansi(
  input: AllocateNomorKuitansiInput,
  executor: DbExecutor = db,
): Promise<AllocateNomorKuitansiResult> {
  const prefixCandidate = input.prefixOverride ?? DEFAULT_PREFIX;

  const upsert = await executor.execute(sql`
    INSERT INTO kuitansi_counter (tahun, bulan, counter, prefix, updated_at)
    VALUES (${input.tahun}, ${input.bulan}, 1, ${prefixCandidate}, NOW())
    ON CONFLICT (tahun, bulan)
    DO UPDATE SET
      counter = kuitansi_counter.counter + 1,
      prefix = COALESCE(${input.prefixOverride ?? null}, kuitansi_counter.prefix, ${DEFAULT_PREFIX}),
      updated_at = NOW()
    RETURNING counter, prefix
  `);

  const row = (upsert.rows as { counter: number; prefix: string | null }[])[0];
  if (!row) {
    throw new Error("Gagal menggenerate nomor kuitansi");
  }

  const prefix = row.prefix ?? DEFAULT_PREFIX;
  const bulanRomawi = formatBulanRomawi(input.bulan);
  const nomorKuitansi = `${row.counter}/${prefix}/${bulanRomawi}/${input.tahun}`;

  return {
    nomorKuitansi,
    prefix,
    counter: row.counter,
    bulanRomawi,
    tahun: input.tahun,
  };
}
