"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import {
  Archive,
  Bold,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileUp,
  ImageIcon,
  Italic,
  List,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Save,
  Square,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { splitMentions } from "@/lib/mention-parser";
import { formatSKP } from "@/lib/skp-calculator";
import { formatTanggal, formatTanggalWaktuJakarta } from "@/lib/utils";
import {
  PROJECT_MEMBER_ROLES,
  PROJECT_TYPE_LABELS,
  type ProjectMemberRole,
  type ProjectStatus,
  type ProjectTaskStatus,
} from "@/lib/project-constants";
import {
  addProjectMembers,
  createComment,
  createProjectBudgetItem,
  createProjectExpense,
  createProjectSpeaker,
  createProjectTimesheet,
  deleteProjectBudgetItem,
  deleteProjectExpense,
  deleteProjectFile,
  deleteProjectSpeaker,
  deleteProjectTimesheet,
  duplicateProject,
  getBrevetSummaryByProject,
  getProjectMembers,
  listComments,
  listProjectActivity,
  listProjectFiles,
  listProjectNotes,
  listProjectTasks,
  listProjectMilestones,
  searchUsersForInvite,
  startProjectTimer,
  stopProjectTimer,
  toggleProjectTemplate,
  updateMemberRole,
  updateProjectBudgetItem,
  updateProjectExpense,
  updateProjectSpeaker,
  updateProjectTimesheet,
  removeProjectMember,
  updateProjectStatus,
  uploadProjectFile,
  type BrevetSummary,
  type InviteUserRow,
  getProjectFinancialSummary,
  getProjectTimesheetSummary,
  listProjectBudgetItems,
  listProjectExpenses,
  listProjectSpeakers,
  listProjectTimesheets,
  type ProjectActivityRow,
  type ProjectBudgetItemRow,
  type ProjectCommentRow,
  type ProjectDetailRow,
  type ProjectExpenseRow,
  type ProjectFileRow,
  type ProjectFinancialSummary,
  type ProjectMemberRow,
  type ProjectMilestoneRow,
  type ProjectNoteRow,
  type ProjectSpeakerRow,
  type ProjectTaskRow,
  type ProjectTimesheetRow,
  type ProjectTimesheetSummary,
} from "@/server/actions/projects";
import { TaskSection } from "@/components/projects/TaskSection";
import { MilestoneSection } from "@/components/projects/MilestoneSection";
import { BrevetInfoCard } from "@/components/projects/BrevetInfoCard";
import { NoteSection } from "@/components/projects/NoteSection";


function statusLabel(status: ProjectStatus) {
  const labels: Record<ProjectStatus, string> = {
    not_started: "Belum mulai",
    in_progress: "Berjalan",
    on_hold: "Tertunda",
    completed: "Selesai",
    cancelled: "Dibatalkan",
  };
  return labels[status];
}

function fileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("word") || mimeType.includes("document")) return FileText;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z")) return Archive;
  return File;
}

function canManage(role: ProjectMemberRole | "admin") {
  return role === "admin" || role === "owner" || role === "manager";
}

function canContribute(role: ProjectMemberRole | "admin") {
  return canManage(role) || role === "member";
}

function Avatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "h-8 w-8" : "h-6 w-6";
  const initial = (name ?? "?").charAt(0).toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? ""}
        className={`${sizeClass} shrink-0 rounded-full border border-border bg-muted object-cover`}
        title={name ?? ""}
      />
    );
  }
  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 text-xs font-semibold text-primary`}
      title={name ?? ""}
    >
      {initial}
    </div>
  );
}

export function ProjectDetail({
  project,
  currentUserId,
  initialMembers,
  initialComments,
  initialFiles,
  initialActivity,
  initialTasks,
  initialMilestones,
  initialNotes = [],
  initialSpeakers = [],
  initialBudgetItems = [],
  initialExpenses = [],
  initialFinancialSummary,
  initialTimesheets = [],
  initialTimesheetSummary,
  initialBrevetSummary,
  defaultTab = "overview",
}: {
  project: ProjectDetailRow;
  currentUserId: string;
  initialMembers: ProjectMemberRow[];
  initialComments: ProjectCommentRow[];
  initialFiles: ProjectFileRow[];
  initialActivity: ProjectActivityRow[];
  initialTasks: ProjectTaskRow[];
  initialMilestones: ProjectMilestoneRow[];
  initialNotes?: ProjectNoteRow[];
  initialSpeakers?: ProjectSpeakerRow[];
  initialBudgetItems?: ProjectBudgetItemRow[];
  initialExpenses?: ProjectExpenseRow[];
  initialFinancialSummary: ProjectFinancialSummary;
  initialTimesheets?: ProjectTimesheetRow[];
  initialTimesheetSummary: ProjectTimesheetSummary;
  initialBrevetSummary?: BrevetSummary | null;
  defaultTab?: string;
}) {
  const [status, setStatus] = useState(project.status);
  const [isTemplate, setIsTemplate] = useState(project.isTemplate);
  const [members, setMembers] = useState(initialMembers);
  const [comments, setComments] = useState(initialComments);
  const [files, setFiles] = useState(initialFiles);
  const [activity, setActivity] = useState(initialActivity);
  const [tasks, setTasks] = useState(initialTasks);
  const [milestones, setMilestones] = useState(initialMilestones);
  const [notes, setNotes] = useState(initialNotes);
  const [speakers, setSpeakers] = useState(initialSpeakers);
  const [budgetItems, setBudgetItems] = useState(initialBudgetItems);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [financialSummary, setFinancialSummary] = useState(initialFinancialSummary);
  const [timesheets, setTimesheets] = useState(initialTimesheets);
  const [timesheetSummary, setTimesheetSummary] = useState(initialTimesheetSummary);
  const [brevetSummary, setBrevetSummary] = useState<BrevetSummary | null | undefined>(initialBrevetSummary);
  const [isPending, startTransition] = useTransition();
  const role = project.currentUserProjectRole;

  function refreshAll() {
    startTransition(async () => {
      const [
        nextMembers,
        nextComments,
        nextFiles,
        nextActivity,
        nextTasks,
        nextMilestones,
        nextNotes,
        nextSpeakers,
        nextBudgetItems,
        nextExpenses,
        nextFinancialSummary,
        nextTimesheets,
        nextTimesheetSummary,
        nextBrevet,
      ] =
        await Promise.all([
          getProjectMembers(project.id),
          listComments(project.id),
          listProjectFiles(project.id),
          listProjectActivity(project.id),
          listProjectTasks(project.id),
          listProjectMilestones(project.id),
          listProjectNotes(project.id),
          listProjectSpeakers(project.id),
          listProjectBudgetItems(project.id),
          listProjectExpenses(project.id),
          getProjectFinancialSummary(project.id),
          listProjectTimesheets(project.id),
          getProjectTimesheetSummary(project.id),
          project.kelasUjianId ? getBrevetSummaryByProject(project.id) : Promise.resolve(null),
        ]);
      setMembers(nextMembers);
      setComments(nextComments);
      setFiles(nextFiles);
      setActivity(nextActivity);
      setTasks(nextTasks);
      setMilestones(nextMilestones);
      setNotes(nextNotes);
      setSpeakers(nextSpeakers);
      setBudgetItems(nextBudgetItems);
      setExpenses(nextExpenses);
      setFinancialSummary(nextFinancialSummary);
      setTimesheets(nextTimesheets);
      setTimesheetSummary(nextTimesheetSummary);
      setBrevetSummary(nextBrevet);
    });
  }

  function changeStatus(next: ProjectStatus) {
    startTransition(async () => {
      const result = await updateProjectStatus(project.id, next);
      if (result.ok) {
        setStatus(next);
        toast.success("Status project diperbarui.");
        refreshAll();
      } else {
        toast.error(result.error);
      }
    });
  }

  const tabItems = [
    { value: "overview", icon: null, label: "Overview", count: null },
    { value: "tasks", icon: CheckCircle2, label: "Tasks", count: tasks.length },
    { value: "notes", icon: null, label: "Notes", count: notes.length },
    { value: "admin", icon: null, label: "Admin", count: speakers.length + budgetItems.length + expenses.length + timesheets.length },
    { value: "comments", icon: MessageSquare, label: "Comments", count: comments.length },
    { value: "files", icon: Paperclip, label: "Files", count: files.length },
    { value: "members", icon: Users, label: "Members", count: members.length },
    { value: "activity", icon: Clock, label: "Activity", count: null },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{PROJECT_TYPE_LABELS[project.type] ?? project.type}</Badge>
              <Badge variant="outline">{statusLabel(status)}</Badge>
              {project.labels.map((label) => (
                <Badge
                  key={label.id}
                  variant="outline"
                  style={{ borderColor: label.color, color: label.color }}
                >
                  {label.name}
                </Badge>
              ))}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-foreground">
              {project.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>{formatTanggal(project.startDate)} - {formatTanggal(project.endDate)}</span>
              <span>{formatSKP(project.skp)}</span>
              <span>{members.length} anggota</span>
              <span>{files.length} file</span>
              <span>{comments.length} komentar</span>
              <span>{tasks.length} task</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {project.progress}%
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage(role) ? (
              <Select value={status} onValueChange={(value) => changeStatus(value as ProjectStatus)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["not_started", "in_progress", "on_hold", "completed", "cancelled"] as ProjectStatus[]).map((item) => (
                    <SelectItem key={item} value={item}>
                      {statusLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {canManage(role) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!window.confirm(`Duplikat project "${project.title}"?`)) return;
                  startTransition(async () => {
                    const result = await duplicateProject(project.id);
                    if (result.ok) {
                      toast.success("Project diduplikat.");
                      window.location.href = `/projects/${result.data.id}`;
                    } else {
                      toast.error(result.error);
                    }
                  });
                }}
                disabled={isPending}
              >
                <Copy className="h-4 w-4" />
                Duplikat
              </Button>
            ) : null}
            {canManage(role) ? (
              <Button
                type="button"
                variant={isTemplate ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  startTransition(async () => {
                    const result = await toggleProjectTemplate(project.id);
                    if (result.ok) {
                      toast.success(isTemplate ? "Template dinonaktifkan." : "Project dijadikan template.");
                      setIsTemplate(!isTemplate);
                      refreshAll();
                    } else {
                      toast.error(result.error);
                    }
                  });
                }}
                disabled={isPending}
              >
                <Save className="h-4 w-4" />
                {isTemplate ? "Template ✓" : "Jadikan Template"}
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/api/projects/${project.id}/export`} target="_blank">
                <Download className="h-4 w-4" />
                Export PDF
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/projects">Kembali</Link>
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="flex w-full justify-start gap-1 overflow-x-auto">
          {tabItems.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-accent/30 data-[state=active]:font-semibold"
            >
              {tab.icon ? <tab.icon className="h-4 w-4" /> : null}
              {tab.label}
              {tab.count !== null && tab.count > 0 ? (
                <Badge variant="outline" className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-[11px]">
                  {tab.count}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <Overview
            project={project}
            tasks={tasks}
            activity={activity}
            members={members}
            files={files}
            brevetSummary={brevetSummary}
            canManage={canManage(role)}
            projectId={project.id}
            onRefresh={refreshAll}
          />
        </TabsContent>
        <TabsContent value="tasks">
          <div className="space-y-4">
            <MilestoneSection
              projectId={project.id}
              milestones={milestones}
              canManage={canManage(role)}
              onRefresh={refreshAll}
              pending={isPending}
            />
            <TaskSection
              projectId={project.id}
              tasks={tasks}
              members={members}
              milestones={milestones}
              canManage={canManage(role)}
              currentUserId={currentUserId}
              onRefresh={refreshAll}
              pending={isPending}
            />
          </div>
        </TabsContent>
        <TabsContent value="notes">
          <NoteSection
            projectId={project.id}
            notes={notes}
            canManage={canManage(role)}
            onRefresh={refreshAll}
            pending={isPending}
          />
        </TabsContent>
        <TabsContent value="admin">
          <Tabs defaultValue="speakers" className="space-y-4">
            <TabsList className="flex w-full justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="speakers">Narasumber</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
            </TabsList>
            <TabsContent value="speakers">
              <SpeakerPanel
                projectId={project.id}
                members={members}
                speakers={speakers}
                canManage={canManage(role)}
                onRefresh={refreshAll}
                pending={isPending}
              />
            </TabsContent>
            <TabsContent value="expenses">
              <ExpensePanel
                projectId={project.id}
                budgetItems={budgetItems}
                expenses={expenses}
                summary={financialSummary}
                canManage={canManage(role)}
                onRefresh={refreshAll}
                pending={isPending}
              />
            </TabsContent>
            <TabsContent value="timesheets">
              <TimesheetPanel
                projectId={project.id}
                timesheets={timesheets}
                summary={timesheetSummary}
                canManage={canManage(role)}
                canContribute={canContribute(role)}
                currentUserId={currentUserId}
                onRefresh={refreshAll}
                pending={isPending}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="comments">
          <CommentSection
            projectId={project.id}
            comments={comments}
            members={members}
            canComment={canContribute(role)}
            onRefresh={refreshAll}
            pending={isPending}
          />
        </TabsContent>
        <TabsContent value="files">
          <FileSection
            projectId={project.id}
            files={files}
            canUpload={canContribute(role)}
            onRefresh={refreshAll}
            pending={isPending}
          />
        </TabsContent>
        <TabsContent value="members">
          <MemberSection
            projectId={project.id}
            members={members}
            canManage={canManage(role)}
            actorRole={role}
            onRefresh={refreshAll}
            pending={isPending}
          />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityLog rows={activity} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CircularProgress({ value, size = 80 }: { value: number; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-sm font-semibold">{value}%</span>
    </div>
  );
}

function Overview({
  project,
  tasks,
  activity,
  members,
  files,
  brevetSummary,
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function getCaretPixelPos(el: HTMLTextAreaElement, pos: number): { top: number; left: number } {
  const style = window.getComputedStyle(el);
  const div = document.createElement("div");
  Object.assign(div.style, {
    position: "absolute",
    top: "0",
    left: "0",
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    boxSizing: style.boxSizing,
    width: style.width,
    paddingTop: style.paddingTop,
    paddingRight: style.paddingRight,
    paddingBottom: style.paddingBottom,
    paddingLeft: style.paddingLeft,
    borderTopWidth: style.borderTopWidth,
    borderRightWidth: style.borderRightWidth,
    borderBottomWidth: style.borderBottomWidth,
    borderLeftWidth: style.borderLeftWidth,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
  });
  document.body.appendChild(div);
  div.textContent = el.value.slice(0, pos);
  const span = document.createElement("span");
  span.textContent = "​";
  div.appendChild(span);
  const elRect = el.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  document.body.removeChild(div);
  return {
    top: spanRect.bottom - elRect.top + el.scrollTop,
    left: Math.min(Math.max(0, spanRect.left - elRect.left), elRect.width - 232),
  };
}

function getMentionContext(text: string, cursorPos: number): { start: number; query: string } | null {
  const beforeCursor = text.slice(0, cursorPos);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex < 0) return null;
  const afterAt = beforeCursor.slice(atIndex + 1);
  if (afterAt.includes(" ")) return null;
  if (/[@#]/.test(afterAt)) return null;
  return { start: atIndex, query: afterAt };
}

function CommentSection({
  projectId,
  comments,
  members,
  canComment,
  onRefresh,
  pending,
}: {
  projectId: string;
  comments: ProjectCommentRow[];
  members: ProjectMemberRow[];
  canComment: boolean;
  onRefresh: () => void;
  pending: boolean;
}) {
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  type PendingAttachment = { id: string; fileName: string; fileUrl: string; fileSize: number; mimeType: string; };
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionContext, setMentionContext] = useState<{ start: number; query: string } | null>(null);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);

  const rootComments = comments.filter((comment) => !comment.parentId);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, ProjectCommentRow[]>();
    for (const comment of comments) {
      if (!comment.parentId) continue;
      map.set(comment.parentId, [...(map.get(comment.parentId) ?? []), comment]);
    }
    return map;
  }, [comments]);

  const filteredMembers = useMemo(() => {
    if (!mentionContext) return [];
    const q = mentionContext.query.toLowerCase();
    return members.filter((m) => m.namaLengkap?.toLowerCase().includes(q));
  }, [mentionContext, members]);

  function handleContentChange(value: string) {
    setContent(value);
    const ta = textareaRef.current;
    if (ta) {
      const ctx = getMentionContext(value, ta.selectionStart);
      setMentionContext(ctx);
      setMentionOpen(!!ctx);
      if (ctx) setMentionPos(getCaretPixelPos(ta, ta.selectionStart));
      else setMentionPos(null);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (mentionOpen && event.key === "Escape") {
      setMentionOpen(false);
      event.preventDefault();
    }
    if (mentionOpen && filteredMembers.length > 0 && (event.key === "Enter" || event.key === "Tab")) {
      event.preventDefault();
      selectMention(filteredMembers[0]!);
    }
  }

  function selectMention(member: ProjectMemberRow) {
    if (!mentionContext) return;
    const before = content.slice(0, mentionContext.start);
    const after = content.slice(mentionContext.start + 1 + mentionContext.query.length);
    const mentionText = `@${member.namaLengkap} `;
    setContent(before + mentionText + after);
    setMentionOpen(false);
    setMentionContext(null);
    textareaRef.current?.focus();
  }

  function insertMentionTrigger() {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const newContent = content.slice(0, start) + "@" + content.slice(start);
    const newCursorPos = start + 1;
    setContent(newContent);
    const ctx = getMentionContext(newContent, newCursorPos);
    setMentionContext(ctx);
    setMentionOpen(!!ctx);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCursorPos, newCursorPos);
      if (ctx) setMentionPos(getCaretPixelPos(ta, newCursorPos));
    });
  }

  function insertMarkdown(prefix: string, suffix = "") {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + prefix + selected + suffix + content.slice(end);
    setContent(newContent);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  function uploadAttachment(file: File | null) {
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      startTransition(async () => {
        const result = await uploadProjectFile(projectId, {
          fileName: file.name,
          contentType: file.type,
          dataUrl: String(reader.result),
        });
        if (result.ok && result.data?.id) {
          const fileId = result.data.id;
          setPendingAttachments((prev) => [
            ...prev,
            {
              id: fileId,
              fileName: file.name,
              fileUrl: "",
              fileSize: file.size,
              mimeType: file.type,
            },
          ]);
        } else if (!result.ok) {
          toast.error(result.error);
        }
        if (attachInputRef.current) attachInputRef.current.value = "";
        setIsUploading(false);
      });
    };
    reader.readAsDataURL(file);
  }

  function removeAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function submit() {
    startTransition(async () => {
      const result = await createComment(projectId, {
        content,
        parentId: replyTo,
        fileIds: pendingAttachments.map((a) => a.id),
      });
      if (result.ok) {
        setContent("");
        setReplyTo(null);
        setPendingAttachments([]);
        toast.success("Komentar ditambahkan.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      {canComment ? (
        <div className="space-y-3">
          {replyTo ? (
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span>
                Membalas{" "}
                <span className="font-medium">
                  @{comments.find((c) => c.id === replyTo)?.authorName ?? "komentar"}
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                Batal
              </Button>
            </div>
          ) : null}
          <div className="rounded-xl border border-border focus-within:border-primary/50">
            <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => insertMarkdown("**", "**")}
                title="Bold"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => insertMarkdown("*", "*")}
                title="Italic"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => insertMarkdown("- ")}
                title="Bullet list"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Lampirkan file"
                  disabled={isUploading}
                  onClick={() => attachInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5" />
                  )}
                </button>
                <input
                  ref={attachInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => uploadAttachment(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Mention anggota"
                  onClick={insertMentionTrigger}
                >
                  @
                </button>
              </div>
            </div>
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(event) => handleContentChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tulis komentar... Gunakan @ untuk mention anggota"
                className="min-h-35 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {mentionOpen && mentionPos && (
                <div
                  className="absolute z-50 w-56 rounded-md border bg-popover p-1 shadow-md"
                  style={{ top: mentionPos.top, left: mentionPos.left }}
                >
                  {filteredMembers.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto">
                      {filteredMembers.map((member) => (
                        <button
                          key={member.userId}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                          onMouseDown={(e) => { e.preventDefault(); selectMention(member); }}
                        >
                          <Avatar name={member.namaLengkap} avatarUrl={member.avatarUrl} size="sm" />
                          <span className="truncate">{member.namaLengkap ?? member.email}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="p-2 text-sm text-muted-foreground">Tidak ditemukan</p>
                  )}
                </div>
              )}
            </div>
          </div>
          {pendingAttachments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs"
                >
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span className="max-w-32 truncate">{a.fileName}</span>
                  <button
                    type="button"
                    className="ml-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAttachment(a.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={!content.trim() || isPending || isUploading || pending}
              onClick={submit}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Kirim
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {rootComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={repliesByParent.get(comment.id) ?? []}
            members={members}
            onReply={() => setReplyTo(comment.id)}
          />
        ))}
        {comments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Belum ada komentar.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function CommentItem({
  comment,
  replies,
  members,
  onReply,
}: {
  comment: ProjectCommentRow;
  replies: ProjectCommentRow[];
  members: ProjectMemberRow[];
  onReply: () => void;
}) {
  const memberMap = useMemo(() => {
    const map = new Map<string, ProjectMemberRow>();
    for (const m of members) map.set(m.userId, m);
    if (comment.authorId) {
      map.set(comment.authorId, {
        id: "",
        userId: comment.authorId,
        namaLengkap: comment.authorName,
        email: null,
        avatarUrl: comment.authorAvatarUrl,
        divisiNama: comment.authorDivisi,
        role: "member",
        addedAt: new Date(),
      });
    }
    return map;
  }, [members, comment.authorId, comment.authorName, comment.authorAvatarUrl, comment.authorDivisi]);

  const parts = useMemo(() => splitMentions(comment.content), [comment.content]);

  return (
    <article className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Avatar name={comment.authorName} avatarUrl={comment.authorAvatarUrl} />
          <div>
            <p className="font-medium">{comment.authorName ?? "User"}</p>
            <p className="text-xs text-muted-foreground">
              {comment.authorDivisi ?? "-"} &middot;{" "}
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: id })}
              {comment.isEdited ? " (diedit)" : ""}
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onReply}>
          Reply
        </Button>
      </div>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-6">
        {parts.map((part, index) => {
          if (part.mention) {
            const mentionedName = part.text.replace("@", "");
            const mentionedMember = Array.from(memberMap.values()).find(
              (m) => m.namaLengkap === mentionedName,
            );
            return (
              <span
                key={index}
                className="inline-flex items-center gap-1 rounded bg-primary/10 px-1 font-medium text-primary"
              >
                {mentionedMember ? (
                  <Avatar name={mentionedMember.namaLengkap} avatarUrl={mentionedMember.avatarUrl} />
                ) : null}
                {part.text}
              </span>
            );
          }
          return <span key={index}>{part.text}</span>;
        })}
      </div>
      {comment.attachments.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {comment.attachments.map((attachment) => {
            const isImage = attachment.mimeType.startsWith("image/");
            return (
              <a
                key={attachment.id}
                href={attachment.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs hover:bg-accent transition-colors"
              >
                {isImage ? (
                  <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="max-w-40 truncate font-medium">{attachment.fileName}</span>
                <span className="text-muted-foreground">{fileSize(attachment.fileSize)}</span>
              </a>
            );
          })}
        </div>
      ) : null}
      {replies.length ? (
        <div className="mt-4 space-y-3 border-l-2 border-border/60 pl-4">
          {replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} replies={[]} members={members} onReply={onReply} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function FileSection({
  projectId,
  files,
  canUpload,
  onRefresh,
  pending,
}: {
  projectId: string;
  files: ProjectFileRow[];
  canUpload: boolean;
  onRefresh: () => void;
  pending: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function upload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      startTransition(async () => {
        const result = await uploadProjectFile(projectId, {
          fileName: file.name,
          contentType: file.type,
          dataUrl: String(reader.result),
        });
        if (result.ok) {
          toast.success("File diupload.");
          if (fileInputRef.current) fileInputRef.current.value = "";
          onRefresh();
        } else {
          toast.error(result.error);
        }
      });
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
  }

  function remove(file: ProjectFileRow) {
    if (!window.confirm(`Hapus file "${file.fileName}"?`)) return;
    startTransition(async () => {
      const result = await deleteProjectFile(file.id);
      if (result.ok) {
        toast.success("File dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      {canUpload ? (
        <div
          className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/30"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Label className="flex cursor-pointer flex-col items-center gap-2 text-sm">
            {isPending || pending ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <FileUp className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-medium text-foreground">
              {dragOver ? "Lepaskan file di sini" : "Klik atau seret file ke sini untuk upload"}
            </span>
            <span className="text-xs text-muted-foreground">PDF, Excel, Word, Gambar, ZIP — max 20 MB</span>
            <Input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => upload(event.target.files?.[0] ?? null)}
            />
          </Label>
        </div>
      ) : null}

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        {files.map((file) => {
          const Icon = fileTypeIcon(file.mimeType);
          const isImage = file.mimeType.startsWith("image/");
          return (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-accent/30"
            >
              {isImage ? (
                <button
                  type="button"
                  className="shrink-0"
                  onClick={() => setPreviewUrl(file.fileUrl)}
                >
                  <img
                    src={file.fileUrl}
                    alt={file.fileName}
                    className="h-10 w-10 rounded-md border border-border object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {fileSize(file.fileSize)} &middot; {file.uploaderName ?? "User"} &middot;{" "}
                  {formatDistanceToNow(new Date(file.uploadedAt), { addSuffix: true, locale: id })}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button asChild variant="ghost" size="icon-sm">
                  <a href={file.fileUrl} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                {canUpload ? (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(file)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
        {files.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Belum ada file.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function MemberSection({
  projectId,
  members,
  canManage,
  actorRole,
  onRefresh,
  pending,
}: {
  projectId: string;
  members: ProjectMemberRow[];
  canManage: boolean;
  actorRole: ProjectMemberRole | "admin";
  onRefresh: () => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InviteUserRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [role, setRole] = useState<ProjectMemberRole>("member");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!canManage || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        setResults(await searchUsersForInvite(query, projectId));
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [canManage, projectId, query]);

  function toggleUser(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function addMembers() {
    startTransition(async () => {
      const result = await addProjectMembers(projectId, { userIds: selectedIds, role });
      if (result.ok) {
        setSelectedIds([]);
        setQuery("");
        setResults([]);
        toast.success("Anggota ditambahkan.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function changeRole(userId: string, nextRole: ProjectMemberRole) {
    startTransition(async () => {
      const result = await updateMemberRole(projectId, userId, nextRole);
      if (result.ok) {
        toast.success("Role anggota diperbarui.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(userId: string) {
    if (!window.confirm("Hapus anggota ini dari project?")) return;
    startTransition(async () => {
      const result = await removeProjectMember(projectId, userId);
      if (result.ok) {
        toast.success("Anggota dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const canEditRoles = actorRole === "admin" || actorRole === "owner";

  return (
    <section className="space-y-5 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      {canManage ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama/email user"
            />
            <Select value={role} onValueChange={(value) => setRole(value as ProjectMemberRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_MEMBER_ROLES.filter((item) => item !== "owner" || canEditRoles).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              disabled={selectedIds.length === 0 || isPending || pending}
              onClick={addMembers}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add
            </Button>
          </div>
          {results.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user.id)}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span>
                    <span className="block font-medium">{user.namaLengkap ?? user.email}</span>
                    <span className="text-muted-foreground">{user.divisiNama ?? "-"} - {user.email}</span>
                  </span>
                  {selectedIds.includes(user.id) ? <Plus className="h-4 w-4 rotate-45" /> : <Plus className="h-4 w-4" />}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.userId} className="flex flex-col gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={member.namaLengkap} avatarUrl={member.avatarUrl} />
              <div>
                <p className="font-medium">{member.namaLengkap ?? member.email}</p>
                <p className="text-sm text-muted-foreground">{member.divisiNama ?? "-"} - {member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEditRoles ? (
                <Select
                  value={member.role}
                  onValueChange={(value) => changeRole(member.userId, value as ProjectMemberRole)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_MEMBER_ROLES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{member.role}</Badge>
              )}
              {canManage ? (
                <Button type="button" variant="destructive" size="icon-sm" onClick={() => remove(member.userId)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Phase 5 helpers ───────────────────────────────────────────────────────

function rupiah(value: number | string | null | undefined) {
  return `Rp ${Number(value ?? 0).toLocaleString("id-ID")}`;
}

function minutesLabel(minutes: number | null | undefined) {
  const total = Number(minutes ?? 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} menit`;
  if (mins === 0) return `${hours} jam`;
  return `${hours} jam ${mins} menit`;
}

function dateTimeLocalValue(date: Date | string | null | undefined) {
  if (!date) return "";
  const parsed = new Date(date);
  const offset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}

function SpeakerPanel({
  projectId,
  members,
  speakers,
  canManage: canManageProp,
  onRefresh,
  pending,
}: {
  projectId: string;
  members: ProjectMemberRow[];
  speakers: ProjectSpeakerRow[];
  canManage: boolean;
  onRefresh: () => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectSpeakerRow | null>(null);
  const [form, setForm] = useState({
    userId: "",
    nama: "",
    email: "",
    topik: "",
    durasiMenit: "",
    skp: "",
    isExternal: false,
  });
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm({ userId: "", nama: "", email: "", topik: "", durasiMenit: "", skp: "", isExternal: false });
    setOpen(true);
  }

  function openEdit(row: ProjectSpeakerRow) {
    setEditing(row);
    setForm({
      userId: row.userId ?? "",
      nama: row.nama,
      email: row.email ?? "",
      topik: row.topik ?? "",
      durasiMenit: row.durasiMenit ? String(row.durasiMenit) : "",
      skp: row.skp ? String(row.skp) : "",
      isExternal: row.isExternal,
    });
    setOpen(true);
  }

  function chooseMember(userId: string) {
    const member = members.find((item) => item.userId === userId);
    setForm((current) => ({
      ...current,
      userId,
      nama: member?.namaLengkap ?? current.nama,
      email: member?.email ?? current.email,
      isExternal: false,
    }));
  }

  function submit() {
    startTransition(async () => {
      const payload = {
        userId: form.userId || null,
        nama: form.nama,
        email: form.email || null,
        topik: form.topik || null,
        durasiMenit: form.durasiMenit ? Number(form.durasiMenit) : null,
        skp: form.skp ? Number(form.skp) : null,
        isExternal: form.isExternal,
      };
      const result = editing
        ? await updateProjectSpeaker(editing.id, payload)
        : await createProjectSpeaker(projectId, payload);
      if (result.ok) {
        toast.success(editing ? "Narasumber diperbarui." : "Narasumber ditambahkan.");
        setOpen(false);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function removeSpeaker(row: ProjectSpeakerRow) {
    if (!window.confirm(`Hapus narasumber "${row.nama}"?`)) return;
    startTransition(async () => {
      const result = await deleteProjectSpeaker(row.id);
      if (result.ok) {
        toast.success("Narasumber dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Narasumber</h2>
        {canManageProp ? (
          <Button size="sm" onClick={openCreate} disabled={isPending || pending}>
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {speakers.map((speaker) => (
          <div key={speaker.id} className="rounded-xl border border-border/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{speaker.nama}</h3>
                  <Badge variant="outline">{speaker.isExternal ? "Eksternal" : "Internal"}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{speaker.email ?? "-"}</p>
                <p className="mt-2 text-sm">{speaker.topik ?? "Topik belum diisi"}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{speaker.durasiMenit ? `${speaker.durasiMenit} menit` : "Durasi -"}</span>
                  <span>{speaker.skp ? `${speaker.skp} SKP` : "SKP -"}</span>
                </div>
              </div>
              {canManageProp ? (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(speaker)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeSpeaker(speaker)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {speakers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada narasumber.
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Narasumber" : "Tambah Narasumber"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>User internal</Label>
              <Select value={form.userId || "manual"} onValueChange={(value) => (value === "manual" ? setForm((current) => ({ ...current, userId: "", isExternal: true })) : chooseMember(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih user internal atau input manual" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Input manual / eksternal</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.namaLengkap ?? member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Topik</Label>
              <Input value={form.topik} onChange={(e) => setForm({ ...form, topik: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Durasi menit</Label>
              <Input type="number" min={0} value={form.durasiMenit} onChange={(e) => setForm({ ...form, durasiMenit: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>SKP</Label>
              <Input type="number" min={0} step="0.5" value={form.skp} onChange={(e) => setForm({ ...form, skp: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={submit} disabled={!form.nama.trim() || isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ExpensePanel({
  projectId,
  budgetItems,
  expenses,
  summary,
  canManage: canManageProp,
  onRefresh,
  pending,
}: {
  projectId: string;
  budgetItems: ProjectBudgetItemRow[];
  expenses: ProjectExpenseRow[];
  summary: ProjectFinancialSummary;
  canManage: boolean;
  onRefresh: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total Anggaran" value={rupiah(summary.totalBudget)} />
        <SummaryCard label="Total Pengeluaran" value={rupiah(summary.totalExpenses)} />
        <SummaryCard label="Selisih" value={rupiah(summary.delta)} tone={summary.delta >= 0 ? "good" : "bad"} />
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold">Budget vs Actuals</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-140 text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Kategori</th>
                <th className="py-2">Budget</th>
                <th className="py-2">Actual</th>
                <th className="py-2">Delta</th>
              </tr>
            </thead>
            <tbody>
              {summary.byCategory.map((row) => (
                <tr key={row.kategori} className="border-t border-border/60">
                  <td className="py-2 font-medium">{row.kategori}</td>
                  <td className="py-2">{rupiah(row.budget)}</td>
                  <td className="py-2">{rupiah(row.actual)}</td>
                  <td className="py-2">
                    <Badge variant="outline" className={row.delta >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}>
                      {rupiah(row.delta)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.byCategory.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Belum ada data budget atau expense.
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BudgetList projectId={projectId} rows={budgetItems} canManage={canManageProp} onRefresh={onRefresh} pending={pending} />
        <ExpenseList projectId={projectId} rows={expenses} canManage={canManageProp} onRefresh={onRefresh} pending={pending} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function BudgetList({ projectId, rows, canManage: canManageProp, onRefresh, pending }: { projectId: string; rows: ProjectBudgetItemRow[]; canManage: boolean; onRefresh: () => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectBudgetItemRow | null>(null);
  const [form, setForm] = useState({ kategori: "", deskripsi: "", jumlahRencana: "" });
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm({ kategori: "", deskripsi: "", jumlahRencana: "" });
    setOpen(true);
  }

  function openEdit(row: ProjectBudgetItemRow) {
    setEditing(row);
    setForm({ kategori: row.kategori, deskripsi: row.deskripsi ?? "", jumlahRencana: String(row.jumlahRencana) });
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const payload = { ...form, jumlahRencana: Number(form.jumlahRencana || 0) };
      const result = editing ? await updateProjectBudgetItem(editing.id, payload) : await createProjectBudgetItem(projectId, payload);
      if (result.ok) {
        toast.success(editing ? "Budget diperbarui." : "Budget ditambahkan.");
        setOpen(false);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function removeBudget(row: ProjectBudgetItemRow) {
    if (!window.confirm(`Hapus budget "${row.kategori}"?`)) return;
    startTransition(async () => {
      const result = await deleteProjectBudgetItem(row.id);
      if (result.ok) {
        toast.success("Budget dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Budget Planning</h3>
        {canManageProp ? <Button size="sm" onClick={openCreate} disabled={isPending || pending}><Plus className="h-4 w-4" />Tambah</Button> : null}
      </div>
      {rows.map((row) => (
        <div key={row.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
          <div>
            <p className="font-medium">{row.kategori}</p>
            <p className="text-sm text-muted-foreground">{row.deskripsi ?? "-"}</p>
            <p className="mt-1 text-sm font-semibold">{rupiah(row.jumlahRencana)}</p>
          </div>
          {canManageProp ? <RowActions onEdit={() => openEdit(row)} onDelete={() => removeBudget(row)} /> : null}
        </div>
      ))}
      {rows.length === 0 ? <EmptyText text="Belum ada budget." /> : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Budget" : "Tambah Budget"}</DialogTitle></DialogHeader>
          <MoneyForm form={form} setForm={setForm} amountKey="jumlahRencana" amountLabel="Jumlah rencana" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={submit} disabled={!form.kategori.trim() || isPending}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ExpenseList({ projectId, rows, canManage: canManageProp, onRefresh, pending }: { projectId: string; rows: ProjectExpenseRow[]; canManage: boolean; onRefresh: () => void; pending: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectExpenseRow | null>(null);
  const [form, setForm] = useState({ kategori: "", keterangan: "", jumlah: "", tanggal: today, buktiUrl: "" });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm({ kategori: "", keterangan: "", jumlah: "", tanggal: today, buktiUrl: "" });
    setProofFile(null);
    setOpen(true);
  }

  function openEdit(row: ProjectExpenseRow) {
    setEditing(row);
    setForm({ kategori: row.kategori, keterangan: row.keterangan ?? "", jumlah: String(row.jumlah), tanggal: row.tanggal, buktiUrl: row.buktiUrl ?? "" });
    setProofFile(null);
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      let buktiUrl = form.buktiUrl;
      if (proofFile) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(proofFile);
        });
        const uploadResult = await uploadProjectFile(projectId, {
          fileName: proofFile.name,
          contentType: proofFile.type,
          dataUrl,
        });
        if (!uploadResult.ok) {
          toast.error(uploadResult.error);
          return;
        }
        buktiUrl = uploadResult.data?.fileUrl ?? buktiUrl;
      }
      const payload = { ...form, buktiUrl, jumlah: Number(form.jumlah || 0) };
      const result = editing ? await updateProjectExpense(editing.id, payload) : await createProjectExpense(projectId, payload);
      if (result.ok) {
        toast.success(editing ? "Expense diperbarui." : "Expense ditambahkan.");
        setOpen(false);
        setProofFile(null);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function removeExpense(row: ProjectExpenseRow) {
    if (!window.confirm(`Hapus expense "${row.kategori}"?`)) return;
    startTransition(async () => {
      const result = await deleteProjectExpense(row.id);
      if (result.ok) {
        toast.success("Expense dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Expenses Aktual</h3>
        {canManageProp ? <Button size="sm" onClick={openCreate} disabled={isPending || pending}><Plus className="h-4 w-4" />Tambah</Button> : null}
      </div>
      {rows.map((row) => (
        <div key={row.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{row.kategori}</p>
              <Badge variant="outline">{formatTanggal(row.tanggal)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{row.keterangan ?? "-"}</p>
            <p className="mt-1 text-sm font-semibold">{rupiah(row.jumlah)}</p>
            {row.buktiUrl ? (
              <a href={row.buktiUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Bukti <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          {canManageProp ? <RowActions onEdit={() => openEdit(row)} onDelete={() => removeExpense(row)} /> : null}
        </div>
      ))}
      {rows.length === 0 ? <EmptyText text="Belum ada expense." /> : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Tambah Expense"}</DialogTitle></DialogHeader>
          <MoneyForm form={form} setForm={setForm} amountKey="jumlah" amountLabel="Jumlah" showDate showProof />
          <div className="space-y-2">
            <Label>Upload Bukti</Label>
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
            />
            {proofFile ? <p className="text-xs text-muted-foreground">{proofFile.name}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={submit} disabled={!form.kategori.trim() || isPending}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MoneyForm<T extends Record<string, string>>({
  form,
  setForm,
  amountKey,
  amountLabel,
  showDate,
  showProof,
}: {
  form: T;
  setForm: (form: T) => void;
  amountKey: keyof T;
  amountLabel: string;
  showDate?: boolean;
  showProof?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Kategori</Label>
        <Input value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>{amountLabel}</Label>
        <Input type="number" min={0} value={form[amountKey]} onChange={(e) => setForm({ ...form, [amountKey]: e.target.value })} />
      </div>
      {showDate ? (
        <div className="space-y-2">
          <Label>Tanggal</Label>
          <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label>Deskripsi / Keterangan</Label>
        <Textarea value={form.deskripsi ?? form.keterangan ?? ""} onChange={(e) => setForm({ ...form, deskripsi: e.target.value, keterangan: e.target.value })} />
      </div>
      {showProof ? (
        <div className="space-y-2">
          <Label>URL Bukti</Label>
          <Input value={form.buktiUrl} onChange={(e) => setForm({ ...form, buktiUrl: e.target.value })} placeholder="https://..." />
        </div>
      ) : null}
    </div>
  );
}

function TimesheetPanel({
  projectId,
  timesheets,
  summary,
  canManage: canManageProp,
  canContribute: canContributeProp,
  currentUserId,
  onRefresh,
  pending,
}: {
  projectId: string;
  timesheets: ProjectTimesheetRow[];
  summary: ProjectTimesheetSummary;
  canManage: boolean;
  canContribute: boolean;
  currentUserId: string;
  onRefresh: () => void;
  pending: boolean;
}) {
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectTimesheetRow | null>(null);
  const [form, setForm] = useState({ startTime: "", endTime: "", durationMinutes: "", description: "" });
  const [isPending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const result = await startProjectTimer(projectId, { description });
      if (result.ok) {
        setDescription("");
        toast.success("Timer dimulai.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function stop() {
    startTransition(async () => {
      const result = await stopProjectTimer(projectId, { description });
      if (result.ok) {
        setDescription("");
        toast.success("Timer dihentikan.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function openCreate() {
    const now = dateTimeLocalValue(new Date());
    setEditing(null);
    setForm({ startTime: now, endTime: now, durationMinutes: "", description: "" });
    setOpen(true);
  }

  function openEdit(row: ProjectTimesheetRow) {
    setEditing(row);
    setForm({
      startTime: dateTimeLocalValue(row.startTime),
      endTime: dateTimeLocalValue(row.endTime),
      durationMinutes: row.durationMinutes ? String(row.durationMinutes) : "",
      description: row.description ?? "",
    });
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const payload = {
        startTime: form.startTime,
        endTime: form.endTime || null,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        description: form.description || null,
      };
      const result = editing
        ? await updateProjectTimesheet(editing.id, payload)
        : await createProjectTimesheet(projectId, payload);
      if (result.ok) {
        toast.success(editing ? "Timesheet diperbarui." : "Timesheet ditambahkan.");
        setOpen(false);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function removeTimesheet(row: ProjectTimesheetRow) {
    if (!window.confirm("Hapus timesheet ini?")) return;
    startTransition(async () => {
      const result = await deleteProjectTimesheet(row.id);
      if (result.ok) {
        toast.success("Timesheet dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const activeTimer = summary.activeTimer;

  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total Jam Kerja" value={minutesLabel(summary.totalMinutes)} />
        <SummaryCard label="Timer Aktif" value={activeTimer ? "Berjalan" : "Tidak ada"} />
        <SummaryCard label="Kontributor" value={`${summary.byUser.length} user`} />
      </div>
      {canContributeProp ? (
        <div className="rounded-xl border border-border/60 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi kerja" />
            {activeTimer ? (
              <Button onClick={stop} disabled={isPending || pending} variant="destructive">
                <Square className="h-4 w-4" />
                Stop Timer
              </Button>
            ) : (
              <Button onClick={start} disabled={isPending || pending}>
                <Play className="h-4 w-4" />
                Start Timer
              </Button>
            )}
            <Button onClick={openCreate} disabled={isPending || pending} variant="outline">
              <Plus className="h-4 w-4" />
              Manual
            </Button>
          </div>
          {activeTimer ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Dimulai {formatDistanceToNow(new Date(activeTimer.startTime), { addSuffix: true, locale: id })}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          {timesheets.map((row) => {
            const canEditRow = canManageProp || row.userId === currentUserId;
            return (
              <div key={row.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.userName ?? "User"}</p>
                    {!row.endTime ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Aktif</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{row.description ?? "-"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(row.startTime).toLocaleString("id-ID")} - {row.endTime ? new Date(row.endTime).toLocaleString("id-ID") : "berjalan"}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold">
                    <Clock className="h-4 w-4" />
                    {row.endTime ? minutesLabel(row.durationMinutes) : "Timer aktif"}
                  </p>
                </div>
                {canEditRow ? <RowActions onEdit={() => openEdit(row)} onDelete={() => removeTimesheet(row)} /> : null}
              </div>
            );
          })}
          {timesheets.length === 0 ? <EmptyText text="Belum ada timesheet." /> : null}
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <h3 className="text-sm font-semibold">Total per User</h3>
          <div className="mt-3 space-y-2">
            {summary.byUser.map((row) => (
              <div key={row.userId} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{row.userName ?? "User"}</span>
                <span className="font-medium">{minutesLabel(row.totalMinutes)}</span>
              </div>
            ))}
            {summary.byUser.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada jam selesai.</p> : null}
          </div>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Timesheet" : "Tambah Timesheet Manual"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Mulai</Label>
                <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Selesai</Label>
                <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Durasi menit override</Label>
              <Input type="number" min={0} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={submit} disabled={!form.startTime || isPending}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon-sm" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

// ─── ActivityLog ────────────────────────────────────────────────────────────

function ActivityLog({ rows }: { rows: ProjectActivityRow[] }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start gap-3 rounded-xl border border-border/60 p-4">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary/30" />
            <div className="min-w-0">
              <p className="font-medium">{row.userName ?? "User"}</p>
              <p className="text-sm text-muted-foreground">{row.description ?? row.action}</p>
              <time className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true, locale: id })}
              </time>
            </div>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Belum ada aktivitas.
          </p>
        ) : null}
      </div>
    </section>
  );
}
