"use server";

import { and, asc, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  users,
  account,
  pegawaiBiodata,
  pegawaiKeluarga,
  pegawaiKelengkapan,
  pegawaiKesehatan,
  pegawaiPendidikan,
  pegawaiPernyataanIntegritas,
  pegawaiRiwayatPekerjaan,
  divisi,
  auditLog,
  userInvitations,
  pejabatPenandatangan,
  suratKeluar,
  suratMasuk,
  disposisi,
  suratKeputusan,
  suratMou,
} from "@/server/db/schema";
import { auth, type AuthSession } from "@/server/auth";
import { env } from "@/lib/env";
import {
  pegawaiCreateSchema,
  pegawaiUpdateSchema,
  pegawaiDeleteSchema,
  biodataSchema,
  keluargaCreateSchema,
  keluargaUpdateSchema,
  keluargaDeleteSchema,
  pendidikanCreateSchema,
  pendidikanUpdateSchema,
  pendidikanDeleteSchema,
  pekerjaanCreateSchema,
  pekerjaanUpdateSchema,
  pekerjaanDeleteSchema,
  kesehatanSchema,
  integritasSchema,
  kelengkapanSchema,
} from "@/lib/validators/pegawai.schema";
import { requirePermission, requireSession, getCurrentUserAccess } from "./auth";
import { inviteUser } from "./invitations";

/**
 * Otorisasi untuk aksi sub-entitas pegawai.
 * Admin / super admin / user dengan capability pegawai:manage boleh edit siapa saja.
 * Pegawai biasa hanya boleh edit data miliknya sendiri.
 */
async function requirePegawaiSubEntityAccess(
  targetUserId: string,
): Promise<AuthSession> {
  const session = await requireSession();
  const access = await getCurrentUserAccess();

  if (access?.isSuperAdmin) return session;
  if (access?.capabilities.includes("pegawai:manage")) return session;

  if (session.user.id === targetUserId) return session;

  throw new Error("Forbidden: tidak ada akses untuk mengubah data pegawai lain.");
}

export type PegawaiListRow = {
  id: string;
  namaLengkap: string;
  email: string;
  emailPribadi: string | null;
  noHp: string | null;
  qrContactUrl: string | null;
  role: "admin" | "staff" | "pejabat" | "viewer" | null;
  divisiId: number | null;
  divisiNama: string | null;
  jabatan: string | null;
  levelJabatan: string | null;
  jenisPegawai: string | null;
  tanggalMasuk: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  biodataUpdatedAt: Date | null;
};

export async function listPegawai(options?: {
  cursor?: string;
  limit?: number;
}): Promise<{ rows: PegawaiListRow[]; nextCursor: string | null; total: number }> {
  await requireSession();

  const limit = options?.limit ?? 200;
  const cursorDate = options?.cursor ? new Date(options.cursor) : undefined;

  // Total count
  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const total = Number(totalRows[0]?.count ?? 0);

  const rows = await db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
      email: users.email,
      emailPribadi: users.emailPribadi,
      noHp: users.noHp,
      qrContactUrl: users.qrContactUrl,
      role: users.role,
      divisiId: users.divisiId,
      divisiNama: divisi.nama,
      jabatan: users.jabatan,
      levelJabatan: users.levelJabatan,
      jenisPegawai: users.jenisPegawai,
      tanggalMasuk: users.tanggalMasuk,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      biodataUpdatedAt: pegawaiBiodata.updatedAt,
    })
    .from(users)
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .leftJoin(pegawaiBiodata, eq(pegawaiBiodata.userId, users.id))
    .where(cursorDate ? lt(users.createdAt, cursorDate) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore
    ? (data[data.length - 1]!.createdAt?.toISOString() ?? null)
    : null;

  return { rows: data, nextCursor, total };
}

export async function getPegawaiById(id: string) {
  await requireSession();
  const [user] = await db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
      email: users.email,
      emailPribadi: users.emailPribadi,
      noHp: users.noHp,
      qrContactUrl: users.qrContactUrl,
      role: users.role,
      divisiId: users.divisiId,
      divisiNama: divisi.nama,
      jabatan: users.jabatan,
      levelJabatan: users.levelJabatan,
      jenisPegawai: users.jenisPegawai,
      tanggalMasuk: users.tanggalMasuk,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .where(eq(users.id, id));
  const [biodata] = await db
    .select()
    .from(pegawaiBiodata)
    .where(eq(pegawaiBiodata.userId, id));
  return { user: user ?? null, biodata: biodata ?? null };
}

// Sentinel placeholder untuk kolom account.password sebelum user mengaktivasi.
// Sengaja BUKAN format hash valid sehingga semua percobaan sign-in akan gagal
// sampai user men-set kata sandi via email aktivasi.
const PENDING_INVITE_PASSWORD = "PENDING_INVITE";

export async function createPegawai(data: unknown) {
  const parsed = pegawaiCreateSchema.parse(data);
  const session = await requirePermission("pegawai", "create");

  // Pastikan email belum dipakai (selain unique constraint DB).
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.email))
    .limit(1);

  if (existing.length > 0) {
    return {
      ok: false as const,
      error: "Email tersebut sudah dipakai oleh pegawai lain.",
    };
  }

  // Jika roleId disediakan, gunakan inviteUser untuk unified flow
  // (membuat userInvitations record, account, dan kirim email).
  // Jika tidak, fallback ke flow lama (legacy role string).
  if (parsed.roleId) {
    const inviteResult = await inviteUser({
      email: parsed.email,
      namaLengkap: parsed.namaLengkap,
      roleId: parsed.roleId,
      divisiId: parsed.divisiId,
      jabatan: parsed.jabatan,
    });

    if (!inviteResult.ok) {
      return { ok: false as const, error: inviteResult.error };
    }

    // Update field tambahan yang tidak dihandle inviteUser
    const hasExtraFields =
      parsed.emailPribadi || parsed.noHp || parsed.levelJabatan ||
      parsed.jenisPegawai || parsed.tanggalMasuk;

    if (hasExtraFields) {
      await db
        .update(users)
        .set({
          emailPribadi: parsed.emailPribadi ?? null,
          noHp: parsed.noHp ?? null,
          levelJabatan: parsed.levelJabatan ?? null,
          jenisPegawai: parsed.jenisPegawai ?? null,
          tanggalMasuk: parsed.tanggalMasuk ?? null,
        })
        .where(eq(users.email, parsed.email));
    }

    // Audit log khusus pegawai (di atas INVITE_USER yang ditulis inviteUser)
    await writeAuditLog({
      userId: session.user.id,
      aksi: "CREATE_PEGAWAI",
      entitasType: "users",
      entitasId: inviteResult.data.id,
      detail: {
        email: parsed.email,
        namaLengkap: parsed.namaLengkap,
        roleId: parsed.roleId,
        inviteSent: inviteResult.inviteSent,
        viaUnifiedFlow: true,
      },
    });

    revalidatePath("/pegawai");
    return { ok: true as const, inviteSent: inviteResult.inviteSent };
  }

  // ── Fallback: flow lama tanpa roleId (legacy) ──
  // Buat user row langsung tanpa userInvitations record.
  const userId = crypto.randomUUID();
  const [row] = await db
    .insert(users)
    .values({ id: userId, ...parsed })
    .returning();

  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: PENDING_INVITE_PASSWORD,
  });

  let inviteSent = true;
  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.email,
        redirectTo: `${env.BETTER_AUTH_URL}/reset-password?invite=1`,
      },
    });
  } catch (err) {
    inviteSent = false;
    console.error("[createPegawai] Gagal kirim invite email:", err);
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_PEGAWAI",
    entitasType: "users",
    entitasId: row!.id,
    detail: {
      email: parsed.email,
      namaLengkap: parsed.namaLengkap,
      inviteSent,
      viaUnifiedFlow: false,
    },
  });

  revalidatePath("/pegawai");
  return { ok: true as const, data: row!, inviteSent };
}

export async function updatePegawai(data: unknown) {
  const parsed = pegawaiUpdateSchema.parse(data);
  const session = await requirePermission("pegawai", "update");

  try {
    const [row] = await db
      .update(users)
      .set({
        namaLengkap: parsed.namaLengkap,
        email: parsed.email,
        emailPribadi: parsed.emailPribadi,
        noHp: parsed.noHp,
        role: parsed.role,
        divisiId: parsed.divisiId,
        jabatan: parsed.jabatan,
        levelJabatan: parsed.levelJabatan,
        jenisPegawai: parsed.jenisPegawai,
        tanggalMasuk: parsed.tanggalMasuk,
        isActive: parsed.isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, parsed.id))
      .returning();

    if (!row) {
      return { ok: false as const, error: "Pegawai tidak ditemukan." };
    }

    await writeAuditLog({
      userId: session.user.id,
      aksi: "UPDATE_PEGAWAI",
      entitasType: "users",
      entitasId: row.id,
      detail: { email: parsed.email, namaLengkap: parsed.namaLengkap },
    });

    revalidatePath("/pegawai");
    return { ok: true as const, data: row };
  } catch (err) {
    if (err instanceof Error && err.message.includes("unique")) {
      return { ok: false as const, error: "Email sudah digunakan." };
    }
    throw err;
  }
}

export async function deletePegawai(data: unknown) {
  const parsed = pegawaiDeleteSchema.parse(data);
  const session = await requirePermission("pegawai", "delete");

  if (session.user.id === parsed.id) {
    return {
      ok: false as const,
      error: "Akun yang sedang aktif tidak dapat dihapus.",
    };
  }

  const [target] = await db
    .select({ id: users.id, namaLengkap: users.namaLengkap, email: users.email })
    .from(users)
    .where(eq(users.id, parsed.id));

  if (!target) {
    return { ok: false as const, error: "Pegawai tidak ditemukan." };
  }

  // ── Validasi referensi sebelum hard delete ──

  // 1. Cek pejabat penandatangan aktif
  const [activePejabat] = await db
    .select({ id: pejabatPenandatangan.id })
    .from(pejabatPenandatangan)
    .where(
      and(
        eq(pejabatPenandatangan.userId, parsed.id),
        eq(pejabatPenandatangan.isActive, true),
      ),
    )
    .limit(1);

  // 2. Cek disposisi (sebagai pengirim atau penerima)
  const disposisiRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(disposisi)
    .where(eq(disposisi.dariUserId, parsed.id));
  const disposisiKepadaRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(disposisi)
    .where(eq(disposisi.kepadaUserId, parsed.id));
  const disposisiCount = disposisiRows[0]?.count ?? 0;
  const disposisiKepadaCount = disposisiKepadaRows[0]?.count ?? 0;

  // 3. Cek surat keluar (sebagai pembuat atau penyetuju)
  const suratKeluarRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(suratKeluar)
    .where(eq(suratKeluar.dibuatOleh, parsed.id));
  const suratKeluarCount = suratKeluarRows[0]?.count ?? 0;

  // 4. Cek surat keputusan (sebagai pembuat)
  const suratKeputusanRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(suratKeputusan)
    .where(eq(suratKeputusan.dibuatOleh, parsed.id));
  const suratKeputusanCount = suratKeputusanRows[0]?.count ?? 0;

  // 5. Cek surat MoU (sebagai pembuat)
  const suratMouRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(suratMou)
    .where(eq(suratMou.dibuatOleh, parsed.id));
  const suratMouCount = suratMouRows[0]?.count ?? 0;

  if (activePejabat) {
    return {
      ok: false as const,
      error:
        "Pegawai masih tercatat sebagai pejabat penandatangan aktif. Nonaktifkan pejabat terlebih dahulu, atau gunakan Nonaktifkan Pegawai.",
    };
  }

  const totalDisposisi = Number(disposisiCount) + Number(disposisiKepadaCount);
  if (totalDisposisi > 0) {
    return {
      ok: false as const,
      error: `Pegawai terlibat dalam ${totalDisposisi} disposisi. Hapus permanen diblokir. Gunakan Nonaktifkan Pegawai.`,
    };
  }

  const totalSurat =
    Number(suratKeluarCount) +
    Number(suratKeputusanCount) +
    Number(suratMouCount);
  if (totalSurat > 0) {
    return {
      ok: false as const,
      error: `Pegawai terkait dengan ${totalSurat} dokumen surat. Hapus permanen diblokir. Gunakan Nonaktifkan Pegawai.`,
    };
  }

  // ── Jika aman, lanjut hard delete ──

  // Hapus sub-entitas pegawai
  await db.delete(pegawaiKeluarga).where(eq(pegawaiKeluarga.userId, parsed.id));
  await db.delete(pegawaiPendidikan).where(eq(pegawaiPendidikan.userId, parsed.id));
  await db
    .delete(pegawaiRiwayatPekerjaan)
    .where(eq(pegawaiRiwayatPekerjaan.userId, parsed.id));
  await db.delete(pegawaiBiodata).where(eq(pegawaiBiodata.userId, parsed.id));
  await db.delete(pegawaiKelengkapan).where(eq(pegawaiKelengkapan.userId, parsed.id));
  await db.delete(pegawaiKesehatan).where(eq(pegawaiKesehatan.userId, parsed.id));
  await db
    .delete(pegawaiPernyataanIntegritas)
    .where(eq(pegawaiPernyataanIntegritas.userId, parsed.id));

  // Hapus auth account & invitation records sebelum hapus user
  await db.delete(account).where(eq(account.userId, parsed.id));
  await db.delete(userInvitations).where(eq(userInvitations.email, target.email));

  await db.delete(users).where(eq(users.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_PEGAWAI",
    entitasType: "users",
    entitasId: parsed.id,
    detail: { email: target.email, namaLengkap: target.namaLengkap },
  });

  revalidatePath("/pegawai");
  return { ok: true as const };
}

// â”€â”€â”€ Keluarga â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type KeluargaRow = typeof pegawaiKeluarga.$inferSelect;

export async function listKeluarga(userId: string): Promise<KeluargaRow[]> {
  await requireSession();
  return db
    .select()
    .from(pegawaiKeluarga)
    .where(eq(pegawaiKeluarga.userId, userId))
    .orderBy(asc(pegawaiKeluarga.createdAt));
}

export async function createKeluarga(data: unknown) {
  const parsed = keluargaCreateSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  const [row] = await db.insert(pegawaiKeluarga).values(parsed).returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_PEGAWAI_KELUARGA",
    entitasType: "pegawai_keluarga",
    entitasId: String(row!.id),
    detail: { userId: parsed.userId, hubungan: parsed.hubungan, namaAnggota: parsed.namaAnggota },
  });

  revalidatePath("/pegawai");
  return { ok: true as const, data: row! };
}

export async function updateKeluarga(data: unknown) {
  const parsed = keluargaUpdateSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  const [row] = await db
    .update(pegawaiKeluarga)
    .set({ hubungan: parsed.hubungan, namaAnggota: parsed.namaAnggota, tempatLahir: parsed.tempatLahir, tanggalLahir: parsed.tanggalLahir, pekerjaan: parsed.pekerjaan })
    .where(eq(pegawaiKeluarga.id, parsed.id))
    .returning();

  if (!row) return { ok: false as const, error: "Data tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PEGAWAI_KELUARGA",
    entitasType: "pegawai_keluarga",
    entitasId: String(parsed.id),
    detail: { userId: parsed.userId, hubungan: parsed.hubungan, namaAnggota: parsed.namaAnggota },
  });

  revalidatePath("/pegawai");
  return { ok: true as const, data: row };
}

export async function deleteKeluarga(data: unknown) {
  const parsed = keluargaDeleteSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  await db.delete(pegawaiKeluarga).where(eq(pegawaiKeluarga.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_PEGAWAI_KELUARGA",
    entitasType: "pegawai_keluarga",
    entitasId: String(parsed.id),
    detail: { userId: parsed.userId },
  });

  revalidatePath("/pegawai");
  return { ok: true as const };
}

// â”€â”€â”€ Pendidikan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type PendidikanRow = typeof pegawaiPendidikan.$inferSelect;

export async function listPendidikan(userId: string): Promise<PendidikanRow[]> {
  await requireSession();
  return db
    .select()
    .from(pegawaiPendidikan)
    .where(eq(pegawaiPendidikan.userId, userId))
    .orderBy(asc(pegawaiPendidikan.tahunMasuk));
}

export async function createPendidikan(data: unknown) {
  const parsed = pendidikanCreateSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  const [row] = await db.insert(pegawaiPendidikan).values(parsed).returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_PEGAWAI_PENDIDIKAN",
    entitasType: "pegawai_pendidikan",
    entitasId: String(row!.id),
    detail: { userId: parsed.userId, jenjang: parsed.jenjang, namaInstitusi: parsed.namaInstitusi },
  });

  revalidatePath("/pegawai");
  return { ok: true as const, data: row! };
}

export async function updatePendidikan(data: unknown) {
  const parsed = pendidikanUpdateSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  const [row] = await db
    .update(pegawaiPendidikan)
    .set({ jenjang: parsed.jenjang, namaInstitusi: parsed.namaInstitusi, jurusan: parsed.jurusan, tahunMasuk: parsed.tahunMasuk, tahunLulus: parsed.tahunLulus })
    .where(eq(pegawaiPendidikan.id, parsed.id))
    .returning();

  if (!row) return { ok: false as const, error: "Data tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PEGAWAI_PENDIDIKAN",
    entitasType: "pegawai_pendidikan",
    entitasId: String(parsed.id),
    detail: { userId: parsed.userId, jenjang: parsed.jenjang, namaInstitusi: parsed.namaInstitusi },
  });

  revalidatePath("/pegawai");
  return { ok: true as const, data: row };
}

export async function deletePendidikan(data: unknown) {
  const parsed = pendidikanDeleteSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  await db.delete(pegawaiPendidikan).where(eq(pegawaiPendidikan.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_PEGAWAI_PENDIDIKAN",
    entitasType: "pegawai_pendidikan",
    entitasId: String(parsed.id),
    detail: { userId: parsed.userId },
  });

  revalidatePath("/pegawai");
  return { ok: true as const };
}

// â”€â”€â”€ Pekerjaan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type PekerjaanRow = typeof pegawaiRiwayatPekerjaan.$inferSelect;

export async function listPekerjaan(userId: string): Promise<PekerjaanRow[]> {
  await requireSession();
  return db
    .select()
    .from(pegawaiRiwayatPekerjaan)
    .where(eq(pegawaiRiwayatPekerjaan.userId, userId))
    .orderBy(asc(pegawaiRiwayatPekerjaan.tanggalMulai));
}

export async function createPekerjaan(data: unknown) {
  const parsed = pekerjaanCreateSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  const [row] = await db.insert(pegawaiRiwayatPekerjaan).values(parsed).returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_PEGAWAI_PEKERJAAN",
    entitasType: "pegawai_riwayat_pekerjaan",
    entitasId: String(row!.id),
    detail: { userId: parsed.userId, namaPerusahaan: parsed.namaPerusahaan, jabatan: parsed.jabatan },
  });

  revalidatePath("/pegawai");
  return { ok: true as const, data: row! };
}

export async function updatePekerjaan(data: unknown) {
  const parsed = pekerjaanUpdateSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  const [row] = await db
    .update(pegawaiRiwayatPekerjaan)
    .set({ namaPerusahaan: parsed.namaPerusahaan, jabatan: parsed.jabatan, tanggalMulai: parsed.tanggalMulai, tanggalSelesai: parsed.tanggalSelesai, keterangan: parsed.keterangan })
    .where(eq(pegawaiRiwayatPekerjaan.id, parsed.id))
    .returning();

  if (!row) return { ok: false as const, error: "Data tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PEGAWAI_PEKERJAAN",
    entitasType: "pegawai_riwayat_pekerjaan",
    entitasId: String(parsed.id),
    detail: { userId: parsed.userId, namaPerusahaan: parsed.namaPerusahaan, jabatan: parsed.jabatan },
  });

  revalidatePath("/pegawai");
  return { ok: true as const, data: row };
}

export async function deletePekerjaan(data: unknown) {
  const parsed = pekerjaanDeleteSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  await db.delete(pegawaiRiwayatPekerjaan).where(eq(pegawaiRiwayatPekerjaan.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_PEGAWAI_PEKERJAAN",
    entitasType: "pegawai_riwayat_pekerjaan",
    entitasId: String(parsed.id),
    detail: { userId: parsed.userId },
  });

  revalidatePath("/pegawai");
  return { ok: true as const };
}

// â”€â”€â”€ Kesehatan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type KesehatanRow = typeof pegawaiKesehatan.$inferSelect;

export async function getKesehatan(userId: string): Promise<KesehatanRow | null> {
  await requireSession();
  const [row] = await db
    .select()
    .from(pegawaiKesehatan)
    .where(eq(pegawaiKesehatan.userId, userId));
  return row ?? null;
}

export async function upsertKesehatan(data: unknown) {
  const parsed = kesehatanSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  const existing = await db.select().from(pegawaiKesehatan).where(eq(pegawaiKesehatan.userId, parsed.userId));
  const isUpdate = !!existing[0];
  if (isUpdate) {
    const [row] = await db.update(pegawaiKesehatan).set({ ...parsed, updatedAt: new Date() }).where(eq(pegawaiKesehatan.userId, parsed.userId)).returning();

    await writeAuditLog({
      userId: session.user.id,
      aksi: "UPSERT_PEGAWAI_KESEHATAN",
      entitasType: "pegawai_kesehatan",
      entitasId: String(row!.id),
      detail: { userId: parsed.userId, operation: "update" },
    });

    revalidatePath("/pegawai");
    return row!;
  }
  const [row] = await db.insert(pegawaiKesehatan).values(parsed).returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPSERT_PEGAWAI_KESEHATAN",
    entitasType: "pegawai_kesehatan",
    entitasId: String(row!.id),
    detail: { userId: parsed.userId, operation: "create" },
  });

  revalidatePath("/pegawai");
  return row!;
}

// â”€â”€â”€ Integritas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type IntegritasRow = typeof pegawaiPernyataanIntegritas.$inferSelect;

export async function getIntegritas(userId: string): Promise<IntegritasRow | null> {
  await requireSession();
  const [row] = await db
    .select()
    .from(pegawaiPernyataanIntegritas)
    .where(eq(pegawaiPernyataanIntegritas.userId, userId));
  return row ?? null;
}

export async function upsertIntegritas(data: unknown) {
  const parsed = integritasSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  const existing = await db.select().from(pegawaiPernyataanIntegritas).where(eq(pegawaiPernyataanIntegritas.userId, parsed.userId));
  const isUpdate = !!existing[0];
  if (isUpdate) {
    const [row] = await db.update(pegawaiPernyataanIntegritas).set({ ...parsed }).where(eq(pegawaiPernyataanIntegritas.userId, parsed.userId)).returning();

    await writeAuditLog({
      userId: session.user.id,
      aksi: "UPSERT_PEGAWAI_INTEGRITAS",
      entitasType: "pegawai_pernyataan_integritas",
      entitasId: String(row!.id),
      detail: { userId: parsed.userId, operation: "update" },
    });

    revalidatePath("/pegawai");
    return row!;
  }
  const [row] = await db.insert(pegawaiPernyataanIntegritas).values(parsed).returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPSERT_PEGAWAI_INTEGRITAS",
    entitasType: "pegawai_pernyataan_integritas",
    entitasId: String(row!.id),
    detail: { userId: parsed.userId, operation: "create" },
  });

  revalidatePath("/pegawai");
  return row!;
}

// â”€â”€â”€ Kelengkapan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type KelengkapanRow = typeof pegawaiKelengkapan.$inferSelect;

export async function getKelengkapan(userId: string): Promise<KelengkapanRow | null> {
  await requireSession();
  const [row] = await db
    .select()
    .from(pegawaiKelengkapan)
    .where(eq(pegawaiKelengkapan.userId, userId));
  return row ?? null;
}

export async function upsertKelengkapan(data: unknown) {
  const parsed = kelengkapanSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  const existing = await db
    .select()
    .from(pegawaiKelengkapan)
    .where(eq(pegawaiKelengkapan.userId, parsed.userId));

  const isUpdate = !!existing[0];
  if (isUpdate) {
    const [row] = await db
      .update(pegawaiKelengkapan)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(pegawaiKelengkapan.userId, parsed.userId))
      .returning();

    await writeAuditLog({
      userId: session.user.id,
      aksi: "UPSERT_PEGAWAI_KELENGKAPAN",
      entitasType: "pegawai_kelengkapan",
      entitasId: String(row!.id),
      detail: { userId: parsed.userId, operation: "update" },
    });

    revalidatePath("/pegawai");
    return row!;
  }

  const [row] = await db.insert(pegawaiKelengkapan).values(parsed).returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPSERT_PEGAWAI_KELENGKAPAN",
    entitasType: "pegawai_kelengkapan",
    entitasId: String(row!.id),
    detail: { userId: parsed.userId, operation: "create" },
  });

  revalidatePath("/pegawai");
  return row!;
}

// â”€â”€â”€ Reference â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listPegawaiReference() {
  await requireSession();

  return db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
      email: users.email,
      jabatan: users.jabatan,
      divisiId: users.divisiId,
    })
    .from(users)
    .where(inArray(users.role, ["admin", "staff", "pejabat", "viewer"]))
    .orderBy(asc(users.namaLengkap));
}

export async function upsertBiodata(data: unknown) {
  const parsed = biodataSchema.parse(data);
  const session = await requirePegawaiSubEntityAccess(parsed.userId);

  const existing = await db
    .select()
    .from(pegawaiBiodata)
    .where(eq(pegawaiBiodata.userId, parsed.userId));

  const isUpdate = !!existing[0];
  if (isUpdate) {
    const [row] = await db
      .update(pegawaiBiodata)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(pegawaiBiodata.userId, parsed.userId))
      .returning();

    await writeAuditLog({
      userId: session.user.id,
      aksi: "UPSERT_PEGAWAI_BIODATA",
      entitasType: "pegawai_biodata",
      entitasId: String(row!.id),
      detail: { userId: parsed.userId, operation: "update" },
    });

    revalidatePath("/pegawai");
    return row!;
  }

  const [row] = await db.insert(pegawaiBiodata).values(parsed).returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPSERT_PEGAWAI_BIODATA",
    entitasType: "pegawai_biodata",
    entitasId: String(row!.id),
    detail: { userId: parsed.userId, operation: "create" },
  });

  revalidatePath("/pegawai");
  return row!;
}
