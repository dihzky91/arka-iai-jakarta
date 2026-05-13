"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Bold, Copy, Download, ExternalLink, File, FileImage, FileText, FileSpreadsheet, Archive, Italic, List, Loader2, MessageSquare, MoreHorizontal, Paperclip, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { splitMentions } from "@/lib/mention-parser";
import { formatTanggalWaktuJakarta } from "@/lib/utils";
import {
  createComment,
  uploadProjectFile,
  type ProjectCommentRow,
  type ProjectMemberRow,
  type ProjectFileRow,
} from "@/server/actions/projects";
import { Avatar } from "./ProjectAvatar";
import { EmptyText } from "./shared-ui";
import { getCaretPixelPos, getMentionContext, fileTypeIcon, fileSize } from "@/lib/project-display-utils";

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

export function CommentSection({
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
          <EmptyText
            icon={MessageSquare}
            title="Belum ada komentar"
            text="Diskusi project, mention anggota, dan lampiran komentar akan muncul di sini."
          />
        ) : null}
      </div>
    </section>
  );
}
