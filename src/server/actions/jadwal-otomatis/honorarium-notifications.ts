"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  honorariumAuditLogs,
  honorariumBatches,
  honorariumItems,
  users,
} from "@/server/db/schema";
import { createNotification } from "@/server/actions/notifications";
import { checkNotificationPreference } from "@/server/actions/notificationPreferences";
import { getSystemSettings } from "@/server/actions/systemSettings";
import { requirePermission } from "@/server/actions/auth";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  type HonorariumBatchStatus,
  type RoleValue,
  batchStatusLabel,
  reminderBatchSchema,
  sendDirectWaReminderSchema,
} from "./honorarium-utils";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const HONORARIUM_NOTIFICATION_ROLES: RoleValue[] = ["admin", "staff"];

// ─── NOTIFICATION HELPERS ─────────────────────────────────────────────────────

export function buildHonorariumTransitionText(
  from: HonorariumBatchStatus,
  to: HonorariumBatchStatus,
) {
  if (from === "draft" && to === "dikirim_ke_keuangan") {
    return {
      title: "Batch Honorarium Dikirim ke Keuangan",
      actionText: "dikirim ke keuangan",
    };
  }
  if (from === "dikirim_ke_keuangan" && to === "diproses_keuangan") {
    return {
      title: "Batch Honorarium Sedang Diproses",
      actionText: "masuk proses keuangan",
    };
  }
  if (from === "diproses_keuangan" && to === "dibayar") {
    return {
      title: "Batch Honorarium Sudah Dibayar",
      actionText: "ditandai sudah dibayar",
    };
  }
  if (from === "dibayar" && to === "locked") {
    return {
      title: "Batch Honorarium Final (Locked)",
      actionText: "di-lock sebagai final",
    };
  }
  if (to === "draft") {
    return {
      title: "Batch Honorarium Direopen",
      actionText: "dikembalikan ke draft",
    };
  }
  return {
    title: "Status Batch Honorarium Diperbarui",
    actionText: `berpindah dari ${batchStatusLabel(from)} ke ${batchStatusLabel(to)}`,
  };
}

export async function notifyHonorariumStatusTransition(params: {
  batchId: string;
  documentNumber: string;
  from: HonorariumBatchStatus;
  to: HonorariumBatchStatus;
  actorId: string;
}) {
  const [actorRows, recipients] = await Promise.all([
    db
      .select({ name: users.namaLengkap })
      .from(users)
      .where(eq(users.id, params.actorId))
      .limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          inArray(users.role, HONORARIUM_NOTIFICATION_ROLES),
        ),
      ),
  ]);

  const targetUserIds = recipients
    .map((row) => row.id)
    .filter((id) => id !== params.actorId);

  if (targetUserIds.length === 0) return;

  const actorName = actorRows[0]?.name ?? "System";
  const template = buildHonorariumTransitionText(params.from, params.to);
  const message = `Batch ${params.documentNumber} ${template.actionText} oleh ${actorName}. Status: ${batchStatusLabel(params.from)} -> ${batchStatusLabel(params.to)}.`;

  await Promise.all(
    targetUserIds.map(async (userId) => {
      const pref = await checkNotificationPreference(
        userId,
        "honorarium_status",
      );
      if (!pref.inApp) return;

      await createNotification({
        userId,
        type: "honorarium_status",
        title: template.title,
        message,
        entitasType: "honorarium_batch",
        entitasId: params.batchId,
      });
    }),
  );

  revalidatePath("/dashboard");
}

// ─── REMINDER TO FINANCE ──────────────────────────────────────────────────────

export async function sendHonorariumReminderToFinance(
  input: z.infer<typeof reminderBatchSchema>,
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = reminderBatchSchema.parse(input);

  const [batch] = await db
    .select({
      id: honorariumBatches.id,
      documentNumber: honorariumBatches.documentNumber,
      periodStart: honorariumBatches.periodStart,
      periodEnd: honorariumBatches.periodEnd,
      status: honorariumBatches.status,
    })
    .from(honorariumBatches)
    .where(eq(honorariumBatches.id, parsed.batchId))
    .limit(1);

  if (!batch) throw new Error("Batch tidak ditemukan.");
  if (batch.status !== "dikirim_ke_keuangan") {
    throw new Error(
      "Reminder hanya bisa dikirim untuk batch yang berstatus Dikirim ke Keuangan.",
    );
  }

  const [batchAgg] = await db
    .select({
      itemCount: sql<number>`COUNT(*)`,
      totalAmount: sql<number>`COALESCE(SUM(${honorariumItems.amount}), 0)`,
    })
    .from(honorariumItems)
    .where(eq(honorariumItems.batchId, parsed.batchId));

  const itemCount = Number(batchAgg?.itemCount ?? 0);
  const totalAmount = Number(batchAgg?.totalAmount ?? 0);

  const settings = await getSystemSettings();
  const results: { channel: string; ok: boolean; error?: string; waLink?: string; message?: string; recipientName?: string; recipientPhone?: string }[] = [];

  const formatCurrencyPlain = (v: number) =>
    `Rp ${Math.round(v).toLocaleString("id-ID")}`;

  // WhatsApp
  if (parsed.channels.includes("whatsapp")) {
    const phone = settings.financeWhatsappNumber;
    if (!phone) {
      results.push({
        channel: "whatsapp",
        ok: false,
        error: "Nomor WhatsApp keuangan belum dikonfigurasi di Pengaturan.",
      });
    } else {
      const contactName = settings.financeContactName || "Tim Keuangan";
      const message = [
        `Yth. ${contactName},`,
        "",
        `Reminder: Batch honorarium ${batch.documentNumber} telah dikirim ke keuangan dan menunggu diproses.`,
        `Periode: ${batch.periodStart} s.d. ${batch.periodEnd}`,
        `Total sesi: ${itemCount} sesi`,
        `Estimasi honor: ${formatCurrencyPlain(totalAmount)}`,
        "",
        "Mohon segera diproses. Terima kasih.",
      ].join("\n");

      const digits = phone.replace(/\D/g, "");
      const normalizedPhone = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
      const waLink = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;

      results.push({
        channel: "whatsapp",
        ok: true,
        waLink,
        message,
        recipientName: contactName,
        recipientPhone: normalizedPhone,
      });
    }
  }

  // Email
  if (parsed.channels.includes("email")) {
    const { roleCapabilities } = await import("@/server/db/schema");

    const usersFromCustomRole = await db
      .select({ email: users.email, namaLengkap: users.namaLengkap })
      .from(users)
      .innerJoin(roleCapabilities, eq(users.roleId, roleCapabilities.roleId))
      .where(
        and(
          eq(roleCapabilities.capability, "keuangan:view"),
          eq(users.isActive, true),
        ),
      );

    const adminUsers = await db
      .select({ email: users.email, namaLengkap: users.namaLengkap })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          eq(users.isSuperAdmin, true),
        ),
      );

    const allFinanceEmails = new Map<string, { email: string; namaLengkap: string | null }>();
    for (const u of [...usersFromCustomRole, ...adminUsers]) {
      if (u.email && !allFinanceEmails.has(u.email)) {
        allFinanceEmails.set(u.email, u);
      }
    }

    if (allFinanceEmails.size === 0 && settings.financeEmail) {
      allFinanceEmails.set(settings.financeEmail, {
        email: settings.financeEmail,
        namaLengkap: settings.financeContactName,
      });
    }

    const financeUsers = Array.from(allFinanceEmails.values());

    if (financeUsers.length === 0) {
      results.push({
        channel: "email",
        ok: false,
        error: "Tidak ada user keuangan atau email keuangan yang dikonfigurasi.",
      });
    } else {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const batchUrl = `${appUrl}/keuangan/honorarium/${batch.id}`;
      let emailOk = true;
      let emailError: string | undefined;

      for (const user of financeUsers) {
        if (!user.email) continue;
        const recipientName = user.namaLengkap ?? "Tim Keuangan";
        try {
          const { sendEmail: sendEmailDirect } = await import("@/lib/email");
          const { wrapWithLayout } = await import("@/lib/email/template-engine/layout-wrapper");
          const { getGlobalVariables } = await import("@/lib/email/template-engine/sample-data");

          const contentHtml = [
            `<p style="margin:0 0 16px;color:#1e293b">Yth. ${recipientName},</p>`,
            `<p style="margin:0 0 16px;color:#1e293b">Batch honorarium <strong>${batch.documentNumber}</strong> telah dikirim ke keuangan dan menunggu diproses.</p>`,
            `<table style="border-collapse:collapse;margin:0 0 20px;width:100%">`,
            `<tr><td style="padding:8px 16px 8px 0;color:#64748b;border-bottom:1px solid #f1f5f9">Periode</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#1e293b">${batch.periodStart} s.d. ${batch.periodEnd}</td></tr>`,
            `<tr><td style="padding:8px 16px 8px 0;color:#64748b;border-bottom:1px solid #f1f5f9">Total Sesi</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#1e293b">${itemCount} sesi</td></tr>`,
            `<tr><td style="padding:8px 16px 8px 0;color:#64748b;border-bottom:1px solid #f1f5f9">Estimasi Honor</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#1e293b"><strong>${formatCurrencyPlain(totalAmount)}</strong></td></tr>`,
            `</table>`,
            `<p style="margin:0 0 24px"><a href="${batchUrl}" style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:500">Lihat Detail Batch</a></p>`,
            `<p style="margin:0;color:#64748b;font-size:13px">Mohon segera diproses. Terima kasih.</p>`,
          ].join("");

          const htmlBody = await wrapWithLayout(contentHtml, getGlobalVariables());

          await sendEmailDirect({
            to: user.email,
            toName: recipientName,
            subject: `[Reminder] Batch Honorarium ${batch.documentNumber} Menunggu Diproses`,
            htmlBody,
            textBody: [
              `Yth. ${recipientName},`,
              "",
              `Batch honorarium ${batch.documentNumber} telah dikirim ke keuangan dan menunggu diproses.`,
              `Periode: ${batch.periodStart} s.d. ${batch.periodEnd}`,
              `Total sesi: ${itemCount} sesi`,
              `Estimasi honor: ${formatCurrencyPlain(totalAmount)}`,
              "",
              `Lihat detail: ${batchUrl}`,
              "",
              "Mohon segera diproses. Terima kasih.",
            ].join("\n"),
          });
        } catch (e) {
          emailOk = false;
          emailError = e instanceof Error ? e.message : "Gagal kirim email.";
        }
      }
      results.push({ channel: "email", ok: emailOk, error: emailError });
    }
  }

  // Audit log
  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId: parsed.batchId,
    actorId: session.user.id,
    action: "finance_reminder_sent",
    payload: { channels: parsed.channels, results },
  });

  return { ok: true as const, results };
}

// ─── WHATSAPP DIRECT REMINDER ─────────────────────────────────────────────────

export async function sendHonorariumReminderWhatsappDirect(
  input: z.infer<typeof sendDirectWaReminderSchema>,
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = sendDirectWaReminderSchema.parse(input);

  const { sendWhatsAppMessage } = await import("@/lib/whatsapp/sender");
  const result = await sendWhatsAppMessage(parsed.recipientPhone, parsed.message);

  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId: parsed.batchId,
    actorId: session.user.id,
    action: "finance_reminder_wa_direct",
    payload: { recipientPhone: parsed.recipientPhone, messageId: result.messageId },
  });

  return { ok: true as const };
}
