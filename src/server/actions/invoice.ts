"use server";

import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { invoices, auditLog } from "@/server/db/schema";
import { writeAuditLog } from "@/server/lib/audit";
import { requirePermission, requireSession } from "@/server/actions/auth";
import { allocateNomorSurat } from "@/lib/nomor-surat";
import { parseIsoDateInJakarta } from "@/lib/utils";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

const invoiceItemSchema = z.object({
  deskripsi: z.string().min(1, "Deskripsi item wajib diisi."),
  kuantitas: z.number().positive("Kuantitas harus positif."),
  satuan: z.string().min(1, "Satuan wajib diisi."),
  hargaSatuan: z.string().min(1, "Harga satuan wajib diisi."),
  total: z.string().min(1, "Total item wajib diisi."),
});

const createInvoiceSchema = z.object({
  tanggalInvoice: z.string().min(1, "Tanggal invoice wajib diisi."),
  perihal: z.string().min(1, "Perihal wajib diisi.").max(300),
  kepada: z.string().min(1, "Kepada wajib diisi.").max(300),
  kepadaAlamat: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "Minimal 1 item invoice."),
  subtotal: z.string().min(1, "Subtotal wajib diisi."),
  pajakPersen: z.string().optional().default("0"),
  pajakAmount: z.string().optional().default("0"),
  total: z.string().min(1, "Total wajib diisi."),
  catatan: z.string().optional(),
  pejabatId: z.number().int().positive().optional(),
});

const updateInvoiceSchema = createInvoiceSchema.extend({
  id: z.string().min(1),
});

const idSchema = z.object({ id: z.string().min(1) });

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type InvoiceRow = {
  id: string;
  nomorSurat: string | null;
  tanggalInvoice: string;
  perihal: string;
  kepada: string;
  kepadaAlamat: string | null;
  items: unknown;
  subtotal: string;
  pajakPersen: string | null;
  pajakAmount: string | null;
  total: string;
  catatan: string | null;
  status: string | null;
  fileUrl: string | null;
  dibuatOleh: string | null;
  pejabatId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export async function listInvoices(): Promise<InvoiceRow[]> {
  await requireSession();
  const rows = await db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.createdAt))
    .limit(200);
  return rows as InvoiceRow[];
}

export async function getInvoice(id: string) {
  await requireSession();
  const [row] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id));
  return row as InvoiceRow | undefined;
}

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export async function createInvoice(input: unknown) {
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const session = await requirePermission("invoice", "create");

  const [row] = await db
    .insert(invoices)
    .values({
      tanggalInvoice: parsed.data.tanggalInvoice,
      perihal: parsed.data.perihal,
      kepada: parsed.data.kepada,
      kepadaAlamat: parsed.data.kepadaAlamat,
      items: parsed.data.items,
      subtotal: parsed.data.subtotal,
      pajakPersen: parsed.data.pajakPersen,
      pajakAmount: parsed.data.pajakAmount,
      total: parsed.data.total,
      catatan: parsed.data.catatan,
      pejabatId: parsed.data.pejabatId,
      dibuatOleh: session.user.id,
      status: "draft",
    })
    .returning({ id: invoices.id });

  if (!row) {
    return { ok: false as const, error: "Gagal membuat invoice." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_INVOICE",
    entitasType: "invoice",
    entitasId: row.id,
    detail: { perihal: parsed.data.perihal, kepada: parsed.data.kepada },
  });

  revalidatePath("/invoice");
  return { ok: true as const, id: row.id };
}

export async function updateInvoice(input: unknown) {
  const parsed = updateInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const session = await requirePermission("invoice", "update");

  const [existing] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, parsed.data.id));

  if (!existing) {
    return { ok: false as const, error: "Invoice tidak ditemukan." };
  }

  if (existing.status === "terbit") {
    return {
      ok: false as const,
      error: "Invoice yang sudah terbit tidak dapat diubah.",
    };
  }

  const [updated] = await db
    .update(invoices)
    .set({
      tanggalInvoice: parsed.data.tanggalInvoice,
      perihal: parsed.data.perihal,
      kepada: parsed.data.kepada,
      kepadaAlamat: parsed.data.kepadaAlamat,
      items: parsed.data.items,
      subtotal: parsed.data.subtotal,
      pajakPersen: parsed.data.pajakPersen,
      pajakAmount: parsed.data.pajakAmount,
      total: parsed.data.total,
      catatan: parsed.data.catatan,
      pejabatId: parsed.data.pejabatId,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, parsed.data.id))
    .returning({ id: invoices.id });

  if (!updated) {
    return { ok: false as const, error: "Gagal memperbarui invoice." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_INVOICE",
    entitasType: "invoice",
    entitasId: parsed.data.id,
    detail: { perihal: parsed.data.perihal },
  });

  revalidatePath("/invoice");
  revalidatePath(`/invoice/${parsed.data.id}`);
  return { ok: true as const };
}

export async function assignNomorInvoice(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("invoice", "assign");

  const [inv] = await db
    .select({
      nomorSurat: invoices.nomorSurat,
      tanggalInvoice: invoices.tanggalInvoice,
      status: invoices.status,
    })
    .from(invoices)
    .where(eq(invoices.id, id));

  if (!inv) {
    return { ok: false as const, error: "Invoice tidak ditemukan." };
  }

  if (inv.nomorSurat) {
    return { ok: false as const, error: "Nomor invoice sudah digenerate." };
  }

  if (inv.status !== "draft") {
    return {
      ok: false as const,
      error: "Nomor invoice hanya bisa digenerate saat status Draft.",
    };
  }

  const tanggal = parseIsoDateInJakarta(inv.tanggalInvoice);
  const bulan = tanggal.getMonth() + 1;
  const tahun = tanggal.getFullYear();

  const result = await allocateNomorSurat({
    tahun,
    bulan,
    jenisSurat: "invoice",
  });
  const nomorSurat = result.nomorList[0];

  const updated = await db
    .update(invoices)
    .set({ nomorSurat, status: "terbit", updatedAt: new Date() })
    .where(and(eq(invoices.id, id), sql`${invoices.nomorSurat} IS NULL`))
    .returning({ id: invoices.id });

  if (!updated[0]) {
    return {
      ok: false as const,
      error: "Nomor invoice gagal disimpan karena data berubah. Coba muat ulang.",
    };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "ASSIGN_NOMOR_INVOICE",
    entitasType: "invoice",
    entitasId: id,
    detail: { nomorSurat },
  });

  revalidatePath("/invoice");
  revalidatePath(`/invoice/${id}`);
  return { ok: true as const, nomorSurat };
}

export async function batalkanInvoice(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("invoice", "delete");

  const [inv] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, id));

  if (!inv) {
    return { ok: false as const, error: "Invoice tidak ditemukan." };
  }

  if (inv.status === "dibatalkan") {
    return { ok: false as const, error: "Invoice sudah dibatalkan." };
  }

  await db
    .update(invoices)
    .set({ status: "dibatalkan", updatedAt: new Date() })
    .where(eq(invoices.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "BATALKAN_INVOICE",
    entitasType: "invoice",
    entitasId: id,
  });

  revalidatePath("/invoice");
  revalidatePath(`/invoice/${id}`);
  return { ok: true as const };
}

export async function deleteInvoice(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("invoice", "delete");

  const [inv] = await db
    .select({ status: invoices.status, nomorSurat: invoices.nomorSurat })
    .from(invoices)
    .where(eq(invoices.id, id));

  if (!inv) {
    return { ok: false as const, error: "Invoice tidak ditemukan." };
  }

  if (inv.status === "terbit") {
    return {
      ok: false as const,
      error: "Invoice yang sudah terbit tidak dapat dihapus. Batalkan terlebih dahulu.",
    };
  }

  await db.delete(invoices).where(eq(invoices.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_INVOICE",
    entitasType: "invoice",
    entitasId: id,
    detail: { nomorSurat: inv.nomorSurat },
  });

  revalidatePath("/invoice");
  return { ok: true as const };
}
