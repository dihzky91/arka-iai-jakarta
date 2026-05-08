"use server";

import { cache } from "react";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateDashboardTag } from "@/server/actions/statistics";
import { DASHBOARD_TAGS } from "@/lib/dashboard-cache-tags";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { disposisi, suratMasuk, users, auditLog } from "@/server/db/schema";
import {
  disposisiCreateSchema,
  disposisiUpdateStatusSchema,
} from "@/lib/validators/disposisi.schema";
import { requirePermission, requireSession } from "./auth";
import { sendEmail, buildDisposisiEmail } from "@/lib/email";
import { markSuratMasukDiproses } from "./suratMasuk";
import { notifyDisposisiBaru, notifyDisposisiDeadline } from "./notifications";
import { syncDisposisiDeadline } from "./calendar";

export type DisposisiRecipientOption = {
  id: string;
  namaLengkap: string;
  email: string;
  role: string | null;
  jabatan: string | null;
};

export type DisposisiTimelineRow = {
  id: string;
  suratMasukId: string;
  dariUserId: string;
  dariNama: string | null;
  kepadaUserId: string;
  kepadaNama: string | null;
  catatan: string | null;
  instruksi: string | null;
  batasWaktu: string | null;
  status: string | null;
  tanggalDisposisi: Date | null;
  tanggalDibaca: Date | null;
  tanggalSelesai: Date | null;
  parentDisposisiId: string | null;
  suratPerihal: string | null;
  suratPengirim: string | null;
};

async function hydrateTimelineRows(
  rows: Array<{
    id: string;
    suratMasukId: string;
    dariUserId: string;
    kepadaUserId: string;
    catatan: string | null;
    instruksi: string | null;
    batasWaktu: string | null;
    status: string | null;
    tanggalDisposisi: Date | null;
    tanggalDibaca: Date | null;
    tanggalSelesai: Date | null;
    parentDisposisiId: string | null;
    suratPerihal: string | null;
    suratPengirim: string | null;
  }>,
): Promise<DisposisiTimelineRow[]> {
  if (!rows.length) return [];

  const userIds = Array.from(
    new Set(rows.flatMap((row) => [row.dariUserId, row.kepadaUserId])),
  );

  const userRows = await db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  const userMap = Object.fromEntries(
    userRows.map((row) => [row.id, row.namaLengkap]),
  );

  return rows.map((row) => ({
    ...row,
    dariNama: userMap[row.dariUserId] ?? null,
    kepadaNama: userMap[row.kepadaUserId] ?? null,
  }));
}

export async function inboxDisposisi(): Promise<DisposisiTimelineRow[]> {
  const session = await requireSession();
  const rows = await db
    .select({
      id: disposisi.id,
      suratMasukId: disposisi.suratMasukId,
      dariUserId: disposisi.dariUserId,
      kepadaUserId: disposisi.kepadaUserId,
      catatan: disposisi.catatan,
      instruksi: disposisi.instruksi,
      batasWaktu: disposisi.batasWaktu,
      status: disposisi.status,
      tanggalDisposisi: disposisi.tanggalDisposisi,
      tanggalDibaca: disposisi.tanggalDibaca,
      tanggalSelesai: disposisi.tanggalSelesai,
      parentDisposisiId: disposisi.parentDisposisiId,
      suratPerihal: suratMasuk.perihal,
      suratPengirim: suratMasuk.pengirim,
    })
    .from(disposisi)
    .innerJoin(suratMasuk, eq(disposisi.suratMasukId, suratMasuk.id))
    .where(eq(disposisi.kepadaUserId, session.user.id))
    .orderBy(desc(disposisi.tanggalDisposisi));

  return hydrateTimelineRows(rows);
}

export async function listDisposisiTimeline(): Promise<DisposisiTimelineRow[]> {
  await requireSession();
  const rows = await db
    .select({
      id: disposisi.id,
      suratMasukId: disposisi.suratMasukId,
      dariUserId: disposisi.dariUserId,
      kepadaUserId: disposisi.kepadaUserId,
      catatan: disposisi.catatan,
      instruksi: disposisi.instruksi,
      batasWaktu: disposisi.batasWaktu,
      status: disposisi.status,
      tanggalDisposisi: disposisi.tanggalDisposisi,
      tanggalDibaca: disposisi.tanggalDibaca,
      tanggalSelesai: disposisi.tanggalSelesai,
      parentDisposisiId: disposisi.parentDisposisiId,
      suratPerihal: suratMasuk.perihal,
      suratPengirim: suratMasuk.pengirim,
    })
    .from(disposisi)
    .innerJoin(suratMasuk, eq(disposisi.suratMasukId, suratMasuk.id))
    .orderBy(asc(disposisi.tanggalDisposisi));

  return hydrateTimelineRows(rows);
}

export const countUnreadDisposisi = cache(async (): Promise<number> => {
  const session = await requireSession();
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(disposisi)
    .where(
      and(
        eq(disposisi.kepadaUserId, session.user.id),
        eq(disposisi.status, "belum_dibaca"),
      ),
    );

  return row?.total ?? 0;
});

export async function listDisposisiRecipients(): Promise<DisposisiRecipientOption[]> {
  const session = await requireSession();
  return db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
      email: users.email,
      role: users.role,
      jabatan: users.jabatan,
    })
    .from(users)
    .where(and(eq(users.isActive, true), ne(users.id, session.user.id)))
    .orderBy(asc(users.namaLengkap));
}

export async function createDisposisi(data: unknown) {
  const parsed = disposisiCreateSchema.parse(data);
  const session = await requirePermission("disposisi", "create");

  const [row] = await db
    .insert(disposisi)
    .values({
      id: crypto.randomUUID(),
      ...parsed,
      dariUserId: session.user.id,
    })
    .returning();

  await markSuratMasukDiproses([parsed.suratMasukId]);

  const [[penerima], [surat], [pengirim]] = await Promise.all([
    db.select().from(users).where(eq(users.id, parsed.kepadaUserId)),
    db.select().from(suratMasuk).where(eq(suratMasuk.id, parsed.suratMasukId)),
    db.select({ namaLengkap: users.namaLengkap }).from(users).where(eq(users.id, session.user.id)),
  ]);

  if (penerima && surat) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const email = buildDisposisiEmail({
      penerimaNama: penerima.namaLengkap,
      pengirimNama: pengirim?.namaLengkap ?? "Pengirim",
      perihalSurat: surat.perihal,
      instruksi: parsed.instruksi ?? null,
      batasWaktu: parsed.batasWaktu ?? null,
      inboxUrl: `${appUrl}/disposisi`,
    });
    void sendEmail({ to: penerima.email, toName: penerima.namaLengkap, ...email });
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_DISPOSISI",
    entitasType: "disposisi",
    entitasId: row!.id,
    detail: { suratMasukId: parsed.suratMasukId, kepada: parsed.kepadaUserId },
  });

  // Send in-app notification
  if (penerima && surat && pengirim) {
    await notifyDisposisiBaru(
      parsed.kepadaUserId,
      pengirim.namaLengkap ?? "Pengirim",
      surat.perihal,
      row!.id
    );
  }

  // Sync calendar event for deadline
  if (parsed.batasWaktu) {
    await syncDisposisiDeadline(
      row!.id,
      surat?.perihal ?? "Disposisi",
      new Date(parsed.batasWaktu),
      parsed.kepadaUserId
    );
  }

  revalidatePath("/surat-masuk");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  revalidatePath("/disposisi");
  revalidatePath("/kalender");
  return { ok: true as const, data: row! };
}

export async function updateStatusDisposisi(data: unknown) {
  const parsed = disposisiUpdateStatusSchema.parse(data);
  const session = await requireSession();

  const patch: Record<string, unknown> = {
    status: parsed.status,
  };
  if (parsed.status === "dibaca") patch.tanggalDibaca = new Date();
  if (parsed.status === "selesai") patch.tanggalSelesai = new Date();

  const [row] = await db
    .update(disposisi)
    .set(patch)
    .where(
      and(
        eq(disposisi.id, parsed.id),
        eq(disposisi.kepadaUserId, session.user.id),
      ),
    )
    .returning();

  if (!row) {
    return { ok: false as const, error: "Disposisi tidak ditemukan." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_STATUS_DISPOSISI",
    entitasType: "disposisi",
    entitasId: parsed.id,
    detail: { status: parsed.status },
  });

  revalidatePath("/surat-masuk");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  revalidatePath("/disposisi");
  return { ok: true as const, data: row };
}
