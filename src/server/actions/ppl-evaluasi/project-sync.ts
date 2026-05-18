"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  projects,
  projectMembers,
  projectSpeakers,
  projectTasks,
  projectActivityLog,
  pplKegiatan,
  pplKegiatanNarasumber,
  pplNarasumber,
  pplKuesionerResponse,
  pplKuesionerLink,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { computeConversionRate } from "@/lib/ppl-conversion-rate";
import type { ActionResult } from "./types";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface PplProjectSummary {
  kegiatanId: number;
  namaKegiatan: string;
  kategoriPpl: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  skp: number;
  pendaftar: number;
  realisasiHadir: number;
  conversionRate: number | null;
  responseCount: number;
  narasumberCount: number;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function mapKategoriToProjectType(kategori: string): "Workshop" | "Seminar" {
  // PPL kegiatan are typically workshops/seminars
  // Could be refined later based on actual usage patterns
  return "Workshop";
}

function generatePplTasks(
  projectId: string,
  userId: string,
  tanggalMulai: string,
  tanggalSelesai: string,
) {
  const startDate = new Date(tanggalMulai);
  const endDate = new Date(tanggalSelesai);

  // Helper to offset dates
  const offsetDate = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0]!;
  };

  return [
    {
      projectId,
      title: "Persiapan materi & rundown kegiatan",
      status: "todo" as const,
      dueDate: offsetDate(startDate, -7),
      relatedEntityType: "ppl_persiapan",
      relatedEntityId: "materi",
      createdBy: userId,
      updatedAt: new Date(),
    },
    {
      projectId,
      title: "Buat & link kuesioner evaluasi",
      status: "todo" as const,
      dueDate: offsetDate(startDate, -3),
      relatedEntityType: "ppl_kuesioner",
      relatedEntityId: "setup",
      createdBy: userId,
      updatedAt: new Date(),
    },
    {
      projectId,
      title: "Distribusi QR code kuesioner ke peserta",
      status: "todo" as const,
      dueDate: tanggalMulai,
      relatedEntityType: "ppl_distribusi",
      relatedEntityId: "qr",
      createdBy: userId,
      updatedAt: new Date(),
    },
    {
      projectId,
      title: "Input data kehadiran peserta",
      status: "todo" as const,
      dueDate: tanggalSelesai,
      relatedEntityType: "ppl_kehadiran",
      relatedEntityId: "input",
      createdBy: userId,
      updatedAt: new Date(),
    },
    {
      projectId,
      title: "Rekap evaluasi & export data",
      status: "todo" as const,
      dueDate: offsetDate(endDate, 3),
      relatedEntityType: "ppl_rekap",
      relatedEntityId: "export",
      createdBy: userId,
      updatedAt: new Date(),
    },
    {
      projectId,
      title: "Proses honorarium narasumber",
      status: "todo" as const,
      dueDate: offsetDate(endDate, 7),
      relatedEntityType: "ppl_honorarium",
      relatedEntityId: "proses",
      createdBy: userId,
      updatedAt: new Date(),
    },
  ];
}

// ─── AUTO-CREATE PROJECT ─────────────────────────────────────────────────────

/**
 * Creates a project linked to a PPL kegiatan.
 * Called automatically after createKegiatan succeeds.
 */
export async function createProjectForKegiatan(
  kegiatanId: number,
  data: {
    namaKegiatan: string;
    kategoriPpl: string;
    tipePelaksanaan: string;
    tanggalMulai: string;
    tanggalSelesai: string;
    lokasi?: string | null;
    skp: number;
  },
  userId: string,
): Promise<ActionResult<{ projectId: string }>> {
  try {
    // Check if project already exists for this kegiatan
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.pplKegiatanId, kegiatanId))
      .limit(1);

    if (existing) {
      return { ok: true, data: { projectId: existing.id } };
    }

    // Create the project
    const [project] = await db
      .insert(projects)
      .values({
        title: data.namaKegiatan,
        type: mapKategoriToProjectType(data.kategoriPpl),
        description: `Kegiatan PPL: ${data.namaKegiatan} (${data.kategoriPpl})`,
        startDate: data.tanggalMulai,
        endDate: data.tanggalSelesai,
        tipePelaksanaan: data.tipePelaksanaan as "online" | "offline" | "hybrid",
        lokasi: data.lokasi ?? null,
        skpMode: "manual",
        skp: String(data.skp),
        status: "not_started",
        pplKegiatanId: kegiatanId,
        createdBy: userId,
        updatedAt: new Date(),
      })
      .returning({ id: projects.id });

    if (!project) {
      return { ok: false, error: "Gagal membuat project" };
    }

    // Add creator as project owner
    await db.insert(projectMembers).values({
      projectId: project.id,
      userId,
      role: "owner",
      addedBy: userId,
    });

    // Generate initial PPL tasks
    const tasks = generatePplTasks(
      project.id,
      userId,
      data.tanggalMulai,
      data.tanggalSelesai,
    );
    await db.insert(projectTasks).values(tasks);

    // Log activity
    await db.insert(projectActivityLog).values({
      projectId: project.id,
      userId,
      action: "created",
      description: `Project "${data.namaKegiatan}" dibuat otomatis dari kegiatan PPL.`,
    });

    revalidatePath("/projects");
    return { ok: true, data: { projectId: project.id } };
  } catch (err) {
    console.error("[ppl-project-sync] createProjectForKegiatan failed:", err);
    return { ok: false, error: "Gagal membuat project kolaborasi" };
  }
}

// ─── SYNC NARASUMBER → PROJECT SPEAKERS ──────────────────────────────────────

/**
 * Syncs narasumber from a PPL kegiatan to the linked project's speakers.
 * Called after assignNarasumberToKegiatan.
 */
export async function syncNarasumberToProject(
  kegiatanId: number,
): Promise<ActionResult> {
  try {
    // Find the linked project
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.pplKegiatanId, kegiatanId))
      .limit(1);

    if (!project) {
      // No linked project, skip silently
      return { ok: true };
    }

    // Fetch all narasumber assigned to this kegiatan
    const assignments = await db
      .select({
        narasumberId: pplKegiatanNarasumber.narasumberId,
        topik: pplKegiatanNarasumber.topik,
        nama: pplNarasumber.nama,
        email: pplNarasumber.email,
      })
      .from(pplKegiatanNarasumber)
      .innerJoin(pplNarasumber, eq(pplKegiatanNarasumber.narasumberId, pplNarasumber.id))
      .where(eq(pplKegiatanNarasumber.kegiatanId, kegiatanId));

    // Get kegiatan SKP for speaker record
    const [kegiatan] = await db
      .select({ skp: pplKegiatan.skp })
      .from(pplKegiatan)
      .where(eq(pplKegiatan.id, kegiatanId))
      .limit(1);

    // Delete existing PPL-sourced speakers (identified by isExternal + no userId)
    // We'll use a simple approach: delete all external speakers and re-insert
    await db
      .delete(projectSpeakers)
      .where(
        and(
          eq(projectSpeakers.projectId, project.id),
          eq(projectSpeakers.isExternal, true),
        ),
      );

    // Insert narasumber as project speakers
    if (assignments.length > 0) {
      await db.insert(projectSpeakers).values(
        assignments.map((a) => ({
          projectId: project.id,
          nama: a.nama,
          email: a.email,
          topik: a.topik,
          skp: kegiatan ? String(kegiatan.skp) : null,
          isExternal: true,
        })),
      );
    }

    revalidatePath(`/projects/${project.id}`);
    return { ok: true };
  } catch (err) {
    console.error("[ppl-project-sync] syncNarasumberToProject failed:", err);
    return { ok: false, error: "Gagal sync narasumber ke project" };
  }
}

// ─── GET PPL SUMMARY BY PROJECT ──────────────────────────────────────────────

/**
 * Returns PPL kegiatan summary for a project.
 * Used in project detail page to show PPL data.
 */
export async function getPplSummaryByProject(
  projectId: string,
): Promise<PplProjectSummary | null> {
  const [project] = await db
    .select({ pplKegiatanId: projects.pplKegiatanId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project?.pplKegiatanId) return null;

  const [kegiatan] = await db
    .select({
      id: pplKegiatan.id,
      namaKegiatan: pplKegiatan.namaKegiatan,
      kategoriPpl: pplKegiatan.kategoriPpl,
      tanggalMulai: pplKegiatan.tanggalMulai,
      tanggalSelesai: pplKegiatan.tanggalSelesai,
      skp: pplKegiatan.skp,
      pendaftar: pplKegiatan.pendaftar,
      realisasiHadir: pplKegiatan.realisasiHadir,
    })
    .from(pplKegiatan)
    .where(eq(pplKegiatan.id, project.pplKegiatanId))
    .limit(1);

  if (!kegiatan) return null;

  // Count responses
  const responseRows = await db
    .select({ id: pplKuesionerResponse.id })
    .from(pplKuesionerResponse)
    .innerJoin(pplKuesionerLink, eq(pplKuesionerResponse.linkId, pplKuesionerLink.id))
    .where(eq(pplKuesionerLink.kegiatanId, kegiatan.id));

  // Count narasumber
  const narasumberRows = await db
    .select({ id: pplKegiatanNarasumber.id })
    .from(pplKegiatanNarasumber)
    .where(eq(pplKegiatanNarasumber.kegiatanId, kegiatan.id));

  return {
    kegiatanId: kegiatan.id,
    namaKegiatan: kegiatan.namaKegiatan,
    kategoriPpl: kegiatan.kategoriPpl,
    tanggalMulai: kegiatan.tanggalMulai,
    tanggalSelesai: kegiatan.tanggalSelesai,
    skp: kegiatan.skp,
    pendaftar: kegiatan.pendaftar,
    realisasiHadir: kegiatan.realisasiHadir,
    conversionRate: computeConversionRate(kegiatan.pendaftar, kegiatan.realisasiHadir),
    responseCount: responseRows.length,
    narasumberCount: narasumberRows.length,
  };
}

// ─── GET PROJECT ID BY KEGIATAN ──────────────────────────────────────────────

/**
 * Returns the project ID linked to a PPL kegiatan.
 * Used in PPL detail page to show link to project.
 */
export async function getProjectByKegiatanId(
  kegiatanId: number,
): Promise<{ id: string; title: string } | null> {
  await requirePermission("pplEvaluasi", "view");

  const [project] = await db
    .select({ id: projects.id, title: projects.title })
    .from(projects)
    .where(eq(projects.pplKegiatanId, kegiatanId))
    .limit(1);

  return project ?? null;
}

// ─── UPDATE PROJECT ON KEGIATAN CHANGE ───────────────────────────────────────

/**
 * Updates the linked project when kegiatan data changes.
 */
export async function syncKegiatanToProject(
  kegiatanId: number,
  data: {
    namaKegiatan?: string;
    tanggalMulai?: string;
    tanggalSelesai?: string;
    lokasi?: string | null;
    tipePelaksanaan?: string;
  },
): Promise<ActionResult> {
  try {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.pplKegiatanId, kegiatanId))
      .limit(1);

    if (!project) return { ok: true };

    const updateSet: Record<string, unknown> = { updatedAt: new Date() };

    if (data.namaKegiatan !== undefined) updateSet.title = data.namaKegiatan;
    if (data.tanggalMulai !== undefined) updateSet.startDate = data.tanggalMulai;
    if (data.tanggalSelesai !== undefined) updateSet.endDate = data.tanggalSelesai;
    if (data.lokasi !== undefined) updateSet.lokasi = data.lokasi;
    if (data.tipePelaksanaan !== undefined) updateSet.tipePelaksanaan = data.tipePelaksanaan;

    await db.update(projects).set(updateSet).where(eq(projects.id, project.id));

    revalidatePath(`/projects/${project.id}`);
    return { ok: true };
  } catch (err) {
    console.error("[ppl-project-sync] syncKegiatanToProject failed:", err);
    return { ok: false, error: "Gagal sync data ke project" };
  }
}


// ─── ARCHIVE LINKED PROJECT ──────────────────────────────────────────────────

/**
 * Sets the linked project status to "completed" when kegiatan is archived.
 */
export async function archiveLinkedProject(
  kegiatanId: number,
): Promise<ActionResult> {
  try {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.pplKegiatanId, kegiatanId))
      .limit(1);

    if (!project) return { ok: true };

    await db
      .update(projects)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(projects.id, project.id));

    revalidatePath(`/projects/${project.id}`);
    revalidatePath("/projects");
    return { ok: true };
  } catch (err) {
    console.error("[ppl-project-sync] archiveLinkedProject failed:", err);
    return { ok: false, error: "Gagal update status project" };
  }
}
