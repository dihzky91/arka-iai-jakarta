"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  instructors,
  peopleLink,
  pplKegiatanNarasumber,
  pplNarasumber,
  pplNarasumberExpertise,
  sessionAssignments,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import type { ActionResult } from "@/server/actions/ppl-evaluasi/types";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface UnifiedPerson {
  id: string; // composite: "ppl_{id}" or "ins_{id}" or "link_{id}"
  nama: string;
  email: string | null;
  noTelepon: string | null;

  isPplNarasumber: boolean;
  isBrevetInstructor: boolean;
  isInternalUser: boolean;

  pplNarasumberId: number | null;
  feePerSkp: number | null;
  pplExpertise: string[];
  pplKegiatanCount: number;

  instructorId: string | null;
  brevetSessionCount: number;

  userId: string | null;
  linkId: number | null;

  isActive: boolean;
  lastActiveAt: Date | null;
}

export interface ListPeopleOpts {
  search?: string;
  role?: "all" | "narasumber" | "instruktur" | "linked";
  page?: number;
  pageSize?: number;
}

// ─── LIST UNIFIED PEOPLE ─────────────────────────────────────────────────────

export async function listUnifiedPeople(
  opts: ListPeopleOpts = {},
): Promise<{ data: UnifiedPerson[]; total: number }> {
  await requirePermission("pplEvaluasi", "view");

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Strategy: query both tables, merge, deduplicate by link
  // Step 1: Get all linked pairs
  const links = await db.select().from(peopleLink);
  const linkedNarasumberIds = new Set(links.filter((l) => l.pplNarasumberId).map((l) => l.pplNarasumberId!));
  const linkedInstructorIds = new Set(links.filter((l) => l.instructorId).map((l) => l.instructorId!));

  // Step 2: Get all narasumber
  const narasumberRows = await db
    .select()
    .from(pplNarasumber)
    .orderBy(pplNarasumber.nama);

  // Step 3: Get all instructors
  const instructorRows = await db
    .select()
    .from(instructors)
    .orderBy(instructors.name);

  // Step 4: Get PPL expertise
  const expertiseRows = await db
    .select({
      narasumberId: pplNarasumberExpertise.narasumberId,
      kategoriPpl: pplNarasumberExpertise.kategoriPpl,
    })
    .from(pplNarasumberExpertise);

  const expertiseMap = new Map<number, string[]>();
  for (const row of expertiseRows) {
    const existing = expertiseMap.get(row.narasumberId) ?? [];
    existing.push(row.kategoriPpl);
    expertiseMap.set(row.narasumberId, existing);
  }

  // Step 5: Get PPL kegiatan counts
  const kegiatanCounts = await db
    .select({
      narasumberId: pplKegiatanNarasumber.narasumberId,
      count: count(),
    })
    .from(pplKegiatanNarasumber)
    .groupBy(pplKegiatanNarasumber.narasumberId);

  const kegiatanCountMap = new Map(kegiatanCounts.map((r) => [r.narasumberId, r.count]));

  // Step 6: Get brevet session counts
  const sessionCounts = await db
    .select({
      instructorId: sessionAssignments.plannedInstructorId,
      count: count(),
    })
    .from(sessionAssignments)
    .groupBy(sessionAssignments.plannedInstructorId);

  const sessionCountMap = new Map(sessionCounts.map((r) => [r.instructorId, r.count]));

  // Step 7: Build unified list
  const result: UnifiedPerson[] = [];
  const processedInstructorIds = new Set<string>();

  // Process narasumber (including linked ones)
  for (const nars of narasumberRows) {
    const link = links.find((l) => l.pplNarasumberId === nars.id);
    const linkedInstructor = link?.instructorId
      ? instructorRows.find((i) => i.id === link.instructorId)
      : null;

    if (linkedInstructor) {
      processedInstructorIds.add(linkedInstructor.id);
    }

    result.push({
      id: link ? `link_${link.id}` : `ppl_${nars.id}`,
      nama: nars.nama,
      email: nars.email,
      noTelepon: nars.noTelepon,
      isPplNarasumber: true,
      isBrevetInstructor: !!linkedInstructor,
      isInternalUser: !!link?.userId,
      pplNarasumberId: nars.id,
      feePerSkp: nars.feePerSkp,
      pplExpertise: expertiseMap.get(nars.id) ?? [],
      pplKegiatanCount: kegiatanCountMap.get(nars.id) ?? 0,
      instructorId: linkedInstructor?.id ?? null,
      brevetSessionCount: linkedInstructor ? (sessionCountMap.get(linkedInstructor.id) ?? 0) : 0,
      userId: link?.userId ?? null,
      linkId: link?.id ?? null,
      isActive: nars.isActive,
      lastActiveAt: nars.updatedAt,
    });
  }

  // Process unlinked instructors
  for (const ins of instructorRows) {
    if (processedInstructorIds.has(ins.id)) continue;

    const link = links.find((l) => l.instructorId === ins.id);

    result.push({
      id: link ? `link_${link.id}` : `ins_${ins.id}`,
      nama: ins.name,
      email: ins.email,
      noTelepon: ins.phone,
      isPplNarasumber: false,
      isBrevetInstructor: true,
      isInternalUser: !!link?.userId,
      pplNarasumberId: null,
      feePerSkp: null,
      pplExpertise: [],
      pplKegiatanCount: 0,
      instructorId: ins.id,
      brevetSessionCount: sessionCountMap.get(ins.id) ?? 0,
      userId: link?.userId ?? null,
      linkId: link?.id ?? null,
      isActive: ins.isActive,
      lastActiveAt: ins.updatedAt,
    });
  }

  // Apply filters
  let filtered = result;

  if (opts.search) {
    const q = opts.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.nama.toLowerCase().includes(q) ||
        (p.email?.toLowerCase().includes(q) ?? false),
    );
  }

  if (opts.role === "narasumber") {
    filtered = filtered.filter((p) => p.isPplNarasumber);
  } else if (opts.role === "instruktur") {
    filtered = filtered.filter((p) => p.isBrevetInstructor);
  } else if (opts.role === "linked") {
    filtered = filtered.filter((p) => p.isPplNarasumber && p.isBrevetInstructor);
  }

  // Sort by name
  filtered.sort((a, b) => a.nama.localeCompare(b.nama));

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + pageSize);

  return { data: paged, total };
}

// ─── LINK PEOPLE ─────────────────────────────────────────────────────────────

export async function linkPeople(
  pplNarasumberId: number,
  instructorId: string,
  userId?: string,
): Promise<ActionResult<{ id: number }>> {
  await requirePermission("pplEvaluasi", "manage");

  // Check if either is already linked
  const [existingNars] = await db
    .select({ id: peopleLink.id })
    .from(peopleLink)
    .where(eq(peopleLink.pplNarasumberId, pplNarasumberId))
    .limit(1);

  if (existingNars) {
    return { ok: false, error: "Narasumber ini sudah terhubung dengan orang lain" };
  }

  const [existingIns] = await db
    .select({ id: peopleLink.id })
    .from(peopleLink)
    .where(eq(peopleLink.instructorId, instructorId))
    .limit(1);

  if (existingIns) {
    return { ok: false, error: "Instruktur ini sudah terhubung dengan orang lain" };
  }

  const [row] = await db
    .insert(peopleLink)
    .values({
      pplNarasumberId,
      instructorId,
      userId: userId ?? null,
    })
    .returning({ id: peopleLink.id });

  if (!row) {
    return { ok: false, error: "Gagal membuat link" };
  }

  revalidatePath("/people");
  return { ok: true, data: { id: row.id } };
}

// ─── UNLINK PEOPLE ───────────────────────────────────────────────────────────

export async function unlinkPeople(linkId: number): Promise<ActionResult> {
  await requirePermission("pplEvaluasi", "manage");

  await db.delete(peopleLink).where(eq(peopleLink.id, linkId));

  revalidatePath("/people");
  return { ok: true };
}

// ─── AUTO-DETECT DUPLICATES ──────────────────────────────────────────────────

export interface DuplicateCandidate {
  pplNarasumberId: number;
  narasumberNama: string;
  narasumberEmail: string;
  instructorId: string;
  instructorName: string;
  instructorEmail: string | null;
}

export async function detectDuplicates(): Promise<DuplicateCandidate[]> {
  await requirePermission("pplEvaluasi", "manage");

  // Find narasumber and instructors with matching emails
  const narasumberRows = await db
    .select({ id: pplNarasumber.id, nama: pplNarasumber.nama, email: pplNarasumber.email })
    .from(pplNarasumber)
    .where(eq(pplNarasumber.isActive, true));

  const instructorRows = await db
    .select({ id: instructors.id, name: instructors.name, email: instructors.email })
    .from(instructors)
    .where(eq(instructors.isActive, true));

  // Get already linked IDs to exclude
  const links = await db.select().from(peopleLink);
  const linkedNarsIds = new Set(links.filter((l) => l.pplNarasumberId).map((l) => l.pplNarasumberId!));
  const linkedInsIds = new Set(links.filter((l) => l.instructorId).map((l) => l.instructorId!));

  const candidates: DuplicateCandidate[] = [];

  for (const nars of narasumberRows) {
    if (linkedNarsIds.has(nars.id)) continue;

    for (const ins of instructorRows) {
      if (linkedInsIds.has(ins.id)) continue;
      if (!ins.email) continue;

      if (nars.email.toLowerCase() === ins.email.toLowerCase()) {
        candidates.push({
          pplNarasumberId: nars.id,
          narasumberNama: nars.nama,
          narasumberEmail: nars.email,
          instructorId: ins.id,
          instructorName: ins.name,
          instructorEmail: ins.email,
        });
      }
    }
  }

  return candidates;
}
