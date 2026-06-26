"use server";

import { revalidatePath } from "next/cache";
import { revalidateDashboardTag } from "@/server/actions/statistics";
import { DASHBOARD_TAGS } from "@/lib/dashboard-cache-tags";

/**
 * Revalidate all honorarium-related paths.
 * Call this after any batch mutation to ensure UI consistency.
 */
export async function revalidateHonorariumPaths(batchId?: string) {
  revalidatePath("/jadwal-otomatis/honorarium");
  revalidatePath("/keuangan");
  revalidatePath("/keuangan/honorarium");

  if (batchId) {
    revalidatePath(`/jadwal-otomatis/honorarium/${batchId}`);
    revalidatePath(`/keuangan/honorarium/${batchId}`);
  }

  await revalidateDashboardTag(DASHBOARD_TAGS.keuangan);
}
