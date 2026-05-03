"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Download,
  FileUp,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  type ProjectMemberRole,
  type ProjectStatus,
} from "@/lib/project-constants";
import {
  addProjectMembers,
  createComment,
  deleteProjectFile,
  getProjectMembers,
  listComments,
  listProjectActivity,
  listProjectFiles,
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
} from "@/server/actions/projects";

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

function canManage(role: ProjectMemberRole | "admin") {
  return role === "admin" || role === "owner" || role === "manager";
}

function canContribute(role: ProjectMemberRole | "admin") {
  return canManage(role) || role === "member";
}

export function ProjectDetail({
  project,
  initialMembers,
  initialComments,
  initialFiles,
  initialActivity,
  defaultTab = "overview",
}: {
  project: ProjectDetailRow;
  initialMembers: ProjectMemberRow[];
  initialComments: ProjectCommentRow[];
  initialFiles: ProjectFileRow[];
  initialActivity: ProjectActivityRow[];
  defaultTab?: string;
}) {
  const [status, setStatus] = useState(project.status);
  const [members, setMembers] = useState(initialMembers);
  const [comments, setComments] = useState(initialComments);
  const [files, setFiles] = useState(initialFiles);
  const [activity, setActivity] = useState(initialActivity);
  const [isPending, startTransition] = useTransition();
  const role = project.currentUserProjectRole;

  function refreshAll() {
    startTransition(async () => {
      const [nextMembers, nextComments, nextFiles, nextActivity] =
        await Promise.all([
          getProjectMembers(project.id),
          listComments(project.id),
          listProjectFiles(project.id),
          listProjectActivity(project.id),
        ]);
      setMembers(nextMembers);
      setComments(nextComments);
      setFiles(nextFiles);
      setActivity(nextActivity);
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
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Overview project={project} />
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

function Overview({ project }: { project: ProjectDetailRow }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-xl border border-border bg-card p-5">
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
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
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
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
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
  const rootComments = comments.filter((comment) => !comment.parentId);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, ProjectCommentRow[]>();
    for (const comment of comments) {
      if (!comment.parentId) continue;
      map.set(comment.parentId, [...(map.get(comment.parentId) ?? []), comment]);
    }
    return map;
  }, [comments]);

  function insertMention(name: string | null) {
    if (!name) return;
    setContent((current) => `${current}${current.endsWith(" ") || !current ? "" : " "}@${name} `);
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
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
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
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Tulis komentar..."
            rows={4}
          />
          <div className="flex flex-wrap items-center gap-2">
            {members.slice(0, 8).map((member) => (
              <Button
                key={member.userId}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertMention(member.namaLengkap)}
              >
                @{member.namaLengkap}
              </Button>
            ))}
            <Button
              className="ml-auto"
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
  onReply,
}: {
  comment: ProjectCommentRow;
  replies: ProjectCommentRow[];
  onReply: () => void;
}) {
  return (
    <article className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{comment.authorName ?? "User"}</p>
          <p className="text-xs text-muted-foreground">
            {comment.authorDivisi ?? "-"} - {formatTanggalWaktuJakarta(comment.createdAt)}
            {comment.isEdited ? " - diedit" : ""}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onReply}>
          Reply
        </Button>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
        {splitMentions(comment.content).map((part, index) =>
          part.mention ? (
            <span key={index} className="rounded bg-primary/10 px-1 font-medium text-primary">
              {part.text}
            </span>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
      {replies.length ? (
        <div className="mt-4 space-y-3 border-l border-border pl-4">
          {replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} replies={[]} onReply={onReply} />
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
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      {canUpload ? (
        <div className="rounded-xl border border-dashed border-border p-4">
          <Label className="flex cursor-pointer items-center justify-center gap-2 text-sm">
            {isPending || pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Upload file project
            <Input
              type="file"
              className="hidden"
              onChange={(event) => upload(event.target.files?.[0] ?? null)}
            />
          </Label>
        </div>
      ) : null}
      <div className="space-y-3">
        {files.map((file) => (
          <div key={file.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">{file.fileName}</p>
              <p className="text-sm text-muted-foreground">
                {fileSize(file.fileSize)} - {file.uploaderName ?? "User"} - {formatTanggalWaktuJakarta(file.uploadedAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={file.fileUrl} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => remove(file)}>
                <Trash2 className="h-4 w-4" />
                Hapus
              </Button>
            </div>
          </div>
        ))}
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
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
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
            <div>
              <p className="font-medium">{member.namaLengkap ?? member.email}</p>
              <p className="text-sm text-muted-foreground">{member.divisiNama ?? "-"} - {member.email}</p>
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
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-2 rounded-xl border border-border p-4 md:grid-cols-[180px_1fr]">
            <time className="text-sm text-muted-foreground">
              {formatTanggalWaktuJakarta(row.createdAt)}
            </time>
            <div>
              <p className="font-medium">{row.userName ?? "User"}</p>
              <p className="text-sm text-muted-foreground">{row.description ?? row.action}</p>
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
