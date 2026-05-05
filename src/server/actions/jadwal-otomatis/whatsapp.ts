"use server";

import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requirePermission, requireSession } from "@/server/actions/auth";
import {
  users,
  whatsappMessageLogs,
  whatsappMessageTemplates,
} from "@/server/db/schema";

const WHATSAPP_TEMPLATE_KEYS = [
  "offer_schedule_instructor",
  "finance_honorarium_reminder",
  "honor_transferred_instructor",
] as const;

export type WhatsappTemplateKey = (typeof WHATSAPP_TEMPLATE_KEYS)[number];

type TemplateSeed = {
  key: WhatsappTemplateKey;
  name: string;
  description: string;
  content: string;
};

const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    key: "offer_schedule_instructor",
    name: "Tawarkan Jadwal ke Instruktur",
    description:
      "Dipakai saat menawarkan jadwal mengajar ke instruktur yang ditugaskan.",
    content: [
      "Yth. Bapak/Ibu {{nama_instruktur}},",
      "",
      "Kami menawarkan jadwal mengajar untuk kelas {{nama_kelas}} ({{nama_program}}).",
      "Periode kelas: {{periode_kelas}}.",
      "",
      "Ringkasan jadwal:",
      "{{ringkasan_jadwal}}",
      "",
      "Mohon konfirmasi ketersediaan. Terima kasih.",
    ].join("\n"),
  },
  {
    key: "finance_honorarium_reminder",
    name: "Reminder Pengajuan Honorarium ke Keuangan",
    description:
      "Dipakai untuk mengingatkan tim keuangan terkait pengajuan honor kelas.",
    content: [
      "Yth. {{nama_kontak_keuangan}},",
      "",
      "Reminder pengajuan honorarium untuk kelas {{nama_kelas}} ({{nama_program}}).",
      "Periode kelas: {{periode_kelas}}.",
      "Total sesi pelatihan: {{total_sesi}} sesi.",
      "Estimasi honor: {{estimasi_honor}}.",
      "",
      "Mohon diproses sesuai SOP. Terima kasih.",
    ].join("\n"),
  },
  {
    key: "honor_transferred_instructor",
    name: "Info Honor Sudah Ditransfer ke Instruktur",
    description:
      "Dipakai untuk menginformasikan ke instruktur bahwa honor sudah dibayarkan.",
    content: [
      "Yth. Bapak/Ibu {{nama_instruktur}},",
      "",
      "Kami informasikan honor mengajar kelas {{nama_kelas}} ({{nama_program}}) sudah ditransfer.",
      "Nominal: {{nominal_honor}}.",
      "Referensi batch: {{referensi_batch}}.",
      "Tanggal bayar: {{tanggal_bayar}}.",
      "",
      "Terima kasih atas kontribusinya.",
    ].join("\n"),
  },
];

async function ensureWhatsappTemplateSeeds() {
  const existing = await db
    .select({
      templateKey: whatsappMessageTemplates.templateKey,
    })
    .from(whatsappMessageTemplates)
    .where(inArray(whatsappMessageTemplates.templateKey, WHATSAPP_TEMPLATE_KEYS));

  const existingKeys = new Set(existing.map((row) => row.templateKey as WhatsappTemplateKey));
  const missing = TEMPLATE_SEEDS.filter((seed) => !existingKeys.has(seed.key));
  if (missing.length === 0) return;

  await db
    .insert(whatsappMessageTemplates)
    .values(
      missing.map((seed) => ({
        templateKey: seed.key,
        templateName: seed.name,
        description: seed.description,
        content: seed.content,
        isActive: true,
      })),
    )
    .onConflictDoNothing();
}

export type WhatsappTemplateRow = {
  id: string;
  templateKey: WhatsappTemplateKey;
  templateName: string;
  description: string | null;
  content: string;
  isActive: boolean;
  updatedAt: Date;
};

export async function listWhatsappMessageTemplates(): Promise<WhatsappTemplateRow[]> {
  await requireSession();
  await ensureWhatsappTemplateSeeds();

  const rows = await db
    .select({
      id: whatsappMessageTemplates.id,
      templateKey: whatsappMessageTemplates.templateKey,
      templateName: whatsappMessageTemplates.templateName,
      description: whatsappMessageTemplates.description,
      content: whatsappMessageTemplates.content,
      isActive: whatsappMessageTemplates.isActive,
      updatedAt: whatsappMessageTemplates.updatedAt,
    })
    .from(whatsappMessageTemplates)
    .where(inArray(whatsappMessageTemplates.templateKey, WHATSAPP_TEMPLATE_KEYS))
    .orderBy(asc(whatsappMessageTemplates.templateKey));

  return rows.map((row) => ({
    ...row,
    templateKey: row.templateKey as WhatsappTemplateKey,
  }));
}

export async function listWhatsappTemplatesForClassActions(): Promise<
  Array<{
    templateKey: WhatsappTemplateKey;
    templateName: string;
    content: string;
  }>
> {
  await requirePermission("jadwalUjian", "view");
  await ensureWhatsappTemplateSeeds();

  const rows = await db
    .select({
      templateKey: whatsappMessageTemplates.templateKey,
      templateName: whatsappMessageTemplates.templateName,
      content: whatsappMessageTemplates.content,
    })
    .from(whatsappMessageTemplates)
    .where(inArray(whatsappMessageTemplates.templateKey, WHATSAPP_TEMPLATE_KEYS))
    .orderBy(asc(whatsappMessageTemplates.templateKey));

  return rows.map((row) => ({
    templateKey: row.templateKey as WhatsappTemplateKey,
    templateName: row.templateName,
    content: row.content,
  }));
}

const updateTemplateSchema = z.object({
  templateKey: z.enum(WHATSAPP_TEMPLATE_KEYS),
  content: z.string().trim().min(10).max(5000),
});

export async function updateWhatsappMessageTemplate(input: unknown) {
  const session = await requirePermission("pengaturan", "update");
  await ensureWhatsappTemplateSeeds();

  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data template tidak valid.",
    };
  }

  const updated = await db
    .update(whatsappMessageTemplates)
    .set({
      content: parsed.data.content,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    })
    .where(eq(whatsappMessageTemplates.templateKey, parsed.data.templateKey))
    .returning({ id: whatsappMessageTemplates.id });

  if (updated.length === 0) {
    return { ok: false as const, error: "Template tidak ditemukan." };
  }

  revalidatePath("/pengaturan");
  revalidatePath("/jadwal-otomatis");
  return { ok: true as const };
}

const createWhatsappLogSchema = z.object({
  kelasId: z.string().min(1),
  templateKey: z.enum(WHATSAPP_TEMPLATE_KEYS),
  recipientRole: z.enum(["instructor", "finance"]),
  recipientName: z.string().trim().max(200).optional().or(z.literal("")),
  recipientWhatsappNumber: z.string().trim().max(30).optional().or(z.literal("")),
  messageContent: z.string().trim().min(5).max(5000),
  metadata: z.record(z.unknown()).optional(),
});

export async function createWhatsappMessageLog(input: unknown) {
  const session = await requirePermission("jadwalUjian", "manage");
  const parsed = createWhatsappLogSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data log WhatsApp tidak valid.",
    };
  }

  const inserted = await db
    .insert(whatsappMessageLogs)
    .values({
      kelasId: parsed.data.kelasId,
      templateKey: parsed.data.templateKey,
      recipientRole: parsed.data.recipientRole,
      recipientName: parsed.data.recipientName || null,
      recipientWhatsappNumber: parsed.data.recipientWhatsappNumber || null,
      messageContent: parsed.data.messageContent,
      metadata: parsed.data.metadata ?? null,
      sentBy: session.user.id,
    })
    .returning({ id: whatsappMessageLogs.id });

  revalidatePath(`/jadwal-otomatis/${parsed.data.kelasId}`);
  return { ok: true as const, id: inserted[0]?.id ?? null };
}

export async function listWhatsappMessageLogsByKelas(kelasId: string, limit = 50) {
  await requirePermission("jadwalUjian", "view");
  const finalLimit = Math.min(Math.max(limit, 1), 200);

  return db
    .select({
      id: whatsappMessageLogs.id,
      templateKey: whatsappMessageLogs.templateKey,
      recipientRole: whatsappMessageLogs.recipientRole,
      recipientName: whatsappMessageLogs.recipientName,
      recipientWhatsappNumber: whatsappMessageLogs.recipientWhatsappNumber,
      messageContent: whatsappMessageLogs.messageContent,
      metadata: whatsappMessageLogs.metadata,
      sentAt: whatsappMessageLogs.sentAt,
      sentByName: users.namaLengkap,
    })
    .from(whatsappMessageLogs)
    .leftJoin(users, eq(whatsappMessageLogs.sentBy, users.id))
    .where(eq(whatsappMessageLogs.kelasId, kelasId))
    .orderBy(desc(whatsappMessageLogs.sentAt))
    .limit(finalLimit);
}
