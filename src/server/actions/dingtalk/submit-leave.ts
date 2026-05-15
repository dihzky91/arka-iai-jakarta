"use server";

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { pengajuanCuti, users } from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { writeAuditLog } from "@/server/lib/audit";
import { pengajuanCutiCreateSchema, pengajuanCutiUpdateSchema } from "@/lib/validators/dingtalk.schema";
import { revalidateDashboardTag } from "@/server/actions/statistics";
import { DASHBOARD_TAGS } from "@/lib/dashboard-cache-tags";
import { validasiSaldoCuti, kurangiSaldoCuti, kembalikanSaldoCuti } from "@/server/actions/saldoCuti";

export async function ajukanCuti(
  input: unknown,
) {
  const session = await requirePermission("cuti", "create");

  const parsed = pengajuanCutiCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const [user] = await db
    .select({ id: users.id, dingtalkUserId: users.dingtalkUserId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return { ok: false as const, error: "User tidak ditemukan." };
  }

  // Validasi saldo cuti jika jenis = tahunan atau kompensasi
  const jenis = parsed.data.jenisCuti;
  if (jenis === "tahunan" || jenis === "kompensasi") {
    const tahun = new Date(parsed.data.tanggalMulai).getFullYear();
    const validasi = await validasiSaldoCuti(
      session.user.id,
      jenis,
      parsed.data.jumlahHari,
      tahun,
    );
    if (!validasi.valid) {
      return { ok: false as const, error: validasi.error! };
    }
  }

  const cutiId = crypto.randomUUID();

  // Langsung set status "diajukan" (tanpa DingTalk)
  await db.insert(pengajuanCuti).values({
    id: cutiId,
    userId: session.user.id,
    jenisCuti: parsed.data.jenisCuti,
    tanggalMulai: parsed.data.tanggalMulai,
    tanggalSelesai: parsed.data.tanggalSelesai,
    jumlahHari: parsed.data.jumlahHari,
    alasan: parsed.data.alasan,
    status: "diajukan",
    lampiranUrl: parsed.data.lampiranUrl || null,
  });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CUTI_DIAJUKAN",
    entitasType: "pengajuan_cuti",
    entitasId: cutiId,
    detail: { jenisCuti: parsed.data.jenisCuti, jumlahHari: parsed.data.jumlahHari },
  });

  revalidateDashboardTag(DASHBOARD_TAGS.kepegawaian);
  return { ok: true as const, data: { id: cutiId } };
}

export async function approveCuti(input: unknown) {
  const session = await requirePermission("cuti", "approve");

  const parsed = pengajuanCutiUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const [cuti] = await db
    .select({
      id: pengajuanCuti.id,
      userId: pengajuanCuti.userId,
      jenisCuti: pengajuanCuti.jenisCuti,
      jumlahHari: pengajuanCuti.jumlahHari,
      tanggalMulai: pengajuanCuti.tanggalMulai,
      status: pengajuanCuti.status,
    })
    .from(pengajuanCuti)
    .where(eq(pengajuanCuti.id, parsed.data.id))
    .limit(1);

  if (!cuti) {
    return { ok: false as const, error: "Data cuti tidak ditemukan." };
  }

  // Untuk approve: status harus "diajukan"
  // Untuk batal: status harus "disetujui"
  if (parsed.data.status === "disetujui" || parsed.data.status === "ditolak") {
    if (cuti.status !== "diajukan") {
      return { ok: false as const, error: "Hanya cuti dengan status diajukan yang bisa diproses." };
    }
  } else if (parsed.data.status === "dibatalkan") {
    if (cuti.status !== "disetujui") {
      return { ok: false as const, error: "Hanya cuti yang sudah disetujui yang bisa dibatalkan." };
    }
  }

  // Update status pengajuan
  await db
    .update(pengajuanCuti)
    .set({
      status: parsed.data.status,
      approvedBy: session.user.id,
      approvedAt: new Date(),
      rejectedReason: parsed.data.rejectedReason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(pengajuanCuti.id, parsed.data.id));

  // Update saldo cuti jika jenis = tahunan atau kompensasi
  const jenis = cuti.jenisCuti as string;
  if (jenis === "tahunan" || jenis === "kompensasi") {
    const tahun = new Date(cuti.tanggalMulai).getFullYear();

    if (parsed.data.status === "disetujui") {
      await kurangiSaldoCuti(cuti.userId, jenis, cuti.jumlahHari, tahun);
    } else if (parsed.data.status === "dibatalkan") {
      await kembalikanSaldoCuti(cuti.userId, jenis, cuti.jumlahHari, tahun);
    }
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: parsed.data.status === "disetujui"
      ? "CUTI_APPROVED"
      : parsed.data.status === "ditolak"
        ? "CUTI_REJECTED"
        : "CUTI_CANCELLED",
    entitasType: "pengajuan_cuti",
    entitasId: parsed.data.id,
    detail: { rejectedReason: parsed.data.rejectedReason },
  });

  revalidateDashboardTag(DASHBOARD_TAGS.kepegawaian);
  return { ok: true as const };
}
