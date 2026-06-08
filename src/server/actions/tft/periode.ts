"use server";

import { asc, desc, eq, sql, and, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { periodeTft, pendaftarTft } from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";
import {
  periodeTftCreateSchema,
  periodeTftUpdateSchema,
  type PeriodeTftCreateInput,
  type PeriodeTftUpdateInput,
} from "@/lib/validators/tft.schema";

export type PeriodeTftRow = {
  id: string;
  judul: string;
  slug: string;
  deskripsi: string | null;
  tanggalMulai: string;
  tanggalSelesai: string;
  waktuMulai: string | null;
  waktuSelesai: string | null;
  lokasi: string | null;
  batasPendaftaran: Date | null;
  status: "draft" | "buka" | "tutup" | "penilaian" | "selesai";
  program: "brevet_ab" | "brevet_c" | "all";
  maxPeserta: number | null;
  skorMinimum: string | null;
  catatanInternal: string | null;
  createdAt: Date;
  updatedAt: Date;
  jumlahPendaftar: number;
};

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export async function listPeriodeTft(): Promise<PeriodeTftRow[]> {
  await requireSession();

  const rows = await db
    .select({
      id: periodeTft.id,
      judul: periodeTft.judul,
      slug: periodeTft.slug,
      deskripsi: periodeTft.deskripsi,
      tanggalMulai: periodeTft.tanggalMulai,
      tanggalSelesai: periodeTft.tanggalSelesai,
      waktuMulai: periodeTft.waktuMulai,
      waktuSelesai: periodeTft.waktuSelesai,
      lokasi: periodeTft.lokasi,
      batasPendaftaran: periodeTft.batasPendaftaran,
      status: periodeTft.status,
      program: periodeTft.program,
      maxPeserta: periodeTft.maxPeserta,
      skorMinimum: periodeTft.skorMinimum,
      catatanInternal: periodeTft.catatanInternal,
      createdAt: periodeTft.createdAt,
      updatedAt: periodeTft.updatedAt,
      jumlahPendaftar: sql<number>`(
        SELECT COUNT(*)::int FROM pendaftar_tft WHERE pendaftar_tft.periode_id = ${periodeTft.id}
      )`.as("jumlah_pendaftar"),
    })
    .from(periodeTft)
    .orderBy(desc(periodeTft.createdAt));

  return rows as PeriodeTftRow[];
}

export async function getPeriodeTftById(id: string): Promise<PeriodeTftRow | null> {
  await requireSession();

  const rows = await db
    .select({
      id: periodeTft.id,
      judul: periodeTft.judul,
      slug: periodeTft.slug,
      deskripsi: periodeTft.deskripsi,
      tanggalMulai: periodeTft.tanggalMulai,
      tanggalSelesai: periodeTft.tanggalSelesai,
      waktuMulai: periodeTft.waktuMulai,
      waktuSelesai: periodeTft.waktuSelesai,
      lokasi: periodeTft.lokasi,
      batasPendaftaran: periodeTft.batasPendaftaran,
      status: periodeTft.status,
      program: periodeTft.program,
      maxPeserta: periodeTft.maxPeserta,
      skorMinimum: periodeTft.skorMinimum,
      catatanInternal: periodeTft.catatanInternal,
      createdAt: periodeTft.createdAt,
      updatedAt: periodeTft.updatedAt,
      jumlahPendaftar: sql<number>`(
        SELECT COUNT(*)::int FROM pendaftar_tft WHERE pendaftar_tft.periode_id = ${periodeTft.id}
      )`.as("jumlah_pendaftar"),
    })
    .from(periodeTft)
    .where(eq(periodeTft.id, id));

  return (rows[0] as PeriodeTftRow) ?? null;
}

export async function getPeriodeTftBySlug(slug: string) {
  // Public — no auth required
  const rows = await db
    .select({
      id: periodeTft.id,
      judul: periodeTft.judul,
      slug: periodeTft.slug,
      deskripsi: periodeTft.deskripsi,
      tanggalMulai: periodeTft.tanggalMulai,
      tanggalSelesai: periodeTft.tanggalSelesai,
      waktuMulai: periodeTft.waktuMulai,
      waktuSelesai: periodeTft.waktuSelesai,
      lokasi: periodeTft.lokasi,
      batasPendaftaran: periodeTft.batasPendaftaran,
      status: periodeTft.status,
      program: periodeTft.program,
      maxPeserta: periodeTft.maxPeserta,
    })
    .from(periodeTft)
    .where(eq(periodeTft.slug, slug));

  return rows[0] ?? null;
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

export async function createPeriodeTft(data: PeriodeTftCreateInput) {
  const parsed = periodeTftCreateSchema.parse(data);
  const session = await requirePermission("tft", "manage");

  // Check slug uniqueness
  const existing = await db
    .select({ id: periodeTft.id })
    .from(periodeTft)
    .where(eq(periodeTft.slug, parsed.slug));
  if (existing.length > 0) {
    return { ok: false as const, error: "Slug sudah digunakan. Pilih slug lain." };
  }

  const id = nanoid();
  const rows = await db
    .insert(periodeTft)
    .values({
      id,
      judul: parsed.judul,
      slug: parsed.slug,
      deskripsi: parsed.deskripsi || null,
      tanggalMulai: parsed.tanggalMulai,
      tanggalSelesai: parsed.tanggalSelesai,
      waktuMulai: parsed.waktuMulai || null,
      waktuSelesai: parsed.waktuSelesai || null,
      lokasi: parsed.lokasi || null,
      batasPendaftaran: parsed.batasPendaftaran ? new Date(parsed.batasPendaftaran) : null,
      status: "draft",
      program: parsed.program,
      maxPeserta: parsed.maxPeserta ?? null,
      skorMinimum: parsed.skorMinimum != null ? String(parsed.skorMinimum) : null,
      catatanInternal: parsed.catatanInternal || null,
      createdBy: session.user.id,
    })
    .returning();

  const row = rows[0];
  if (!row) throw new Error("Gagal membuat periode TFT");

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_PERIODE_TFT",
    entitasType: "periode_tft",
    entitasId: id,
    detail: { judul: parsed.judul, program: parsed.program },
  });

  revalidatePath("/jadwal-otomatis/tft");
  return { ok: true as const, data: row };
}

export async function updatePeriodeTft(data: PeriodeTftUpdateInput) {
  const parsed = periodeTftUpdateSchema.parse(data);
  const session = await requirePermission("tft", "manage");

  // Check slug uniqueness (exclude self)
  const existing = await db
    .select({ id: periodeTft.id })
    .from(periodeTft)
    .where(and(eq(periodeTft.slug, parsed.slug)));
  if (existing.some((e) => e.id !== parsed.id)) {
    return { ok: false as const, error: "Slug sudah digunakan. Pilih slug lain." };
  }

  const rows = await db
    .update(periodeTft)
    .set({
      judul: parsed.judul,
      slug: parsed.slug,
      deskripsi: parsed.deskripsi || null,
      tanggalMulai: parsed.tanggalMulai,
      tanggalSelesai: parsed.tanggalSelesai,
      waktuMulai: parsed.waktuMulai || null,
      waktuSelesai: parsed.waktuSelesai || null,
      lokasi: parsed.lokasi || null,
      batasPendaftaran: parsed.batasPendaftaran ? new Date(parsed.batasPendaftaran) : null,
      program: parsed.program,
      maxPeserta: parsed.maxPeserta ?? null,
      skorMinimum: parsed.skorMinimum != null ? String(parsed.skorMinimum) : null,
      catatanInternal: parsed.catatanInternal || null,
      updatedAt: new Date(),
    })
    .where(eq(periodeTft.id, parsed.id))
    .returning();

  const row = rows[0];
  if (!row) return { ok: false as const, error: "Periode TFT tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PERIODE_TFT",
    entitasType: "periode_tft",
    entitasId: parsed.id,
    detail: { judul: parsed.judul },
  });

  revalidatePath("/jadwal-otomatis/tft");
  revalidatePath(`/jadwal-otomatis/tft/${parsed.id}`);
  return { ok: true as const, data: row };
}

export async function updateStatusPeriodeTft(id: string, status: "draft" | "buka" | "tutup" | "penilaian" | "selesai") {
  const session = await requirePermission("tft", "manage");

  const rows = await db
    .update(periodeTft)
    .set({ status, updatedAt: new Date() })
    .where(eq(periodeTft.id, id))
    .returning();

  const row = rows[0];
  if (!row) return { ok: false as const, error: "Periode TFT tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_STATUS_PERIODE_TFT",
    entitasType: "periode_tft",
    entitasId: id,
    detail: { status },
  });

  revalidatePath("/jadwal-otomatis/tft");
  revalidatePath(`/jadwal-otomatis/tft/${id}`);
  return { ok: true as const };
}

export async function deletePeriodeTft(id: string) {
  const session = await requirePermission("tft", "manage");

  const existing = await db
    .select({ judul: periodeTft.judul })
    .from(periodeTft)
    .where(eq(periodeTft.id, id));
  if (!existing[0]) return { ok: false as const, error: "Periode TFT tidak ditemukan." };

  await db.delete(periodeTft).where(eq(periodeTft.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_PERIODE_TFT",
    entitasType: "periode_tft",
    entitasId: id,
    detail: { judul: existing[0].judul },
  });

  revalidatePath("/jadwal-otomatis/tft");
  return { ok: true as const };
}
