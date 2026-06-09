"use server";

import { asc, desc, eq, and, sql, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  pendaftarTft,
  periodeTft,
  instructors,
  instructorExpertise,
  programs,
} from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";
import {
  pendaftarTftSubmitSchema,
  reviewPendaftarSchema,
  type PendaftarTftSubmitInput,
  type ReviewPendaftarInput,
} from "@/lib/validators/tft.schema";
import { getStorageProvider } from "@/lib/storage";
import {
  checkIpRateLimit,
  getClientIpFromHeaders,
} from "@/lib/rate-limit/ip-bucket";

const TFT_SUBMIT_RATE_LIMIT = { limit: 5, windowMs: 60 * 60_000 };

export type PendaftarTftRow = {
  id: string;
  periodeId: string;
  namaLengkap: string;
  email: string;
  noHp: string;
  pekerjaan: string | null;
  alamatPekerjaan: string | null;
  alamatDomisili: string | null;
  materiBrevetAb: string[];
  materiBrevetC: string[];
  bersediaHadir: boolean;
  cvStorageKey: string | null;
  cvOriginalName: string | null;
  status: "baru" | "review" | "diterima" | "ditolak";
  skorAkhir: string | null;
  catatanAdmin: string | null;
  reviewedAt: Date | null;
  instructorId: string | null;
  submittedAt: Date;
  updatedAt: Date;
};

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export async function listPendaftarByPeriode(periodeId: string): Promise<PendaftarTftRow[]> {
  await requireSession();

  const rows = await db
    .select({
      id: pendaftarTft.id,
      periodeId: pendaftarTft.periodeId,
      namaLengkap: pendaftarTft.namaLengkap,
      email: pendaftarTft.email,
      noHp: pendaftarTft.noHp,
      pekerjaan: pendaftarTft.pekerjaan,
      alamatPekerjaan: pendaftarTft.alamatPekerjaan,
      alamatDomisili: pendaftarTft.alamatDomisili,
      materiBrevetAb: pendaftarTft.materiBrevetAb,
      materiBrevetC: pendaftarTft.materiBrevetC,
      bersediaHadir: pendaftarTft.bersediaHadir,
      cvStorageKey: pendaftarTft.cvStorageKey,
      cvOriginalName: pendaftarTft.cvOriginalName,
      status: pendaftarTft.status,
      skorAkhir: pendaftarTft.skorAkhir,
      catatanAdmin: pendaftarTft.catatanAdmin,
      reviewedAt: pendaftarTft.reviewedAt,
      instructorId: pendaftarTft.instructorId,
      submittedAt: pendaftarTft.submittedAt,
      updatedAt: pendaftarTft.updatedAt,
    })
    .from(pendaftarTft)
    .where(eq(pendaftarTft.periodeId, periodeId))
    .orderBy(desc(pendaftarTft.submittedAt));

  return rows as PendaftarTftRow[];
}

// ─── PUBLIC SUBMISSION ───────────────────────────────────────────────────────

export async function submitPendaftaranTft(
  data: PendaftarTftSubmitInput,
  cvFile?: { body: Buffer; fileName: string; contentType: string },
) {
  const headersList = await headers();
  const ip = getClientIpFromHeaders(headersList);
  const rateLimit = checkIpRateLimit(ip, "tft_submit", TFT_SUBMIT_RATE_LIMIT);

  if (!rateLimit.ok) {
    const retryMinutes = Math.ceil(rateLimit.retryAfterMs / 60_000);
    return {
      ok: false as const,
      error: `Terlalu banyak submit dari jaringan ini. Coba lagi dalam ${retryMinutes} menit.`,
    };
  }

  const parsed = pendaftarTftSubmitSchema.parse(data);

  // Validate periode exists and is open
  const periode = await db
    .select({
      id: periodeTft.id,
      status: periodeTft.status,
      batasPendaftaran: periodeTft.batasPendaftaran,
      maxPeserta: periodeTft.maxPeserta,
      program: periodeTft.program,
    })
    .from(periodeTft)
    .where(eq(periodeTft.id, parsed.periodeId));

  const p = periode[0];
  if (!p) return { ok: false as const, error: "Periode TFT tidak ditemukan." };
  if (p.status !== "buka") return { ok: false as const, error: "Pendaftaran belum/sudah ditutup." };

  // Check batas pendaftaran
  if (p.batasPendaftaran && new Date() > p.batasPendaftaran) {
    return { ok: false as const, error: "Batas waktu pendaftaran telah terlewati." };
  }

  // Check max peserta
  if (p.maxPeserta) {
    const result = await db
      .select({ total: count() })
      .from(pendaftarTft)
      .where(eq(pendaftarTft.periodeId, parsed.periodeId));
    if (result[0] && result[0].total >= p.maxPeserta) {
      return { ok: false as const, error: "Kuota pendaftaran telah penuh." };
    }
  }

  // Check duplicate email
  const existingEmail = await db
    .select({ id: pendaftarTft.id })
    .from(pendaftarTft)
    .where(
      and(eq(pendaftarTft.periodeId, parsed.periodeId), eq(pendaftarTft.email, parsed.email)),
    );
  if (existingEmail.length > 0) {
    return { ok: false as const, error: "Email sudah terdaftar untuk periode ini." };
  }

  // Validate materi berdasarkan program
  if (p.program === "brevet_ab" && parsed.materiBrevetAb.length === 0) {
    return { ok: false as const, error: "Pilih minimal satu materi Brevet AB." };
  }
  if (p.program === "brevet_c" && parsed.materiBrevetC.length === 0) {
    return { ok: false as const, error: "Pilih minimal satu materi Brevet C." };
  }
  if (p.program === "all" && parsed.materiBrevetAb.length === 0 && parsed.materiBrevetC.length === 0) {
    return { ok: false as const, error: "Pilih minimal satu materi yang dikuasai." };
  }

  // Upload CV if provided
  let cvStorageKey: string | null = null;
  let cvOriginalName: string | null = null;
  if (cvFile) {
    const storage = getStorageProvider();
    const result = await storage.upload({
      body: cvFile.body,
      fileName: cvFile.fileName,
      contentType: cvFile.contentType,
      folder: `tft/${parsed.periodeId}/cv`,
    });
    cvStorageKey = result.key;
    cvOriginalName = cvFile.fileName;
  }

  const id = nanoid();
  await db.insert(pendaftarTft).values({
    id,
    periodeId: parsed.periodeId,
    namaLengkap: parsed.namaLengkap,
    email: parsed.email,
    noHp: parsed.noHp,
    pekerjaan: parsed.pekerjaan,
    alamatPekerjaan: parsed.alamatPekerjaan,
    alamatDomisili: parsed.alamatDomisili,
    materiBrevetAb: parsed.materiBrevetAb,
    materiBrevetC: parsed.materiBrevetC,
    bersediaHadir: parsed.bersediaHadir,
    cvStorageKey,
    cvOriginalName,
  });

  revalidatePath(`/jadwal-otomatis/tft/${parsed.periodeId}`);
  return { ok: true as const, id };
}

// ─── ADMIN: REVIEW ───────────────────────────────────────────────────────────

export async function reviewPendaftar(data: ReviewPendaftarInput) {
  const parsed = reviewPendaftarSchema.parse(data);
  const session = await requirePermission("tft", "manage");

  const rows = await db
    .update(pendaftarTft)
    .set({
      status: parsed.status,
      catatanAdmin: parsed.catatanAdmin || null,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pendaftarTft.id, parsed.id))
    .returning();

  const row = rows[0];
  if (!row) return { ok: false as const, error: "Pendaftar tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "REVIEW_PENDAFTAR_TFT",
    entitasType: "pendaftar_tft",
    entitasId: parsed.id,
    detail: { status: parsed.status, nama: row.namaLengkap },
  });

  revalidatePath(`/jadwal-otomatis/tft/${row.periodeId}`);
  return { ok: true as const };
}

// ─── ADMIN: CONVERT TO INSTRUKTUR ────────────────────────────────────────────

export async function convertToInstructor(pendaftarId: string) {
  const session = await requirePermission("tft", "manage");

  const pendaftar = await db
    .select()
    .from(pendaftarTft)
    .where(eq(pendaftarTft.id, pendaftarId));

  const p = pendaftar[0];
  if (!p) return { ok: false as const, error: "Pendaftar tidak ditemukan." };
  if (p.instructorId) return { ok: false as const, error: "Pendaftar sudah dikonversi ke instruktur." };

  // Create instructor
  const instructorId = crypto.randomUUID();
  await db.insert(instructors).values({
    id: instructorId,
    name: p.namaLengkap,
    email: p.email,
    phone: p.noHp,
    isActive: true,
  });

  // Create expertise entries based on materi
  const allMateri = [...p.materiBrevetAb, ...p.materiBrevetC];
  if (allMateri.length > 0) {
    // Get program IDs
    const programRows = await db.select({ id: programs.id, code: programs.code }).from(programs);
    const brevetAbProgram = programRows.find((pr) => pr.code === "brevet_ab");
    const brevetCProgram = programRows.find((pr) => pr.code === "brevet_c");

    const expertiseValues: { id: string; instructorId: string; programId: string; materiBlock: string; level: string }[] = [];

    if (brevetAbProgram) {
      for (const materi of p.materiBrevetAb) {
        expertiseValues.push({
          id: crypto.randomUUID(),
          instructorId,
          programId: brevetAbProgram.id,
          materiBlock: materi,
          level: "junior",
        });
      }
    }
    if (brevetCProgram) {
      for (const materi of p.materiBrevetC) {
        expertiseValues.push({
          id: crypto.randomUUID(),
          instructorId,
          programId: brevetCProgram.id,
          materiBlock: materi,
          level: "junior",
        });
      }
    }

    if (expertiseValues.length > 0) {
      await db.insert(instructorExpertise).values(expertiseValues);
    }
  }

  // Update pendaftar with instructor link
  await db
    .update(pendaftarTft)
    .set({
      instructorId,
      status: "diterima",
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pendaftarTft.id, pendaftarId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CONVERT_TFT_TO_INSTRUCTOR",
    entitasType: "pendaftar_tft",
    entitasId: pendaftarId,
    detail: { nama: p.namaLengkap, instructorId },
  });

  revalidatePath(`/jadwal-otomatis/tft/${p.periodeId}`);
  revalidatePath("/jadwal-otomatis/instruktur");
  return { ok: true as const, instructorId };
}

// ─── ADMIN: DELETE PENDAFTAR ─────────────────────────────────────────────────

export async function deletePendaftar(id: string) {
  const session = await requirePermission("tft", "manage");

  const existing = await db
    .select({ periodeId: pendaftarTft.periodeId, namaLengkap: pendaftarTft.namaLengkap, cvStorageKey: pendaftarTft.cvStorageKey })
    .from(pendaftarTft)
    .where(eq(pendaftarTft.id, id));

  if (!existing[0]) return { ok: false as const, error: "Pendaftar tidak ditemukan." };

  // Delete CV from storage if exists
  if (existing[0].cvStorageKey) {
    try {
      const storage = getStorageProvider();
      await storage.delete(existing[0].cvStorageKey);
    } catch {
      // Non-critical — file may already be deleted
    }
  }

  await db.delete(pendaftarTft).where(eq(pendaftarTft.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_PENDAFTAR_TFT",
    entitasType: "pendaftar_tft",
    entitasId: id,
    detail: { nama: existing[0].namaLengkap },
  });

  revalidatePath(`/jadwal-otomatis/tft/${existing[0].periodeId}`);
  return { ok: true as const };
}
