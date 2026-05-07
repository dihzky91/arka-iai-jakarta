"use server";

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { pengajuanCuti, users } from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { writeAuditLog } from "@/server/lib/audit";
import { submitLeaveRequest } from "@/lib/dingtalk/leave";
import { pengajuanCutiCreateSchema, pengajuanCutiUpdateSchema } from "@/lib/validators/dingtalk.schema";
import { revalidateDashboardTag } from "@/server/actions/statistics";
import { DASHBOARD_TAGS } from "@/lib/dashboard-cache-tags";

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

  const cutiId = crypto.randomUUID();

  await db.insert(pengajuanCuti).values({
    id: cutiId,
    userId: session.user.id,
    jenisCuti: parsed.data.jenisCuti,
    tanggalMulai: parsed.data.tanggalMulai,
    tanggalSelesai: parsed.data.tanggalSelesai,
    jumlahHari: parsed.data.jumlahHari,
    alasan: parsed.data.alasan,
    status: "draft",
    lampiranUrl: parsed.data.lampiranUrl || null,
  });

  revalidateDashboardTag(DASHBOARD_TAGS.kepegawaian);
  return { ok: true as const, data: { id: cutiId } };
}

export async function kirimCutiKeDingTalk(pengajuanCutiId: string) {
  const session = await requirePermission("cuti", "create");

  const [cuti] = await db
    .select({
      id: pengajuanCuti.id,
      userId: pengajuanCuti.userId,
      jenisCuti: pengajuanCuti.jenisCuti,
      tanggalMulai: pengajuanCuti.tanggalMulai,
      tanggalSelesai: pengajuanCuti.tanggalSelesai,
      jumlahHari: pengajuanCuti.jumlahHari,
      alasan: pengajuanCuti.alasan,
      status: pengajuanCuti.status,
      dingtalkUserId: users.dingtalkUserId,
    })
    .from(pengajuanCuti)
    .leftJoin(users, eq(pengajuanCuti.userId, users.id))
    .where(eq(pengajuanCuti.id, pengajuanCutiId))
    .limit(1);

  if (!cuti) {
    return { ok: false as const, error: "Data cuti tidak ditemukan." };
  }

  if (cuti.status !== "draft") {
    return { ok: false as const, error: "Hanya cuti dengan status draft yang bisa dikirim." };
  }

  if (!cuti.dingtalkUserId) {
    return { ok: false as const, error: "Akun DingTalk belum terhubung." };
  }

  try {
    const processInstanceId = await submitLeaveRequest(cuti.dingtalkUserId, {
      jenisCuti: cuti.jenisCuti,
      tanggalMulai: cuti.tanggalMulai,
      tanggalSelesai: cuti.tanggalSelesai,
      jumlahHari: cuti.jumlahHari,
      alasan: cuti.alasan ?? undefined,
    });

    await db
      .update(pengajuanCuti)
      .set({
        dingtalkProcessId: processInstanceId,
        status: "diajukan",
        updatedAt: new Date(),
      })
      .where(eq(pengajuanCuti.id, pengajuanCutiId));

    await writeAuditLog({
      userId: session.user.id,
      aksi: "DINGTALK_LEAVE_SUBMITTED",
      entitasType: "pengajuan_cuti",
      entitasId: pengajuanCutiId,
      detail: { processInstanceId },
    });

    return { ok: true as const, data: { processInstanceId } };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Gagal mengirim cuti ke DingTalk.",
    };
  }
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
    .select({ id: pengajuanCuti.id, status: pengajuanCuti.status })
    .from(pengajuanCuti)
    .where(eq(pengajuanCuti.id, parsed.data.id))
    .limit(1);

  if (!cuti) {
    return { ok: false as const, error: "Data cuti tidak ditemukan." };
  }

  if (cuti.status !== "diajukan") {
    return { ok: false as const, error: "Hanya cuti dengan status diajukan yang bisa diproses." };
  }

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

  await writeAuditLog({
    userId: session.user.id,
    aksi: parsed.data.status === "disetujui" ? "CUTI_APPROVED" : "CUTI_REJECTED",
    entitasType: "pengajuan_cuti",
    entitasId: parsed.data.id,
    detail: { rejectedReason: parsed.data.rejectedReason },
  });

  revalidateDashboardTag(DASHBOARD_TAGS.kepegawaian);
  return { ok: true as const };
}
