"use client";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
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
import { CircularProgress } from "./CircularProgress";
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
  canManage?: boolean;
  projectId?: string;
  onRefresh?: () => void;
}) {
  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const recentActivity = activity.slice(-5).reverse();

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_0.9fr]">
      <section className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <CircularProgress value={project.progress} />
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">{todoCount} To Do</Badge>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">
                {inProgressCount} In Progress
              </Badge>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                {doneCount} Done
              </Badge>
            </div>
          </div>
        </div>
        {recentActivity.length > 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">Aktivitas Terbaru</h3>
            <div className="space-y-2">
              {recentActivity.map((row) => (
                <div key={row.id} className="flex items-start gap-2 text-sm">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                  <div className="min-w-0">
                    <span className="font-medium">{row.userName ?? "User"}</span>
                    <span className="text-muted-foreground">
                      {" "}{row.description ?? row.action}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true, locale: id })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Deskripsi</h2>
        {project.description ? (
          <div
            className="prose prose-sm mt-4 max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: project.description }}
          />
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Belum ada deskripsi.
          </p>
        )}
        {files.length > 0 ? (
          <div className="mt-4">
            <Link
              href={`/projects/${project.id}?tab=files`}
              className="text-sm text-primary hover:underline"
            >
              {files.length} file terlampir →
            </Link>
          </div>
        ) : null}
      </section>
      <section className="space-y-4">
        {brevetSummary && projectId && onRefresh ? (
          <BrevetInfoCard
            projectId={projectId}
            summary={brevetSummary}
            canManage={canManage ?? false}
            onRefresh={onRefresh}
          />
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
            <Info label="Biaya" value={project.price ? `Rp ${Number(project.price).toLocaleString("id-ID")}` : "-"} />
            <Info label="Kapasitas" value={project.maxPeserta ? `${project.maxPeserta} peserta` : "Tidak terbatas"} />
            <Info label="Waiting List" value={project.isWaitlistEnabled ? "Aktif" : "Nonaktif"} />
            <Info label="Event" value={project.eventName ?? "-"} />
            <Info label="Dibuat oleh" value={project.createdByName ?? "-"} />
          </dl>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Anggota</h3>
          <div className="mt-3 flex items-center gap-1">
            {members.slice(0, 5).map((member) => (
              <Avatar key={member.userId} name={member.namaLengkap} avatarUrl={member.avatarUrl} />
            ))}
            {members.length > 5 ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-medium text-muted-foreground">
                +{members.length - 5}
              </div>
            ) : null}
            {members.length === 0 ? (
              <span className="text-xs text-muted-foreground">Belum ada anggota</span>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
