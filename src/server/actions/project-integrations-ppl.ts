"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  projects,
  projectSpeakers,
  kelasUjian,
  kelasPelatihan,
  classSessions,
  sessionAssignments,
  instructors,
} from "@/server/db/schema";
import { requireProjectMember } from "./_project-shared";

// ─── SYNC BREVET INSTRUCTORS → PROJECT SPEAKERS ─────────────────────────────

/**
 * Syncs instructors from a linked kelasPelatihan to the project's speakers.
 * Flow: project → kelasUjianId → kelasUjian.kelasPelatihanId → classSessions → sessionAssignments → instructors
 */
export async function syncBrevetInstructors(projectId: string) {
  await requireProjectMember(projectId);

  // Get the linked kelasUjian
  const [project] = await db
    .select({ kelasUjianId: projects.kelasUjianId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project?.kelasUjianId) {
    return { ok: false as const, error: "Project tidak terhubung ke kelas ujian." };
  }

  // Get the kelasPelatihan linked to this kelasUjian
  const [kelas] = await db
    .select({ kelasPelatihanId: kelasUjian.kelasPelatihanId })
    .from(kelasUjian)
    .where(eq(kelasUjian.id, project.kelasUjianId))
    .limit(1);

  if (!kelas?.kelasPelatihanId) {
    return { ok: false as const, error: "Kelas ujian tidak terhubung ke kelas pelatihan." };
  }

  // Get all sessions for this kelas pelatihan (non-exam days only)
  const sessions = await db
    .select({ id: classSessions.id, materiName: classSessions.materiName })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.kelasId, kelas.kelasPelatihanId),
        eq(classSessions.isExamDay, false),
      ),
    );

  if (sessions.length === 0) {
    return { ok: true as const, count: 0 };
  }

  const sessionIds = sessions.map((s) => s.id);

  // Get all instructor assignments for these sessions
  const assignments = await db
    .select({
      instructorId: sessionAssignments.plannedInstructorId,
      sessionId: sessionAssignments.sessionId,
      instructorName: instructors.name,
      instructorEmail: instructors.email,
    })
    .from(sessionAssignments)
    .innerJoin(instructors, eq(sessionAssignments.plannedInstructorId, instructors.id))
    .where(
      // Filter by sessions in this kelas
      eq(classSessions.kelasId, kelas.kelasPelatihanId),
    );

  // Actually, let's do a proper join through classSessions
  const instructorAssignments = await db
    .select({
      instructorId: instructors.id,
      instructorName: instructors.name,
      instructorEmail: instructors.email,
      materiName: classSessions.materiName,
    })
    .from(sessionAssignments)
    .innerJoin(classSessions, eq(sessionAssignments.sessionId, classSessions.id))
    .innerJoin(instructors, eq(sessionAssignments.plannedInstructorId, instructors.id))
    .where(
      and(
        eq(classSessions.kelasId, kelas.kelasPelatihanId),
        eq(classSessions.isExamDay, false),
      ),
    );

  // Deduplicate instructors and collect their materi
  const instructorMap = new Map<string, {
    name: string;
    email: string | null;
    materiSet: Set<string>;
  }>();

  for (const row of instructorAssignments) {
    const existing = instructorMap.get(row.instructorId);
    if (existing) {
      if (row.materiName) existing.materiSet.add(row.materiName);
    } else {
      instructorMap.set(row.instructorId, {
        name: row.instructorName,
        email: row.instructorEmail,
        materiSet: new Set(row.materiName ? [row.materiName] : []),
      });
    }
  }

  // Delete existing external speakers from this project (brevet instructors)
  await db
    .delete(projectSpeakers)
    .where(
      and(
        eq(projectSpeakers.projectId, projectId),
        eq(projectSpeakers.isExternal, true),
      ),
    );

  // Insert instructors as project speakers
  const speakerValues = Array.from(instructorMap.entries()).map(([, data]) => ({
    projectId,
    nama: data.name,
    email: data.email,
    topik: Array.from(data.materiSet).join(", ") || null,
    isExternal: true,
  }));

  if (speakerValues.length > 0) {
    await db.insert(projectSpeakers).values(speakerValues);
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const, count: speakerValues.length };
}
