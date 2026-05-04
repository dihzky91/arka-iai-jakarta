"use server";

import { asc, eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { jadwalUjianConfig, auditLog } from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";

export type ConfigJenis = "program" | "tipe" | "mode";

export type ConfigRow = {
  id: string;
  jenis: string;
  nilai: string;
  urutan: number;
  createdAt: Date;
};

// Nilai default yang akan di-seed jika tabel kosong
const DEFAULTS: Record<ConfigJenis, string[]> = {
  program: ["Brevet AB", "Brevet C", "BFA", "Lainnya"],
  tipe: ["Reguler Pagi", "Reguler Siang", "Reguler Sore", "Weekend"],
  mode: ["Offline", "Online"],
};

async function seedDefaults(jenis: ConfigJenis) {
  const values = DEFAULTS[jenis].map((nilai, i) => ({
    id: nanoid(),
    jenis,
    nilai,
    urutan: i,
  }));
  await db.insert(jadwalUjianConfig).values(values).onConflictDoNothing();
}

export async function getKonfigByJenis(jenis: ConfigJenis): Promise<string[]> {
  await requireSession();
  let rows = await db
    .select({ nilai: jadwalUjianConfig.nilai })
    .from(jadwalUjianConfig)
    .where(eq(jadwalUjianConfig.jenis, jenis))
    .orderBy(asc(jadwalUjianConfig.urutan), asc(jadwalUjianConfig.nilai));

  if (rows.length === 0) {
    await seedDefaults(jenis);
    rows = await db
      .select({ nilai: jadwalUjianConfig.nilai })
      .from(jadwalUjianConfig)
      .where(eq(jadwalUjianConfig.jenis, jenis))
      .orderBy(asc(jadwalUjianConfig.urutan), asc(jadwalUjianConfig.nilai));
  }
  return rows.map((r) => r.nilai);
}

export async function getAllKonfig(): Promise<Record<ConfigJenis, string[]>> {
  await requireSession();

  for (const jenis of ["program", "tipe", "mode"] as ConfigJenis[]) {
    const count = await db
      .select({ nilai: jadwalUjianConfig.nilai })
      .from(jadwalUjianConfig)
      .where(eq(jadwalUjianConfig.jenis, jenis));
    if (count.length === 0) await seedDefaults(jenis);
  }

  const rows = await db
    .select()
    .from(jadwalUjianConfig)
    .orderBy(asc(jadwalUjianConfig.urutan), asc(jadwalUjianConfig.nilai));

  const result: Record<ConfigJenis, string[]> = { program: [], tipe: [], mode: [] };
  for (const r of rows) {
    const jenis = r.jenis as ConfigJenis;
    if (jenis in result) result[jenis].push(r.nilai);
  }
  return result;
}

export async function listKonfig(): Promise<ConfigRow[]> {
  await requirePermission("jadwalUjian", "configure");
  const rows = await db
    .select()
    .from(jadwalUjianConfig)
    .orderBy(asc(jadwalUjianConfig.jenis), asc(jadwalUjianConfig.urutan), asc(jadwalUjianConfig.nilai));
  return rows;
}

const createSchema = z.object({
  jenis: z.enum(["program", "tipe", "mode"]),
  nilai: z.string().trim().min(1, "Nilai tidak boleh kosong").max(100),
});

export async function createKonfig(data: { jenis: ConfigJenis; nilai: string }) {
  const parsed = createSchema.parse(data);
  const session = await requirePermission("jadwalUjian", "configure");

  // Hitung urutan berikutnya
  const existing = await db
    .select({ urutan: jadwalUjianConfig.urutan })
    .from(jadwalUjianConfig)
    .where(eq(jadwalUjianConfig.jenis, parsed.jenis))
    .orderBy(asc(jadwalUjianConfig.urutan));
  const nextUrutan = existing.length > 0 ? (existing[existing.length - 1]?.urutan ?? 0) + 1 : 0;

  try {
    const id = nanoid();
    await db.insert(jadwalUjianConfig).values({
      id,
      jenis: parsed.jenis,
      nilai: parsed.nilai,
      urutan: nextUrutan,
    });

    await writeAuditLog({
      userId: session.user.id,
      aksi: "CREATE_KONFIG_JADWAL",
      entitasType: "jadwal_ujian_config",
      entitasId: id,
      detail: { jenis: parsed.jenis, nilai: parsed.nilai },
    });

    revalidatePath("/jadwal-ujian/pengaturan");
    revalidatePath("/jadwal-ujian/kelas");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof Error && err.message.includes("uniq_config_jenis_nilai")) {
      return { ok: false as const, error: `"${parsed.nilai}" sudah ada di daftar ${parsed.jenis}.` };
    }
    throw err;
  }
}

export async function deleteKonfig(id: string) {
  const session = await requirePermission("jadwalUjian", "configure");

  const row = await db
    .select()
    .from(jadwalUjianConfig)
    .where(eq(jadwalUjianConfig.id, id));
  if (!row[0]) return { ok: false as const, error: "Konfigurasi tidak ditemukan." };

  // Minimal harus ada 1 nilai per jenis
  const sibling = await db
    .select({ id: jadwalUjianConfig.id })
    .from(jadwalUjianConfig)
    .where(and(eq(jadwalUjianConfig.jenis, row[0].jenis)));

  if (sibling.length <= 1) {
    return { ok: false as const, error: `Minimal harus ada 1 nilai untuk ${row[0].jenis}.` };
  }

  await db.delete(jadwalUjianConfig).where(eq(jadwalUjianConfig.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_KONFIG_JADWAL",
    entitasType: "jadwal_ujian_config",
    entitasId: id,
    detail: { jenis: row[0].jenis, nilai: row[0].nilai },
  });

  revalidatePath("/jadwal-ujian/pengaturan");
  revalidatePath("/jadwal-ujian/kelas");
  return { ok: true as const };
}
