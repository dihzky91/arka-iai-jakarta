"use server";

import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { kuitansi, kuitansiCounter, auditLog } from "@/server/db/schema";
import { writeAuditLog } from "@/server/lib/audit";
import { requirePermission, requireSession } from "@/server/actions/auth";
import { allocateNomorKuitansi } from "@/lib/nomor-kuitansi";
import { parseIsoDateInJakarta } from "@/lib/utils";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

const createKuitansiSchema = z.object({
  tanggalKuitansi: z.string().min(1, "Tanggal kuitansi wajib diisi."),
  diterimaDari: z.string().min(1, "Diterima dari wajib diisi.").max(300),
  uraian: z.string().min(1, "Uraian wajib diisi."),
  jumlah: z.string().min(1, "Jumlah wajib diisi."),
  terbilang: z.string().optional(),
  untukPembayaran: z.string().min(1, "Untuk pembayaran wajib diisi.").max(300),
  catatan: z.string().optional(),
  pejabatId: z.number().int().positive().optional(),
});

const updateKuitansiSchema = createKuitansiSchema.extend({
  id: z.string().min(1),
});

const idSchema = z.object({ id: z.string().min(1) });

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type KuitansiRow = {
  id: string;
  nomorKuitansi: string | null;
  tanggalKuitansi: string;
  diterimaDari: string;
  uraian: string;
  jumlah: string;
  terbilang: string | null;
  untukPembayaran: string;
  catatan: string | null;
  status: string | null;
  fileUrl: string | null;
  dibuatOleh: string | null;
  pejabatId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type KuitansiCounterRow = {
  id: number;
  tahun: number;
  bulan: number;
  counter: number;
  prefix: string | null;
  updatedAt: Date | null;
};

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export async function listKuitansi(): Promise<KuitansiRow[]> {
  await requireSession();
  const rows = await db
    .select()
    .from(kuitansi)
    .orderBy(desc(kuitansi.createdAt))
    .limit(200);
  return rows as KuitansiRow[];
}

export async function getKuitansi(id: string) {
  await requireSession();
  const [row] = await db
    .select()
    .from(kuitansi)
    .where(eq(kuitansi.id, id));
  return row as KuitansiRow | undefined;
}

export async function listKuitansiCounters(): Promise<KuitansiCounterRow[]> {
  await requireSession();
  return db
    .select({
      id: kuitansiCounter.id,
      tahun: kuitansiCounter.tahun,
      bulan: kuitansiCounter.bulan,
      counter: kuitansiCounter.counter,
      prefix: kuitansiCounter.prefix,
      updatedAt: kuitansiCounter.updatedAt,
    })
    .from(kuitansiCounter)
    .orderBy(
      desc(kuitansiCounter.tahun),
      desc(kuitansiCounter.bulan),
      desc(kuitansiCounter.updatedAt),
    )
    .limit(200) as Promise<KuitansiCounterRow[]>;
}

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export async function createKuitansi(input: unknown) {
  const parsed = createKuitansiSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const session = await requirePermission("kuitansi", "create");

  const [row] = await db
    .insert(kuitansi)
    .values({
      tanggalKuitansi: parsed.data.tanggalKuitansi,
      diterimaDari: parsed.data.diterimaDari,
      uraian: parsed.data.uraian,
      jumlah: parsed.data.jumlah,
      terbilang: parsed.data.terbilang,
      untukPembayaran: parsed.data.untukPembayaran,
      catatan: parsed.data.catatan,
      pejabatId: parsed.data.pejabatId,
      dibuatOleh: session.user.id,
      status: "draft",
    })
    .returning({ id: kuitansi.id });

  if (!row) {
    return { ok: false as const, error: "Gagal membuat kuitansi." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_KUITANSI",
    entitasType: "kuitansi",
    entitasId: row.id,
    detail: {
      diterimaDari: parsed.data.diterimaDari,
      untukPembayaran: parsed.data.untukPembayaran,
    },
  });

  revalidatePath("/kuitansi");
  return { ok: true as const, id: row.id };
}

export async function updateKuitansi(input: unknown) {
  const parsed = updateKuitansiSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const session = await requirePermission("kuitansi", "update");

  const [existing] = await db
    .select({ status: kuitansi.status })
    .from(kuitansi)
    .where(eq(kuitansi.id, parsed.data.id));

  if (!existing) {
    return { ok: false as const, error: "Kuitansi tidak ditemukan." };
  }

  if (existing.status === "terbit") {
    return {
      ok: false as const,
      error: "Kuitansi yang sudah terbit tidak dapat diubah.",
    };
  }

  const [updated] = await db
    .update(kuitansi)
    .set({
      tanggalKuitansi: parsed.data.tanggalKuitansi,
      diterimaDari: parsed.data.diterimaDari,
      uraian: parsed.data.uraian,
      jumlah: parsed.data.jumlah,
      terbilang: parsed.data.terbilang,
      untukPembayaran: parsed.data.untukPembayaran,
      catatan: parsed.data.catatan,
      pejabatId: parsed.data.pejabatId,
      updatedAt: new Date(),
    })
    .where(eq(kuitansi.id, parsed.data.id))
    .returning({ id: kuitansi.id });

  if (!updated) {
    return { ok: false as const, error: "Gagal memperbarui kuitansi." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_KUITANSI",
    entitasType: "kuitansi",
    entitasId: parsed.data.id,
    detail: { diterimaDari: parsed.data.diterimaDari },
  });

  revalidatePath("/kuitansi");
  revalidatePath(`/kuitansi/${parsed.data.id}`);
  return { ok: true as const };
}

export async function assignNomorKuitansi(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("kuitansi", "assign");

  const [kwt] = await db
    .select({
      nomorKuitansi: kuitansi.nomorKuitansi,
      tanggalKuitansi: kuitansi.tanggalKuitansi,
      status: kuitansi.status,
    })
    .from(kuitansi)
    .where(eq(kuitansi.id, id));

  if (!kwt) {
    return { ok: false as const, error: "Kuitansi tidak ditemukan." };
  }

  if (kwt.nomorKuitansi) {
    return { ok: false as const, error: "Nomor kuitansi sudah digenerate." };
  }

  if (kwt.status !== "draft") {
    return {
      ok: false as const,
      error: "Nomor kuitansi hanya bisa digenerate saat status Draft.",
    };
  }

  const tanggal = parseIsoDateInJakarta(kwt.tanggalKuitansi);
  const bulan = tanggal.getMonth() + 1;
  const tahun = tanggal.getFullYear();

  const result = await allocateNomorKuitansi({ tahun, bulan });
  const nomorKuitansi = result.nomorKuitansi;

  const updated = await db
    .update(kuitansi)
    .set({ nomorKuitansi, status: "terbit", updatedAt: new Date() })
    .where(and(eq(kuitansi.id, id), sql`${kuitansi.nomorKuitansi} IS NULL`))
    .returning({ id: kuitansi.id });

  if (!updated[0]) {
    return {
      ok: false as const,
      error: "Nomor kuitansi gagal disimpan karena data berubah. Coba muat ulang.",
    };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "ASSIGN_NOMOR_KUITANSI",
    entitasType: "kuitansi",
    entitasId: id,
    detail: { nomorKuitansi },
  });

  revalidatePath("/kuitansi");
  revalidatePath(`/kuitansi/${id}`);
  return { ok: true as const, nomorKuitansi };
}

export async function batalkanKuitansi(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("kuitansi", "delete");

  const [kwt] = await db
    .select({ status: kuitansi.status })
    .from(kuitansi)
    .where(eq(kuitansi.id, id));

  if (!kwt) {
    return { ok: false as const, error: "Kuitansi tidak ditemukan." };
  }

  if (kwt.status === "dibatalkan") {
    return { ok: false as const, error: "Kuitansi sudah dibatalkan." };
  }

  await db
    .update(kuitansi)
    .set({ status: "dibatalkan", updatedAt: new Date() })
    .where(eq(kuitansi.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "BATALKAN_KUITANSI",
    entitasType: "kuitansi",
    entitasId: id,
  });

  revalidatePath("/kuitansi");
  revalidatePath(`/kuitansi/${id}`);
  return { ok: true as const };
}

export async function deleteKuitansi(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("kuitansi", "delete");

  const [kwt] = await db
    .select({ status: kuitansi.status, nomorKuitansi: kuitansi.nomorKuitansi })
    .from(kuitansi)
    .where(eq(kuitansi.id, id));

  if (!kwt) {
    return { ok: false as const, error: "Kuitansi tidak ditemukan." };
  }

  if (kwt.status === "terbit") {
    return {
      ok: false as const,
      error: "Kuitansi yang sudah terbit tidak dapat dihapus. Batalkan terlebih dahulu.",
    };
  }

  await db.delete(kuitansi).where(eq(kuitansi.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_KUITANSI",
    entitasType: "kuitansi",
    entitasId: id,
    detail: { nomorKuitansi: kwt.nomorKuitansi },
  });

  revalidatePath("/kuitansi");
  return { ok: true as const };
}

export async function updateKuitansiCounterPrefix(input: {
  id: number;
  prefix: string;
}) {
  const session = await requirePermission("kuitansi", "manage");

  const [row] = await db
    .update(kuitansiCounter)
    .set({ prefix: input.prefix, updatedAt: new Date() })
    .where(eq(kuitansiCounter.id, input.id))
    .returning();

  if (!row) {
    return { ok: false as const, error: "Counter kuitansi tidak ditemukan." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PREFIX_KUITANSI",
    entitasType: "kuitansi_counter",
    entitasId: String(input.id),
    detail: { prefix: input.prefix },
  });

  revalidatePath("/kuitansi");
  return { ok: true as const, data: row };
}
