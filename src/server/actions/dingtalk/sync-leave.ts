"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { pengajuanCuti, users } from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { writeAuditLog } from "@/server/lib/audit";
import { getLeaveRecords, getLeaveStatus } from "@/lib/dingtalk/leave";

const JENIS_CUTI_REVERSE: Record<string, "tahunan" | "kompensasi" | "sakit" | "melahirkan" | "menikah" | "kematian" | "lainnya"> = {
  "年假": "tahunan",
  "病假": "sakit",
  "产假": "melahirkan",
  "婚假": "menikah",
  "丧假": "kematian",
  "其他": "lainnya",
};

function mapDingtalkJenis(label: string): "tahunan" | "kompensasi" | "sakit" | "melahirkan" | "menikah" | "kematian" | "lainnya" {
  return JENIS_CUTI_REVERSE[label] ?? "lainnya";
}

function extractDate(datetime: string): string {
  return datetime.split(" ")[0] ?? datetime;
}

function mapDingtalkStatus(status: string): "disetujui" | "ditolak" | null {
  if (status === "completed") return "disetujui";
  if (status === "terminated") return "ditolak";
  return null;
}

export async function syncCutiDariDingTalk(
  tanggalMulai: string,
  tanggalSelesai: string,
) {
  const session = await requirePermission("cuti", "update");

  const userRows = await db
    .select({ id: users.id, dingtalkUserId: users.dingtalkUserId })
    .from(users)
    .where(sql`${users.dingtalkUserId} IS NOT NULL`);

  if (userRows.length === 0) {
    return { ok: false as const, error: "Tidak ada pegawai dengan DingTalk User ID." };
  }

  const userIds = userRows.map((r) => r.dingtalkUserId!);

  try {
    const records = await getLeaveRecords(userIds, tanggalMulai, tanggalSelesai);

    let berhasil = 0;

    for (const record of records) {
      const localUser = userRows.find((u) => u.dingtalkUserId === record.originatorUserId);
      if (!localUser) continue;

      const [existing] = await db
        .select({ id: pengajuanCuti.id })
        .from(pengajuanCuti)
        .where(eq(pengajuanCuti.dingtalkProcessId, record.processInstanceId))
        .limit(1);

      if (existing) {
        const localStatus = mapDingtalkStatus(record.status);
        if (localStatus) {
          await db
            .update(pengajuanCuti)
            .set({ status: localStatus, updatedAt: new Date() })
            .where(eq(pengajuanCuti.id, existing.id));
        }
        continue;
      }

      const formValues = record.formComponentValues ?? [];
      const getVal = (name: string) =>
        formValues.find((v) => v.name === name)?.value ?? "";

      await db.insert(pengajuanCuti).values({
        id: crypto.randomUUID(),
        userId: localUser.id,
        jenisCuti: mapDingtalkJenis(getVal("请假类型")),
        tanggalMulai: extractDate(getVal("开始时间")),
        tanggalSelesai: extractDate(getVal("结束时间")),
        jumlahHari: parseInt(getVal("请假时长")) || 1,
        alasan: getVal("请假事由"),
        status: "disetujui",
        dingtalkProcessId: record.processInstanceId,
      });

      berhasil++;
    }

    await writeAuditLog({
      userId: session.user.id,
      aksi: "DINGTALK_SYNC_LEAVE",
      entitasType: "pengajuan_cuti",
      entitasId: `${tanggalMulai}_${tanggalSelesai}`,
      detail: { berhasil, tanggalMulai, tanggalSelesai },
    });

    return { ok: true as const, data: { berhasil } };
  } catch (e) {
    await writeAuditLog({
      userId: session.user.id,
      aksi: "DINGTALK_SYNC_LEAVE_FAILED",
      entitasType: "pengajuan_cuti",
      entitasId: `${tanggalMulai}_${tanggalSelesai}`,
      detail: { error: e instanceof Error ? e.message : String(e) },
    });

    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Sync cuti gagal.",
    };
  }
}

export async function updateStatusCutiDariDingTalk(pengajuanCutiId: string) {
  await requirePermission("cuti", "update");

  const [cuti] = await db
    .select()
    .from(pengajuanCuti)
    .where(eq(pengajuanCuti.id, pengajuanCutiId))
    .limit(1);

  if (!cuti) {
    return { ok: false as const, error: "Data cuti tidak ditemukan." };
  }

  if (!cuti.dingtalkProcessId) {
    return { ok: false as const, error: "Cuti ini belum dikirim ke DingTalk." };
  }

  try {
    const statusData = await getLeaveStatus(cuti.dingtalkProcessId);

    const newStatus = mapDingtalkStatus(statusData.status);
    if (!newStatus || newStatus === cuti.status) {
      return { ok: true as const, data: { status: cuti.status, unchanged: true } };
    }

    await db
      .update(pengajuanCuti)
      .set({
        status: newStatus,
        approvedAt: statusData.finishTime ? new Date(statusData.finishTime) : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pengajuanCuti.id, pengajuanCutiId));

    return { ok: true as const, data: { status: newStatus, unchanged: false } };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Gagal update status cuti.",
    };
  }
}
