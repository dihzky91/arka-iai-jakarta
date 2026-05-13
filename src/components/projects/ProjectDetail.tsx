"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  MessageSquare,
  Paperclip,
  Save,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatSKP } from "@/lib/skp-calculator";
import { formatTanggal } from "@/lib/utils";
import {
  PROJECT_TYPE_LABELS,
  type ProjectMemberRole,
  type ProjectStatus,
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
  getInvoicesByProject,
  getHonorariumSummaryByProject,
  getProjectCertificateInfo,
  getProjectFinancialSummary,
  getProjectMembers,
  getProjectTimesheetSummary,
  listComments,
  listProjectActivity,
  listProjectBudgetItems,
  listProjectExpenses,
  listProjectFiles,
  listProjectMilestones,
  listProjectNotes,
  listProjectSpeakers,
  listProjectTasks,
  listProjectTimesheets,
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
  type HonorariumSummary,
  type InvoiceKuitansiSummary,
  type ProjectCertificateInfo,
} from "@/server/actions/projects";
import { TaskSection } from "@/components/projects/TaskSection";
import { MilestoneSection } from "@/components/projects/MilestoneSection";
import { NoteSection } from "@/components/projects/NoteSection";
import { canManage, canContribute, statusLabel } from "@/lib/project-display-utils";
import { Overview } from "./ProjectOverviewSection";
import { CommentSection } from "./CommentSection";
import { FileSection } from "./FileSection";
import { MemberSection } from "./MemberSection";
import { SpeakerPanel } from "./SpeakerPanel";
import { ExpensePanel } from "./FinancePanel";
import { TimesheetPanel } from "./TimesheetPanel";
import { ActivityLog } from "./ActivityLog";

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
  initialHonorariumSummary,
  initialInvoiceKuitansiSummary,
  initialCertificateInfo,
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
  initialHonorariumSummary?: HonorariumSummary | null;
  initialInvoiceKuitansiSummary?: InvoiceKuitansiSummary;
  initialCertificateInfo?: ProjectCertificateInfo | null;
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
  const [honorariumSummary, setHonorariumSummary] = useState<HonorariumSummary | null | undefined>(initialHonorariumSummary);
  const [invoiceKuitansiSummary, setInvoiceKuitansiSummary] = useState<InvoiceKuitansiSummary | undefined>(initialInvoiceKuitansiSummary);
  const [certificateInfo, setCertificateInfo] = useState<ProjectCertificateInfo | null | undefined>(initialCertificateInfo);
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
        nextHonorarium,
        nextInvoiceKuitansi,
        nextCertificate,
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
          getHonorariumSummaryByProject(project.id).catch(() => null),
          getInvoicesByProject(project.id),
          getProjectCertificateInfo(project.id).catch(() => null),
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
      setHonorariumSummary(nextHonorarium);
      setInvoiceKuitansiSummary(nextInvoiceKuitansi);
      setCertificateInfo(nextCertificate);
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
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
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
        <TabsList
          variant="line"
          className="flex h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/60 bg-transparent pb-px"
        >
          {tabItems.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-none items-center gap-1.5 whitespace-nowrap rounded-t-xl px-3 py-2 text-sm data-[state=active]:bg-primary/5 data-[state=active]:font-semibold data-[state=active]:text-primary"
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
            honorariumSummary={honorariumSummary}
            invoiceKuitansiSummary={invoiceKuitansiSummary}
            certificateInfo={certificateInfo}
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
            <TabsList
              variant="line"
              className="flex h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border/60 bg-transparent pb-px"
            >
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
