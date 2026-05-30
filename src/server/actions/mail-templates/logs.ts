"use server";

import { db } from "@/server/db";
import { emailSendLogs } from "@/server/db/schema";
import { eq, and, gte, lte, sql, desc, count } from "drizzle-orm";

interface LogFilters {
  templateKey?: string;
  status?: "sent" | "failed" | "bounced";
  dateFrom?: string; // ISO date
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * List send logs with filters and pagination.
 */
export async function listSendLogs(filters?: LogFilters) {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (filters?.templateKey) {
    conditions.push(eq(emailSendLogs.templateKey, filters.templateKey));
  }
  if (filters?.status) {
    conditions.push(eq(emailSendLogs.status, filters.status));
  }
  if (filters?.dateFrom) {
    conditions.push(gte(emailSendLogs.sentAt, new Date(filters.dateFrom)));
  }
  if (filters?.dateTo) {
    conditions.push(lte(emailSendLogs.sentAt, new Date(filters.dateTo)));
  }

  // Exclude test sends from normal view
  conditions.push(
    sql`${emailSendLogs.templateKey} != '__test_send__' OR ${emailSendLogs.templateKey} IS NULL`,
  );

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, totalResult] = await Promise.all([
    db
      .select()
      .from(emailSendLogs)
      .where(where)
      .orderBy(desc(emailSendLogs.sentAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(emailSendLogs)
      .where(where),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get summary statistics for send logs.
 */
export async function getSendLogStats() {
  const [totalResult, sentResult, failedResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(emailSendLogs)
      .where(sql`${emailSendLogs.templateKey} != '__test_send__' OR ${emailSendLogs.templateKey} IS NULL`),
    db
      .select({ count: count() })
      .from(emailSendLogs)
      .where(
        and(
          eq(emailSendLogs.status, "sent"),
          sql`${emailSendLogs.templateKey} != '__test_send__' OR ${emailSendLogs.templateKey} IS NULL`,
        ),
      ),
    db
      .select({ count: count() })
      .from(emailSendLogs)
      .where(
        and(
          eq(emailSendLogs.status, "failed"),
          sql`${emailSendLogs.templateKey} != '__test_send__' OR ${emailSendLogs.templateKey} IS NULL`,
        ),
      ),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);
  const sent = Number(sentResult[0]?.count ?? 0);
  const failed = Number(failedResult[0]?.count ?? 0);
  const successRate = total > 0 ? Math.round((sent / total) * 100) : 0;

  return { total, sent, failed, successRate };
}

/**
 * Retry a failed email send.
 */
export async function retryFailedEmail(logId: string) {
  const result = await db
    .select()
    .from(emailSendLogs)
    .where(eq(emailSendLogs.id, logId))
    .limit(1);

  const log = result[0];
  if (!log) return { success: false, error: "Log tidak ditemukan" };
  if (log.status !== "failed") return { success: false, error: "Hanya email gagal yang bisa di-retry" };

  // We don't have the original HTML stored in logs, so we just mark it
  // In a real implementation, you'd re-trigger sendTemplatedEmail
  // For now, return info that retry needs the template engine
  return {
    success: false,
    error: "Retry memerlukan re-send melalui template engine. Gunakan Test Send dari editor template.",
  };
}

/**
 * Prune old logs (older than specified days).
 */
export async function pruneSendLogs(olderThanDays: number = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await db
    .delete(emailSendLogs)
    .where(lte(emailSendLogs.sentAt, cutoff))
    .returning({ id: emailSendLogs.id });

  return { deleted: result.length };
}
