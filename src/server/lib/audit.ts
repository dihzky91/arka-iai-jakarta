import { db } from "@/server/db";
import { auditLog } from "@/server/db/schema";

type AuditLogEntry = {
  userId: string;
  aksi: string;
  entitasType: string;
  entitasId: string;
  detail?: Record<string, unknown> | null;
};

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  await db.insert(auditLog).values(entry);
}
