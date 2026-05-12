"use server";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import {
  projectBudgetItems,
  projectExpenses,
  projectSpeakers,
  projectTimesheets,
  users,
} from "@/server/db/schema";
import {
  uuidSchema,
  logProjectActivity,
  requireProjectMember,
  requireProjectWriter,
  canWrite,
  normalizeError,
  numeric,
  minutesBetween,
} from "./_project-shared";

export type ProjectSpeakerRow = typeof projectSpeakers.$inferSelect;
export type ProjectBudgetItemRow = typeof projectBudgetItems.$inferSelect & {
  createdByName: string | null;
};
export type ProjectExpenseRow = typeof projectExpenses.$inferSelect & {
  uploadedByName: string | null;
};
export type ProjectTimesheetRow = typeof projectTimesheets.$inferSelect & {
  userName: string | null;
};
export type ProjectFinancialSummary = {
  totalBudget: number;
  totalExpenses: number;
  delta: number;
  byCategory: Array<{ kategori: string; budget: number; actual: number; delta: number }>;
};
export type ProjectTimesheetSummary = {
  totalMinutes: number;
  activeTimer: ProjectTimesheetRow | null;
  byUser: Array<{ userId: string; userName: string | null; totalMinutes: number }>;
};

const speakerSchema = z.object({
  userId: z.string().optional().nullable(),
  nama: z.string().trim().min(1, "Nama narasumber wajib diisi.").max(255),
  email: z.string().trim().email("Email tidak valid.").optional().nullable().or(z.literal("")),
  topik: z.string().trim().max(255).optional().nullable(),
  durasiMenit: z.coerce.number().int().positive().optional().nullable(),
  skp: z.coerce.number().nonnegative().optional().nullable(),
  isExternal: z.boolean().optional().default(false),
});

const budgetSchema = z.object({
  kategori: z.string().trim().min(1, "Kategori wajib diisi.").max(100),
  deskripsi: z.string().trim().optional().nullable(),
  jumlahRencana: z.coerce.number().nonnegative("Jumlah rencana tidak boleh negatif."),
});

const expenseSchema = z.object({
  kategori: z.string().trim().min(1, "Kategori wajib diisi.").max(100),
  jumlah: z.coerce.number().nonnegative("Jumlah tidak boleh negatif."),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  keterangan: z.string().trim().optional().nullable(),
  buktiUrl: z.string().trim().url("URL bukti tidak valid.").optional().nullable().or(z.literal("")),
});

const timesheetSchema = z.object({
  startTime: z.coerce.date(),
  endTime: z.coerce.date().optional().nullable(),
  durationMinutes: z.coerce.number().int().nonnegative().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

const timesheetDescriptionSchema = z.object({
  description: z.string().trim().optional().nullable(),
});

export async function listProjectSpeakers(projectId: string): Promise<ProjectSpeakerRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);
  return db
    .select()
    .from(projectSpeakers)
    .where(eq(projectSpeakers.projectId, parsedId))
    .orderBy(asc(projectSpeakers.nama));
}

export async function createProjectSpeaker(projectId: string, data: unknown) {
  const result = speakerSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  try {
    const parsedId = uuidSchema.parse(projectId);
    const { session } = await requireProjectWriter(parsedId);
    const parsed = result.data;
    const [row] = await db
      .insert(projectSpeakers)
      .values({
        projectId: parsedId,
        userId: parsed.userId || null,
        nama: parsed.nama,
        email: parsed.email || null,
        topik: parsed.topik || null,
        durasiMenit: parsed.durasiMenit ?? null,
        skp: numeric(parsed.skp),
        isExternal: parsed.isExternal ?? false,
        updatedAt: new Date(),
      })
      .returning({ id: projectSpeakers.id, nama: projectSpeakers.nama });
    if (!row) throw new Error("INSERT_FAILED");
    await logProjectActivity(parsedId, session.user.id, "speaker_created", `Narasumber "${row.nama}" ditambahkan.`);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal menyimpan narasumber") };
  }
}

export async function updateProjectSpeaker(speakerId: string, data: unknown) {
  const result = speakerSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  try {
    const parsedId = uuidSchema.parse(speakerId);
    const [existing] = await db
      .select({ projectId: projectSpeakers.projectId })
      .from(projectSpeakers)
      .where(eq(projectSpeakers.id, parsedId))
      .limit(1);
    if (!existing) return { ok: false as const, error: "Narasumber tidak ditemukan." };
    const { session } = await requireProjectWriter(existing.projectId);
    const parsed = result.data;
    const [row] = await db
      .update(projectSpeakers)
      .set({
        userId: parsed.userId || null,
        nama: parsed.nama,
        email: parsed.email || null,
        topik: parsed.topik || null,
        durasiMenit: parsed.durasiMenit ?? null,
        skp: numeric(parsed.skp),
        isExternal: parsed.isExternal ?? false,
        updatedAt: new Date(),
      })
      .where(eq(projectSpeakers.id, parsedId))
      .returning({ id: projectSpeakers.id, nama: projectSpeakers.nama });
    await logProjectActivity(existing.projectId, session.user.id, "speaker_updated", `Narasumber "${row?.nama ?? parsed.nama}" diperbarui.`);
    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal mengubah narasumber") };
  }
}

export async function deleteProjectSpeaker(speakerId: string) {
  try {
    const parsedId = uuidSchema.parse(speakerId);
    const [existing] = await db
      .select({ projectId: projectSpeakers.projectId, nama: projectSpeakers.nama })
      .from(projectSpeakers)
      .where(eq(projectSpeakers.id, parsedId))
      .limit(1);
    if (!existing) return { ok: false as const, error: "Narasumber tidak ditemukan." };
    const { session } = await requireProjectWriter(existing.projectId);
    await db.delete(projectSpeakers).where(eq(projectSpeakers.id, parsedId));
    await logProjectActivity(existing.projectId, session.user.id, "speaker_deleted", `Narasumber "${existing.nama}" dihapus.`);
    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal menghapus narasumber") };
  }
}

export async function listProjectBudgetItems(projectId: string): Promise<ProjectBudgetItemRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);
  return db
    .select({
      id: projectBudgetItems.id,
      projectId: projectBudgetItems.projectId,
      kategori: projectBudgetItems.kategori,
      deskripsi: projectBudgetItems.deskripsi,
      jumlahRencana: projectBudgetItems.jumlahRencana,
      createdBy: projectBudgetItems.createdBy,
      createdAt: projectBudgetItems.createdAt,
      updatedAt: projectBudgetItems.updatedAt,
      createdByName: users.namaLengkap,
    })
    .from(projectBudgetItems)
    .leftJoin(users, eq(projectBudgetItems.createdBy, users.id))
    .where(eq(projectBudgetItems.projectId, parsedId))
    .orderBy(asc(projectBudgetItems.kategori), desc(projectBudgetItems.createdAt));
}

export async function createProjectBudgetItem(projectId: string, data: unknown) {
  const result = budgetSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  try {
    const parsedId = uuidSchema.parse(projectId);
    const { session } = await requireProjectWriter(parsedId);
    const parsed = result.data;
    const [row] = await db
      .insert(projectBudgetItems)
      .values({
        projectId: parsedId,
        kategori: parsed.kategori,
        deskripsi: parsed.deskripsi || null,
        jumlahRencana: String(parsed.jumlahRencana),
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning({ id: projectBudgetItems.id, kategori: projectBudgetItems.kategori });
    await logProjectActivity(parsedId, session.user.id, "budget_created", `Budget "${row?.kategori ?? parsed.kategori}" ditambahkan.`);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal menyimpan budget") };
  }
}

export async function updateProjectBudgetItem(itemId: string, data: unknown) {
  const result = budgetSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  try {
    const parsedId = uuidSchema.parse(itemId);
    const [existing] = await db
      .select({ projectId: projectBudgetItems.projectId })
      .from(projectBudgetItems)
      .where(eq(projectBudgetItems.id, parsedId))
      .limit(1);
    if (!existing) return { ok: false as const, error: "Budget tidak ditemukan." };
    const { session } = await requireProjectWriter(existing.projectId);
    const parsed = result.data;
    const [row] = await db
      .update(projectBudgetItems)
      .set({
        kategori: parsed.kategori,
        deskripsi: parsed.deskripsi || null,
        jumlahRencana: String(parsed.jumlahRencana),
        updatedAt: new Date(),
      })
      .where(eq(projectBudgetItems.id, parsedId))
      .returning({ id: projectBudgetItems.id, kategori: projectBudgetItems.kategori });
    await logProjectActivity(existing.projectId, session.user.id, "budget_updated", `Budget "${row?.kategori ?? parsed.kategori}" diperbarui.`);
    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal mengubah budget") };
  }
}

export async function deleteProjectBudgetItem(itemId: string) {
  try {
    const parsedId = uuidSchema.parse(itemId);
    const [existing] = await db
      .select({ projectId: projectBudgetItems.projectId, kategori: projectBudgetItems.kategori })
      .from(projectBudgetItems)
      .where(eq(projectBudgetItems.id, parsedId))
      .limit(1);
    if (!existing) return { ok: false as const, error: "Budget tidak ditemukan." };
    const { session } = await requireProjectWriter(existing.projectId);
    await db.delete(projectBudgetItems).where(eq(projectBudgetItems.id, parsedId));
    await logProjectActivity(existing.projectId, session.user.id, "budget_deleted", `Budget "${existing.kategori}" dihapus.`);
    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal menghapus budget") };
  }
}

export async function listProjectExpenses(projectId: string): Promise<ProjectExpenseRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);
  return db
    .select({
      id: projectExpenses.id,
      projectId: projectExpenses.projectId,
      kategori: projectExpenses.kategori,
      jumlah: projectExpenses.jumlah,
      tanggal: projectExpenses.tanggal,
      keterangan: projectExpenses.keterangan,
      buktiUrl: projectExpenses.buktiUrl,
      uploadedBy: projectExpenses.uploadedBy,
      createdAt: projectExpenses.createdAt,
      updatedAt: projectExpenses.updatedAt,
      uploadedByName: users.namaLengkap,
    })
    .from(projectExpenses)
    .leftJoin(users, eq(projectExpenses.uploadedBy, users.id))
    .where(eq(projectExpenses.projectId, parsedId))
    .orderBy(desc(projectExpenses.tanggal), desc(projectExpenses.createdAt));
}

export async function createProjectExpense(projectId: string, data: unknown) {
  const result = expenseSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  try {
    const parsedId = uuidSchema.parse(projectId);
    const { session } = await requireProjectWriter(parsedId);
    const parsed = result.data;
    const [row] = await db
      .insert(projectExpenses)
      .values({
        projectId: parsedId,
        kategori: parsed.kategori,
        jumlah: String(parsed.jumlah),
        tanggal: parsed.tanggal,
        keterangan: parsed.keterangan || null,
        buktiUrl: parsed.buktiUrl || null,
        uploadedBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning({ id: projectExpenses.id, kategori: projectExpenses.kategori });
    await logProjectActivity(parsedId, session.user.id, "expense_created", `Expense "${row?.kategori ?? parsed.kategori}" ditambahkan.`);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal menyimpan expense") };
  }
}

export async function updateProjectExpense(expenseId: string, data: unknown) {
  const result = expenseSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  try {
    const parsedId = uuidSchema.parse(expenseId);
    const [existing] = await db
      .select({ projectId: projectExpenses.projectId })
      .from(projectExpenses)
      .where(eq(projectExpenses.id, parsedId))
      .limit(1);
    if (!existing) return { ok: false as const, error: "Expense tidak ditemukan." };
    const { session } = await requireProjectWriter(existing.projectId);
    const parsed = result.data;
    const [row] = await db
      .update(projectExpenses)
      .set({
        kategori: parsed.kategori,
        jumlah: String(parsed.jumlah),
        tanggal: parsed.tanggal,
        keterangan: parsed.keterangan || null,
        buktiUrl: parsed.buktiUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(projectExpenses.id, parsedId))
      .returning({ id: projectExpenses.id, kategori: projectExpenses.kategori });
    await logProjectActivity(existing.projectId, session.user.id, "expense_updated", `Expense "${row?.kategori ?? parsed.kategori}" diperbarui.`);
    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal mengubah expense") };
  }
}

export async function deleteProjectExpense(expenseId: string) {
  try {
    const parsedId = uuidSchema.parse(expenseId);
    const [existing] = await db
      .select({ projectId: projectExpenses.projectId, kategori: projectExpenses.kategori })
      .from(projectExpenses)
      .where(eq(projectExpenses.id, parsedId))
      .limit(1);
    if (!existing) return { ok: false as const, error: "Expense tidak ditemukan." };
    const { session } = await requireProjectWriter(existing.projectId);
    await db.delete(projectExpenses).where(eq(projectExpenses.id, parsedId));
    await logProjectActivity(existing.projectId, session.user.id, "expense_deleted", `Expense "${existing.kategori}" dihapus.`);
    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal menghapus expense") };
  }
}

export async function getProjectFinancialSummary(projectId: string): Promise<ProjectFinancialSummary> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);
  const [budgetRows, expenseRows] = await Promise.all([
    db
      .select({ kategori: projectBudgetItems.kategori, amount: sql<string>`sum(${projectBudgetItems.jumlahRencana})` })
      .from(projectBudgetItems)
      .where(eq(projectBudgetItems.projectId, parsedId))
      .groupBy(projectBudgetItems.kategori),
    db
      .select({ kategori: projectExpenses.kategori, amount: sql<string>`sum(${projectExpenses.jumlah})` })
      .from(projectExpenses)
      .where(eq(projectExpenses.projectId, parsedId))
      .groupBy(projectExpenses.kategori),
  ]);

  const categoryMap = new Map<string, { budget: number; actual: number }>();
  for (const row of budgetRows) categoryMap.set(row.kategori, { budget: Number(row.amount ?? 0), actual: 0 });
  for (const row of expenseRows) {
    const current = categoryMap.get(row.kategori) ?? { budget: 0, actual: 0 };
    current.actual = Number(row.amount ?? 0);
    categoryMap.set(row.kategori, current);
  }
  const totalBudget = budgetRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const totalExpenses = expenseRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  return {
    totalBudget,
    totalExpenses,
    delta: totalBudget - totalExpenses,
    byCategory: Array.from(categoryMap.entries())
      .map(([kategori, value]) => ({ kategori, budget: value.budget, actual: value.actual, delta: value.budget - value.actual }))
      .sort((a, b) => a.kategori.localeCompare(b.kategori)),
  };
}

export async function listProjectTimesheets(projectId: string): Promise<ProjectTimesheetRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);
  return db
    .select({
      id: projectTimesheets.id,
      projectId: projectTimesheets.projectId,
      userId: projectTimesheets.userId,
      startTime: projectTimesheets.startTime,
      endTime: projectTimesheets.endTime,
      durationMinutes: projectTimesheets.durationMinutes,
      description: projectTimesheets.description,
      createdAt: projectTimesheets.createdAt,
      updatedAt: projectTimesheets.updatedAt,
      userName: users.namaLengkap,
    })
    .from(projectTimesheets)
    .leftJoin(users, eq(projectTimesheets.userId, users.id))
    .where(eq(projectTimesheets.projectId, parsedId))
    .orderBy(desc(projectTimesheets.startTime));
}

export async function getProjectTimesheetSummary(projectId: string): Promise<ProjectTimesheetSummary> {
  const parsedId = uuidSchema.parse(projectId);
  const { session } = await requireProjectMember(parsedId);
  const rows = await db
    .select({
      id: projectTimesheets.id,
      projectId: projectTimesheets.projectId,
      userId: projectTimesheets.userId,
      startTime: projectTimesheets.startTime,
      endTime: projectTimesheets.endTime,
      durationMinutes: projectTimesheets.durationMinutes,
      description: projectTimesheets.description,
      createdAt: projectTimesheets.createdAt,
      updatedAt: projectTimesheets.updatedAt,
      userName: users.namaLengkap,
    })
    .from(projectTimesheets)
    .leftJoin(users, eq(projectTimesheets.userId, users.id))
    .where(eq(projectTimesheets.projectId, parsedId))
    .orderBy(desc(projectTimesheets.startTime));
  const completedRows = rows.filter((row) => row.endTime);
  const activeTimer = rows.find((row) => row.userId === session.user.id && !row.endTime) ?? null;
  const byUserMap = new Map<string, { userName: string | null; totalMinutes: number }>();

  for (const row of completedRows) {
    const duration = row.durationMinutes ?? (row.endTime ? minutesBetween(row.startTime, row.endTime) : 0);
    const current = byUserMap.get(row.userId) ?? { userName: row.userName, totalMinutes: 0 };
    current.totalMinutes += duration;
    byUserMap.set(row.userId, current);
  }

  return {
    totalMinutes: completedRows.reduce(
      (sum, row) => sum + (row.durationMinutes ?? (row.endTime ? minutesBetween(row.startTime, row.endTime) : 0)),
      0,
    ),
    activeTimer,
    byUser: Array.from(byUserMap.entries())
      .map(([userId, value]) => ({ userId, ...value }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes),
  };
}

export async function startProjectTimer(projectId: string, data: unknown = {}) {
  const result = timesheetDescriptionSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  try {
    const parsedId = uuidSchema.parse(projectId);
    const { session, role } = await requireProjectMember(parsedId);
    if (role === "viewer") return { ok: false as const, error: "Viewer tidak bisa memulai timer." };
    const [active] = await db
      .select({ id: projectTimesheets.id })
      .from(projectTimesheets)
      .where(and(eq(projectTimesheets.projectId, parsedId), eq(projectTimesheets.userId, session.user.id), isNull(projectTimesheets.endTime)))
      .limit(1);
    if (active) return { ok: false as const, error: "Masih ada timer aktif untuk project ini." };
    const [row] = await db
      .insert(projectTimesheets)
      .values({
        projectId: parsedId,
        userId: session.user.id,
        startTime: new Date(),
        description: result.data.description || null,
        updatedAt: new Date(),
      })
      .returning({ id: projectTimesheets.id });
    await logProjectActivity(parsedId, session.user.id, "timesheet_timer_started", "Timer kerja dimulai.");
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal memulai timer") };
  }
}

export async function stopProjectTimer(projectId: string, data: unknown = {}) {
  const result = timesheetDescriptionSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  try {
    const parsedId = uuidSchema.parse(projectId);
    const { session, role } = await requireProjectMember(parsedId);
    if (role === "viewer") return { ok: false as const, error: "Viewer tidak bisa menghentikan timer." };
    const [active] = await db
      .select({ id: projectTimesheets.id, startTime: projectTimesheets.startTime, description: projectTimesheets.description })
      .from(projectTimesheets)
      .where(and(eq(projectTimesheets.projectId, parsedId), eq(projectTimesheets.userId, session.user.id), isNull(projectTimesheets.endTime)))
      .limit(1);
    if (!active) return { ok: false as const, error: "Tidak ada timer aktif untuk project ini." };
    const endTime = new Date();
    const [row] = await db
      .update(projectTimesheets)
      .set({
        endTime,
        durationMinutes: minutesBetween(active.startTime, endTime),
        description: result.data.description || active.description || null,
        updatedAt: new Date(),
      })
      .where(eq(projectTimesheets.id, active.id))
      .returning({ id: projectTimesheets.id, durationMinutes: projectTimesheets.durationMinutes });
    await logProjectActivity(parsedId, session.user.id, "timesheet_timer_stopped", `Timer kerja dihentikan (${row?.durationMinutes ?? 0} menit).`);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal menghentikan timer") };
  }
}

export async function createProjectTimesheet(projectId: string, data: unknown) {
  const result = timesheetSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  try {
    const parsedId = uuidSchema.parse(projectId);
    const { session, role } = await requireProjectMember(parsedId);
    if (role === "viewer") return { ok: false as const, error: "Viewer tidak bisa membuat timesheet." };
    const parsed = result.data;
    const endTime = parsed.endTime ?? null;
    const duration = parsed.durationMinutes ?? (endTime ? minutesBetween(parsed.startTime, endTime) : null);
    const [row] = await db
      .insert(projectTimesheets)
      .values({
        projectId: parsedId,
        userId: session.user.id,
        startTime: parsed.startTime,
        endTime,
        durationMinutes: duration,
        description: parsed.description || null,
        updatedAt: new Date(),
      })
      .returning({ id: projectTimesheets.id });
    await logProjectActivity(parsedId, session.user.id, "timesheet_created", "Timesheet manual ditambahkan.");
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal membuat timesheet") };
  }
}

export async function updateProjectTimesheet(timesheetId: string, data: unknown) {
  const result = timesheetSchema.safeParse(data);
  if (!result.success) return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  try {
    const parsedId = uuidSchema.parse(timesheetId);
    const [existing] = await db
      .select({ projectId: projectTimesheets.projectId, userId: projectTimesheets.userId })
      .from(projectTimesheets)
      .where(eq(projectTimesheets.id, parsedId))
      .limit(1);
    if (!existing) return { ok: false as const, error: "Timesheet tidak ditemukan." };
    const { session, role } = await requireProjectMember(existing.projectId);
    if (!canWrite(role) && existing.userId !== session.user.id) {
      return { ok: false as const, error: "Anda tidak memiliki izin mengubah timesheet ini." };
    }
    const parsed = result.data;
    const endTime = parsed.endTime ?? null;
    const duration = parsed.durationMinutes ?? (endTime ? minutesBetween(parsed.startTime, endTime) : null);
    const [row] = await db
      .update(projectTimesheets)
      .set({
        startTime: parsed.startTime,
        endTime,
        durationMinutes: duration,
        description: parsed.description || null,
        updatedAt: new Date(),
      })
      .where(eq(projectTimesheets.id, parsedId))
      .returning({ id: projectTimesheets.id });
    await logProjectActivity(existing.projectId, session.user.id, "timesheet_updated", "Timesheet diperbarui.");
    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal mengubah timesheet") };
  }
}

export async function deleteProjectTimesheet(timesheetId: string) {
  try {
    const parsedId = uuidSchema.parse(timesheetId);
    const [existing] = await db
      .select({ projectId: projectTimesheets.projectId, userId: projectTimesheets.userId })
      .from(projectTimesheets)
      .where(eq(projectTimesheets.id, parsedId))
      .limit(1);
    if (!existing) return { ok: false as const, error: "Timesheet tidak ditemukan." };
    const { session, role } = await requireProjectMember(existing.projectId);
    if (!canWrite(role) && existing.userId !== session.user.id) {
      return { ok: false as const, error: "Anda tidak memiliki izin menghapus timesheet ini." };
    }
    await db.delete(projectTimesheets).where(eq(projectTimesheets.id, parsedId));
    await logProjectActivity(existing.projectId, session.user.id, "timesheet_deleted", "Timesheet dihapus.");
    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: normalizeError(err, "Gagal menghapus timesheet") };
  }
}
