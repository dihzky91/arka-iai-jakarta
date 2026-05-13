"use server";

import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/server/db";
import {
  events,
  honorariumBatches,
  honorariumItems,
  invoices,
  kuitansi,
  participants,
  projectMilestones,
  projects,
} from "@/server/db/schema";
import {
  uuidSchema,
  logProjectActivity,
  requireProjectMember,
} from "./_project-shared";
import { requireSession } from "./auth";

// ─── 7.1 Honorarium Summary ──────────────────────────────────────────────────

export type HonorariumSummary = {
  batchCount: number;
  totalGrossAmount: number;
  totalNarasumber: number;
  statusCounts: Record<string, number>;
  batches: Array<{
    id: string;
    documentNumber: string;
    status: string;
    totalAmount: number;
    itemCount: number;
  }>;
};

export async function getHonorariumSummaryByProject(
  projectId: string,
): Promise<HonorariumSummary | null> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  const [project] = await db
    .select({ startDate: projects.startDate, endDate: projects.endDate })
    .from(projects)
    .where(eq(projects.id, parsedId))
    .limit(1);

  if (!project) return null;

  let batchRows: Array<{ id: string; documentNumber: string; status: string }> = [];

  if (project.startDate && project.endDate) {
    batchRows = await db
      .select({
        id: honorariumBatches.id,
        documentNumber: honorariumBatches.documentNumber,
        status: honorariumBatches.status,
      })
      .from(honorariumBatches)
      .where(
        and(
          gte(honorariumBatches.periodEnd, project.startDate),
          lte(honorariumBatches.periodStart, project.endDate),
        ),
      )
      .orderBy(desc(honorariumBatches.createdAt))
      .limit(10);
  }

  if (batchRows.length === 0) {
    batchRows = await db
      .select({
        id: honorariumBatches.id,
        documentNumber: honorariumBatches.documentNumber,
        status: honorariumBatches.status,
      })
      .from(honorariumBatches)
      .orderBy(desc(honorariumBatches.createdAt))
      .limit(5);
  }

  if (batchRows.length === 0) return null;

  const batchIds = batchRows.map((r) => r.id);

  const [aggregateRows, distinctInstructors] = await Promise.all([
    db
      .select({
        batchId: honorariumItems.batchId,
        totalItems: count(),
        totalAmount: honorariumItems.amount,
      })
      .from(honorariumItems)
      .where(inArray(honorariumItems.batchId, batchIds))
      .groupBy(honorariumItems.batchId, honorariumItems.amount),
    db
      .select({
        batchId: honorariumItems.batchId,
        instructorId: honorariumItems.paidInstructorId,
      })
      .from(honorariumItems)
      .where(inArray(honorariumItems.batchId, batchIds)),
  ]);

  const instructorSet = new Set(distinctInstructors.map((r) => r.instructorId));
  const aggMap = new Map<string, { itemCount: number; totalAmount: number }>();
  for (const agg of aggregateRows) {
    const current = aggMap.get(agg.batchId) ?? { itemCount: 0, totalAmount: 0 };
    current.itemCount += Number(agg.totalItems ?? 0);
    current.totalAmount += Number(agg.totalAmount ?? 0);
    aggMap.set(agg.batchId, current);
  }

  const statusCounts: Record<string, number> = {};
  for (const row of batchRows) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  }

  const totalGrossAmount = Array.from(aggMap.values()).reduce(
    (sum, a) => sum + a.totalAmount,
    0,
  );

  return {
    batchCount: batchRows.length,
    totalGrossAmount,
    totalNarasumber: instructorSet.size,
    statusCounts,
    batches: batchRows.map((row) => {
      const agg = aggMap.get(row.id);
      return {
        id: row.id,
        documentNumber: row.documentNumber,
        status: row.status,
        totalAmount: agg?.totalAmount ?? 0,
        itemCount: agg?.itemCount ?? 0,
      };
    }),
  };
}

// ─── 7.2 Invoice & Kuitansi Summary ──────────────────────────────────────────

export type InvoiceKuitansiSummary = {
  invoices: Array<{
    id: string;
    nomorSurat: string | null;
    perihal: string;
    total: string;
    status: string | null;
    createdAt: Date | null;
  }>;
  kuitansi: Array<{
    id: string;
    nomorKuitansi: string | null;
    uraian: string;
    jumlah: string;
    status: string | null;
    createdAt: Date | null;
  }>;
};

export async function getInvoicesByProject(
  projectId: string,
): Promise<InvoiceKuitansiSummary> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  const invoiceRows = await db
    .select({
      id: invoices.id,
      nomorSurat: invoices.nomorSurat,
      perihal: invoices.perihal,
      total: invoices.total,
      status: invoices.status,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(eq(invoices.projectId, parsedId))
    .orderBy(desc(invoices.createdAt))
    .limit(10);

  const kuitansiRows = await db
    .select({
      id: kuitansi.id,
      nomorKuitansi: kuitansi.nomorKuitansi,
      uraian: kuitansi.uraian,
      jumlah: kuitansi.jumlah,
      status: kuitansi.status,
      createdAt: kuitansi.createdAt,
    })
    .from(kuitansi)
    .where(eq(kuitansi.projectId, parsedId))
    .orderBy(desc(kuitansi.createdAt))
    .limit(10);

  return { invoices: invoiceRows, kuitansi: kuitansiRows };
}

// ─── 7.3 Certificate Info ────────────────────────────────────────────────────

export type ProjectCertificateInfo = {
  eventId: number | null;
  eventName: string | null;
  participantCount: number;
  status: string | null;
};

export async function getProjectCertificateInfo(
  projectId: string,
): Promise<ProjectCertificateInfo | null> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  const [project] = await db
    .select({ eventId: projects.eventId, status: projects.status })
    .from(projects)
    .where(eq(projects.id, parsedId))
    .limit(1);

  if (!project?.eventId) {
    return {
      eventId: null,
      eventName: null,
      participantCount: 0,
      status: project?.status ?? null,
    };
  }

  const [eventRow] = await db
    .select({ namaKegiatan: events.namaKegiatan })
    .from(events)
    .where(eq(events.id, project.eventId))
    .limit(1);

  const [participantAgg] = await db
    .select({ total: count() })
    .from(participants)
    .where(eq(participants.eventId, project.eventId));

  return {
    eventId: project.eventId,
    eventName: eventRow?.namaKegiatan ?? null,
    participantCount: Number(participantAgg?.total ?? 0),
    status: project.status,
  };
}

// ─── 7.4 Calendar Entries ────────────────────────────────────────────────────

export async function getProjectCalendarEntries(
  year: number,
  month: number,
): Promise<
  Array<{
    projectId: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
    milestones: Array<{ title: string; targetDate: string | null }>;
  }>
> {
  await requireSession();
  const monthStr = String(month).padStart(2, "0");
  const startIso = `${year}-${monthStr}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endIso = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const projectRows = await db
    .select({
      projectId: projects.id,
      title: projects.title,
      startDate: projects.startDate,
      endDate: projects.endDate,
    })
    .from(projects)
    .where(
      and(
        gte(projects.startDate ?? projects.createdAt, startIso),
        lte(projects.endDate ?? projects.startDate ?? projects.createdAt, endIso),
      ),
    )
    .limit(50);

  if (projectRows.length === 0) return [];

  const projectIds = projectRows.map((p) => p.projectId);

  const milestoneRows = await db
    .select({
      projectId: projectMilestones.projectId,
      title: projectMilestones.title,
      targetDate: projectMilestones.targetDate,
    })
    .from(projectMilestones)
    .where(
      and(
        inArray(projectMilestones.projectId, projectIds),
        gte(projectMilestones.targetDate ?? "", startIso),
        lte(projectMilestones.targetDate ?? "", endIso),
      ),
    );

  const milestoneMap = new Map<
    string,
    Array<{ title: string; targetDate: string | null }>
  >();
  for (const m of milestoneRows) {
    if (!m.projectId) continue;
    const list = milestoneMap.get(m.projectId) ?? [];
    list.push({ title: m.title, targetDate: m.targetDate });
    milestoneMap.set(m.projectId, list);
  }

  return projectRows.map((p) => ({
    projectId: p.projectId,
    title: p.title,
    startDate: p.startDate,
    endDate: p.endDate,
    milestones: milestoneMap.get(p.projectId) ?? [],
  }));
}

// ─── 7.5 Announcement From Project ──────────────────────────────────────────

export async function createAnnouncementFromProject(
  projectId: string,
  type: "open_registration" | "training_completed",
  additionalNotes?: string,
) {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  const [project] = await db
    .select({
      title: projects.title,
      startDate: projects.startDate,
      endDate: projects.endDate,
      lokasi: projects.lokasi,
      tipePelaksanaan: projects.tipePelaksanaan,
      waktuMulai: projects.waktuMulai,
      waktuSelesai: projects.waktuSelesai,
      priceMember: projects.priceMember,
    })
    .from(projects)
    .where(eq(projects.id, parsedId))
    .limit(1);

  if (!project) return { ok: false as const, error: "Project tidak ditemukan." };

  const tipe = project.tipePelaksanaan ?? "offline";
  const lokasi = project.lokasi ?? "-";
  const waktu =
    project.waktuMulai && project.waktuSelesai
      ? `${project.waktuMulai} - ${project.waktuSelesai}`
      : "-";
  const harga = project.priceMember
    ? `Rp ${Number(project.priceMember).toLocaleString("id-ID")}`
    : "Gratis";
  const notes = additionalNotes ? `<p>${additionalNotes}</p>` : "";

  const description =
    type === "open_registration"
      ? `<p><strong>Pendaftaran ${project.title} telah dibuka!</strong></p>${notes}<ul><li>Tipe: ${tipe}</li><li>Lokasi: ${lokasi}</li><li>Waktu: ${waktu}</li><li>Harga Anggota: ${harga}</li><li>Tanggal: ${project.startDate ?? "-"} s/d ${project.endDate ?? "-"}</li></ul>`
      : `<p><strong>Pelatihan ${project.title} telah selesai dilaksanakan.</strong></p>${notes}<ul><li>Periode: ${project.startDate ?? "-"} s/d ${project.endDate ?? "-"}</li><li>Tipe: ${tipe}</li><li>Lokasi: ${lokasi}</li></ul>`;

  return createAnnouncementAction(
    parsedId,
    project.title,
    description,
    type,
  );
}

async function createAnnouncementAction(
  projectId: string,
  projectTitle: string,
  description: string,
  announcementType: "open_registration" | "training_completed",
) {
  const { createAnnouncement } = await import("./announcements");
  const session = await requireSession();
  const today = new Date().toISOString().slice(0, 10);
  const endDate = new Date(Date.now() + 90 * 86400000)
    .toISOString()
    .slice(0, 10);

  const result = await createAnnouncement({
    title: `Pengumuman: ${announcementType === "open_registration" ? "Pendaftaran" : "Pelatihan Selesai"} - ${projectTitle}`,
    description,
    startDate: today,
    endDate,
    audience: { all: true, roles: [], divisiIds: [] },
    attachments: [],
    isPinned: false,
    requiresAck: false,
    status: "published",
  });

  if (result.ok) {
    const label =
      announcementType === "open_registration"
        ? "Buka Pendaftaran"
        : "Pelatihan Selesai";
    await logProjectActivity(
      projectId,
      session.user.id,
      "announcement_created",
      `Pengumuman "${label}" dibuat untuk "${projectTitle}".`,
    );
  }

  return result;
}

// ─── Combined Summary for Overview ────────────────────────────────────────────

export type ProjectIntegrationsSummary = {
  honorarium: HonorariumSummary | null;
  invoiceKuitansi: InvoiceKuitansiSummary;
  certificate: ProjectCertificateInfo | null;
};

export async function getProjectIntegrationsSummary(
  projectId: string,
): Promise<ProjectIntegrationsSummary> {
  const [honorarium, invoiceKuitansi, certificate] = await Promise.all([
    getHonorariumSummaryByProject(projectId).catch(() => null),
    getInvoicesByProject(projectId),
    getProjectCertificateInfo(projectId),
  ]);

  return {
    honorarium,
    invoiceKuitansi,
    certificate,
  };
}
