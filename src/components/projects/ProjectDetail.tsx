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
  Download,
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
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  type ProjectMemberRole,
  type ProjectStatus,
  type ProjectTaskStatus,
} from "@/lib/project-constants";
import {
  addProjectMembers,
  createComment,
  deleteProjectFile,
  getProjectMembers,
  listComments,
  listProjectActivity,
  listProjectFiles,
  listProjectTasks,
  listProjectMilestones,
  searchUsersForInvite,
  updateMemberRole,
  removeProjectMember,
  updateProjectStatus,
  uploadProjectFile,
  type InviteUserRow,
  type ProjectActivityRow,
  type ProjectCommentRow,
  type ProjectDetailRow,
  type ProjectFileRow,
  type ProjectMemberRow,
  type ProjectTaskRow,
  type ProjectMilestoneRow,
} from "@/server/actions/projects";
import { TaskSection } from "@/components/projects/TaskSection";
import { MilestoneSection } from "@/components/projects/MilestoneSection";

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
  const dim = size === "md" ? 8 : 6;
  const initial = (name ?? "?").charAt(0).toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? ""}
        className={`h-${dim} w-${dim} shrink-0 rounded-full border border-border bg-muted object-cover`}
        title={name ?? ""}
      />
    );
  }
  return (
    <div
      className={`flex h-${dim} w-${dim} shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 text-xs font-semibold text-primary`}
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
  defaultTab?: string;
}) {
  const [status, setStatus] = useState(project.status);
  const [members, setMembers] = useState(initialMembers);
  const [comments, setComments] = useState(initialComments);
  const [files, setFiles] = useState(initialFiles);
  const [activity, setActivity] = useState(initialActivity);
  const [tasks, setTasks] = useState(initialTasks);
  const [milestones, setMilestones] = useState(initialMilestones);
  const [isPending, startTransition] = useTransition();
  const role = project.currentUserProjectRole;

  function refreshAll() {
    startTransition(async () => {
      const [nextMembers, nextComments, nextFiles, nextActivity, nextTasks, nextMilestones] =
        await Promise.all([
          getProjectMembers(project.id),
          listComments(project.id),
          listProjectFiles(project.id),
          listProjectActivity(project.id),
          listProjectTasks(project.id),
          listProjectMilestones(project.id),
        ]);
      setMembers(nextMembers);
      setComments(nextComments);
      setFiles(nextFiles);
      setActivity(nextActivity);
      setTasks(nextTasks);
      setMilestones(nextMilestones);
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
              <Badge variant="secondary">{project.type}</Badge>
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
                <SelectTrigger className="w-48">
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
}: {
  project: ProjectDetailRow;
  tasks: ProjectTaskRow[];
  activity: ProjectActivityRow[];
  members: ProjectMemberRow[];
  files: ProjectFileRow[];
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
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Detail</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Info label="Tipe" value={project.type} />
            <Info label="Status" value={statusLabel(project.status)} />
            <Info label="Tanggal" value={`${formatTanggal(project.startDate)} - ${formatTanggal(project.endDate)}`} />
            <Info label="SKP" value={formatSKP(project.skp)} />
            <Info label="Biaya" value={project.price ? `Rp ${Number(project.price).toLocaleString("id-ID")}` : "-"} />
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

function getMentionContext(text: string, cursorPos: number): { start: number; query: string } | null {
  const beforeCursor = text.slice(0, cursorPos);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex < 0) return null;
  const afterAt = beforeCursor.slice(atIndex + 1);
  if (afterAt.includes(" ")) return null;
  if (!/^[a-zA-Z0-9\s.]*$/.test(afterAt)) return null;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionContext, setMentionContext] = useState<{ start: number; query: string } | null>(null);

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
    const sel = textareaRef.current;
    if (sel) {
      const ctx = getMentionContext(value, sel.selectionStart);
      setMentionContext(ctx);
      setMentionOpen(!!ctx);
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

  function submit() {
    startTransition(async () => {
      const result = await createComment(projectId, {
        content,
        parentId: replyTo,
      });
      if (result.ok) {
        setContent("");
        setReplyTo(null);
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
              <span>Membalas komentar</span>
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
                <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Mention anggota"
                    >
                      @
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-56 p-1"
                    align="start"
                    side="top"
                    onOpenAutoFocus={(event) => event.preventDefault()}
                  >
                    {filteredMembers.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto">
                        {filteredMembers.map((member) => (
                          <button
                            key={member.userId}
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                            onClick={() => selectMention(member)}
                          >
                            <Avatar name={member.namaLengkap} avatarUrl={member.avatarUrl} size="sm" />
                            <span className="truncate">{member.namaLengkap ?? member.email}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="p-2 text-sm text-muted-foreground">Tidak ditemukan</p>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(event) => handleContentChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tulis komentar... Gunakan @ untuk mention anggota"
              className="min-h-[140px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={!content.trim() || isPending || pending}
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
