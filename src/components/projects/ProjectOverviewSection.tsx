"use client";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTanggal } from "@/lib/utils";
import { formatSKP } from "@/lib/skp-calculator";
import { PROJECT_TYPE_LABELS } from "@/lib/project-constants";
import {
  type ProjectDetailRow,
  type ProjectTaskRow,
  type ProjectActivityRow,
  type ProjectMemberRow,
  type ProjectFileRow,
  type BrevetSummary,
  type HonorariumSummary,
  type InvoiceKuitansiSummary,
  type ProjectCertificateInfo,
} from "@/server/actions/projects";
import { Avatar } from "./ProjectAvatar";
import { BrevetInfoCard } from "./BrevetInfoCard";
import { HonorariumCard } from "./HonorariumCard";
import { CertificateSection } from "./CertificateSection";
import { InvoiceKuitansiSection } from "./InvoiceKuitansiSection";
import { AnnouncementQuickActions } from "./AnnouncementQuickActions";
import { statusLabel } from "@/lib/project-display-utils";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function Overview({
  project,
  tasks,
  activity,
  members,
  files,
  brevetSummary,
  honorariumSummary,
  invoiceKuitansiSummary,
  certificateInfo,
  pplSummary,
  canManage,
  projectId,
  onRefresh,
}: {
  project: ProjectDetailRow;
  tasks: ProjectTaskRow[];
  activity: ProjectActivityRow[];
  members: ProjectMemberRow[];
  files: ProjectFileRow[];
  brevetSummary?: BrevetSummary | null;
  honorariumSummary?: HonorariumSummary | null;
  invoiceKuitansiSummary?: InvoiceKuitansiSummary;
  certificateInfo?: ProjectCertificateInfo | null;
  pplSummary?: { kegiatanId: number; namaKegiatan: string; kategoriPpl: string; tanggalMulai: string; tanggalSelesai: string; skp: number; pendaftar: number; realisasiHadir: number; conversionRate: number | null; responseCount: number; narasumberCount: number } | null;
  canManage?: boolean;
  projectId?: string;
  onRefresh?: () => void;
}) {
  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const recentActivity = activity.slice(-5).reverse();

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="space-y-4">
        {/* Progress + Task Checklist Preview */}
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-semibold tabular-nums text-foreground">{project.progress}%</span>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">{todoCount} To Do</Badge>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/30 dark:text-blue-300 text-xs">
                {inProgressCount} In Progress
              </Badge>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300 text-xs">
                {doneCount} Done
              </Badge>
            </div>
          </div>
          {/* Deskripsi inline */}
          {project.description ? (
            <div className="mt-3 max-h-32 overflow-y-auto border-t border-border/40 pt-3">
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: project.description }}
              />
            </div>
          ) : null}
        </div>

        {/* Checklist Preview — top tasks */}
        {tasks.length > 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Checklist Preview</h3>
            <div className="space-y-2">
              {tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-start gap-2.5">
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${task.status === "done" ? "border-emerald-500 bg-emerald-500" : "border-border"}`}>
                    {task.status === "done" ? (
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    ) : null}
                  </div>
                  <span className={`text-sm ${task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {task.title}
                  </span>
                </div>
              ))}
              {tasks.length > 5 ? (
                <p className="text-xs text-muted-foreground">+{tasks.length - 5} task lainnya</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Aktivitas Terbaru */}
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aktivitas Terbaru</h3>
          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((row) => (
                <div key={row.id} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/50" />
                  <div className="min-w-0">
                    <p>
                      <span className="font-medium">{row.userName ?? "User"}</span>{" "}
                      <span className="text-muted-foreground">{row.description ?? row.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true, locale: id })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aktivitas project akan tercatat saat ada perubahan task, file, atau komentar.
            </p>
          )}
        </div>

        {/* Anggota Terdaftar — dengan nama + role */}
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anggota Terdaftar</h3>
            {members.length > 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => {/* setActiveTab handled by parent */}}
              >
                Kelola Anggota
              </button>
            ) : null}
          </div>
          {members.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {members.slice(0, 6).map((member) => (
                <div key={member.userId} className="flex items-center gap-2.5 rounded-lg border border-border/40 px-3 py-2">
                  <Avatar name={member.namaLengkap} avatarUrl={member.avatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{member.namaLengkap}</p>
                    <p className="truncate text-xs text-muted-foreground capitalize">{member.role ?? "member"}</p>
                  </div>
                </div>
              ))}
              {members.length > 6 ? (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  +{members.length - 6} anggota lainnya
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Belum ada anggota.</p>
          )}
        </div>
      </section>

      {/* Sidebar metadata */}
      <section className="space-y-4">
        {brevetSummary && projectId && onRefresh ? (
          <BrevetInfoCard
            projectId={projectId}
            summary={brevetSummary}
            canManage={canManage ?? false}
            onRefresh={onRefresh}
          />
        ) : null}
        {pplSummary ? (
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-xs font-bold">P</span>
              PPL Evaluasi
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Kategori</dt>
                <dd className="font-medium">{pplSummary.kategoriPpl}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">SKP</dt>
                <dd className="font-medium">{pplSummary.skp}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pendaftar</dt>
                <dd className="font-medium">{pplSummary.pendaftar}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Hadir</dt>
                <dd className="font-medium">{pplSummary.realisasiHadir}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Conversion</dt>
                <dd className="font-medium">{pplSummary.conversionRate != null ? `${pplSummary.conversionRate.toFixed(1)}%` : "N/A"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Respons</dt>
                <dd className="font-medium">{pplSummary.responseCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Narasumber</dt>
                <dd className="font-medium">{pplSummary.narasumberCount}</dd>
              </div>
            </dl>
            <a
              href={`/ppl-evaluasi/${pplSummary.kegiatanId}`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Lihat detail kegiatan →
            </a>
          </div>
        ) : null}
        {projectId ? (
          <HonorariumCard
            projectId={projectId}
            initialSummary={honorariumSummary}
          />
        ) : null}
        {projectId && certificateInfo !== undefined ? (
          <CertificateSection
            projectId={projectId}
            initialInfo={certificateInfo}
          />
        ) : null}
        {projectId ? (
          <InvoiceKuitansiSection
            projectId={projectId}
            initialSummary={invoiceKuitansiSummary}
          />
        ) : null}
        <AnnouncementQuickActions
          projectId={projectId ?? project.id}
          canManage={canManage ?? false}
          onComplete={() => onRefresh?.()}
        />
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Detail</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Info label="Tipe" value={PROJECT_TYPE_LABELS[project.type] ?? project.type} />
            <Info label="Status" value={statusLabel(project.status)} />
            <Info label="Tanggal" value={`${formatTanggal(project.startDate)} - ${formatTanggal(project.endDate)}`} />
            <Info label="SKP" value={formatSKP(project.skp)} />
            <Info label="Tipe Pelaks." value={project.tipePelaksanaan ? (project.tipePelaksanaan.charAt(0).toUpperCase() + project.tipePelaksanaan.slice(1)) : "-"} />
            <Info label="Waktu" value={project.waktuMulai && project.waktuSelesai ? `${project.waktuMulai} - ${project.waktuSelesai}` : "-"} />
            <Info label="Lokasi" value={project.lokasi ?? "-"} />
            <Info label="Harga Anggota" value={project.priceMember ? `Rp ${Number(project.priceMember).toLocaleString("id-ID")}` : "-"} />
            <Info label="Harga Non-Anggota" value={project.priceNonMember ? `Rp ${Number(project.priceNonMember).toLocaleString("id-ID")}` : "-"} />
            <Info label="Kapasitas" value={project.maxPeserta ? `${project.maxPeserta} peserta` : "Tidak terbatas"} />
            <Info label="Waiting List" value={project.isWaitlistEnabled ? "Aktif" : "Nonaktif"} />
            <Info label="Event" value={project.eventName ?? "-"} />
            <Info label="Dibuat oleh" value={project.createdByName ?? "-"} />
          </dl>
        </div>
      </section>
    </div>
  );
}
