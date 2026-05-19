"use server";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import {
  divisi,
  projectActivityLog,
  projectCommentMentions,
  projectComments,
  projectFiles,
  projectNotes,
  projects,
  users,
} from "@/server/db/schema";
import { requireCapability, requireSession } from "@/server/actions/auth";
import { parseDataUrl, sanitizeFileName } from "@/lib/storage/utils";
import { getStorageProvider } from "@/lib/storage";
import { env } from "@/lib/env";
import { enforceUploadRateLimit } from "@/lib/rate-limit/upload-guard";
import {
  uuidSchema,
  logProjectActivity,
  notifyProjectUser,
  requireProjectMember,
  getProjectRole,
  getGlobalAccess,
  isAdminSession,
} from "./_project-shared";
import { getProjectMembers } from "./project-core";

export type ProjectNoteRow = {
  id: string;
  projectId: string;
  title: string;
  content: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CommentAttachmentRow = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
};

export type ProjectCommentRow = {
  id: string;
  projectId: string;
  parentId: string | null;
  content: string;
  isInternal: boolean | null;
  isEdited: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  authorDivisi: string | null;
  attachments: CommentAttachmentRow[];
};

export type ProjectFileRow = {
  id: string;
  projectId: string;
  commentId: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  uploaderId: string;
  uploaderName: string | null;
};

export type ProjectActivityRow = {
  id: string;
  action: string;
  description: string | null;
  createdAt: Date;
  userId: string;
  userName: string | null;
};

const commentSchema = z.object({
  content: z.string().trim().min(1, "Komentar wajib diisi."),
  parentId: uuidSchema.optional().nullable(),
  isInternal: z.boolean().optional().default(false),
  fileIds: z.array(uuidSchema).optional().default([]),
});

const uploadSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  dataUrl: z.string().min(1),
  commentId: uuidSchema.optional().nullable(),
});

const projectMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/zip",
  "application/x-zip-compressed",
]);

const noteSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi.").max(255),
  content: z.string().optional().nullable(),
});

export async function listComments(projectId: string): Promise<ProjectCommentRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  const rows = await db
    .select({
      id: projectComments.id,
      projectId: projectComments.projectId,
      parentId: projectComments.parentId,
      content: projectComments.content,
      isInternal: projectComments.isInternal,
      isEdited: projectComments.isEdited,
      createdAt: projectComments.createdAt,
      updatedAt: projectComments.updatedAt,
      authorId: projectComments.userId,
      authorName: users.namaLengkap,
      authorAvatarUrl: users.avatarUrl,
      authorDivisi: divisi.nama,
    })
    .from(projectComments)
    .innerJoin(users, eq(projectComments.userId, users.id))
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .where(eq(projectComments.projectId, parsedId))
    .orderBy(asc(projectComments.createdAt));

  const commentIds = rows.map((r) => r.id);
  const attachmentRows =
    commentIds.length > 0
      ? await db
          .select({
            commentId: projectFiles.commentId,
            id: projectFiles.id,
            fileName: projectFiles.fileName,
            fileUrl: projectFiles.fileUrl,
            fileSize: projectFiles.fileSize,
            mimeType: projectFiles.mimeType,
          })
          .from(projectFiles)
          .where(inArray(projectFiles.commentId, commentIds))
      : [];

  const attachmentMap = new Map<string, CommentAttachmentRow[]>();
  for (const a of attachmentRows) {
    if (!a.commentId) continue;
    const list = attachmentMap.get(a.commentId) ?? [];
    list.push({ id: a.id, fileName: a.fileName, fileUrl: a.fileUrl, fileSize: a.fileSize, mimeType: a.mimeType });
    attachmentMap.set(a.commentId, list);
  }

  return rows.map((r) => ({ ...r, attachments: attachmentMap.get(r.id) ?? [] }));
}

export async function createComment(projectId: string, data: unknown) {
  const dataResult = commentSchema.safeParse(data);
  if (!dataResult.success) {
    return { ok: false as const, error: dataResult.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = dataResult.data;

  try {
    const parsedId = uuidSchema.parse(projectId);
    const { session, role } = await requireProjectMember(parsedId);
    if (role === "viewer") return { ok: false as const, error: "Viewer tidak bisa berkomentar." };

    const [comment] = await db
      .insert(projectComments)
      .values({
        projectId: parsedId,
        userId: session.user.id,
        parentId: parsed.parentId ?? null,
        content: parsed.content,
        isInternal: parsed.isInternal,
      })
      .returning({ id: projectComments.id, content: projectComments.content });

    if (!comment) return { ok: false as const, error: "Gagal menyimpan komentar." };

    if (parsed.fileIds.length > 0) {
      await db
        .update(projectFiles)
        .set({ commentId: comment.id })
        .where(
          and(
            inArray(projectFiles.id, parsed.fileIds),
            eq(projectFiles.projectId, parsedId),
            eq(projectFiles.userId, session.user.id),
          ),
        );
    }

    const [project] = await db
      .select({ title: projects.title })
      .from(projects)
      .where(eq(projects.id, parsedId))
      .limit(1);

    const members = await getProjectMembers(parsedId);
    const loweredContent = parsed.content.toLowerCase();
    const mentioned = members.filter(
      (member) =>
        member.userId !== session.user.id &&
        member.namaLengkap &&
        loweredContent.includes(`@${member.namaLengkap.toLowerCase()}`),
    );

    if (mentioned.length) {
      await db.insert(projectCommentMentions).values(
        mentioned.map((member) => ({ commentId: comment.id, userId: member.userId })),
      );
      const authorName =
        (session.user as { namaLengkap?: string; name?: string }).namaLengkap ??
        session.user.name ??
        "User";
      await Promise.all(
        mentioned.map((member) =>
          notifyProjectUser({
            userId: member.userId,
            type: "mention",
            title: "Mention Project",
            message: `${authorName} mention Anda di project ${project?.title ?? "Project"}`,
            entitasId: parsedId,
          }),
        ),
      );
    }

    await logProjectActivity(parsedId, session.user.id, "comment_added", "Komentar baru ditambahkan.");
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: comment };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin berkomentar." };
    return { ok: false as const, error: "Gagal menyimpan komentar." };
  }
}

export async function updateComment(commentId: string, content: string) {
  const parsedCommentId = uuidSchema.parse(commentId);
  const trimmedContent = content.trim();
  if (!trimmedContent) return { ok: false as const, error: "Komentar tidak boleh kosong." };
  const session = await requireSession();
  const [existing] = await db
    .select({ id: projectComments.id, projectId: projectComments.projectId, userId: projectComments.userId })
    .from(projectComments)
    .where(eq(projectComments.id, parsedCommentId))
    .limit(1);
  if (!existing) return { ok: false as const, error: "Komentar tidak ditemukan." };
  if (existing.userId !== session.user.id) {
    return { ok: false as const, error: "Hanya author yang bisa mengubah komentar." };
  }

  await db
    .update(projectComments)
    .set({ content: trimmedContent, isEdited: true, updatedAt: new Date() })
    .where(eq(projectComments.id, parsedCommentId));

  revalidatePath(`/projects/${existing.projectId}`);
  return { ok: true as const };
}

export async function deleteComment(commentId: string) {
  const parsedCommentId = uuidSchema.parse(commentId);
  const session = await requireSession();
  const [existing] = await db
    .select({ id: projectComments.id, projectId: projectComments.projectId, userId: projectComments.userId })
    .from(projectComments)
    .where(eq(projectComments.id, parsedCommentId))
    .limit(1);
  if (!existing) return { ok: false as const, error: "Komentar tidak ditemukan." };

  const role = await getProjectRole(existing.projectId, session.user.id);
  const canDelete =
    existing.userId === session.user.id ||
    isAdminSession(session) ||
    role === "owner" ||
    role === "manager";
  if (!canDelete) return { ok: false as const, error: "Tidak boleh menghapus komentar." };

  await db.delete(projectComments).where(eq(projectComments.id, parsedCommentId));
  await logProjectActivity(existing.projectId, session.user.id, "comment_deleted", "Komentar dihapus.");
  revalidatePath(`/projects/${existing.projectId}`);
  return { ok: true as const };
}

export async function listProjectFiles(projectId: string): Promise<ProjectFileRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  return db
    .select({
      id: projectFiles.id,
      projectId: projectFiles.projectId,
      commentId: projectFiles.commentId,
      fileName: projectFiles.fileName,
      fileUrl: projectFiles.fileUrl,
      fileSize: projectFiles.fileSize,
      mimeType: projectFiles.mimeType,
      uploadedAt: projectFiles.uploadedAt,
      uploaderId: projectFiles.userId,
      uploaderName: users.namaLengkap,
    })
    .from(projectFiles)
    .innerJoin(users, eq(projectFiles.userId, users.id))
    .where(and(eq(projectFiles.projectId, parsedId), isNull(projectFiles.commentId)))
    .orderBy(desc(projectFiles.uploadedAt));
}

export async function uploadProjectFile(projectId: string, data: unknown) {
  const dataResult = uploadSchema.safeParse(data);
  if (!dataResult.success) {
    return { ok: false as const, error: dataResult.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = dataResult.data;

  try {
    await requireCapability("projects:upload");
    const parsedId = uuidSchema.parse(projectId);
    const { session, role } = await requireProjectMember(parsedId);
    if (role === "viewer") return { ok: false as const, error: "Viewer tidak bisa upload file." };
    enforceUploadRateLimit(session.user.id);

    const payload = parseDataUrl(parsed.dataUrl);
    const contentType = parsed.contentType.trim().toLowerCase();
    if (contentType !== payload.contentType) {
      return { ok: false as const, error: "Tipe file tidak konsisten." };
    }
    if (!projectMimeTypes.has(contentType)) {
      return { ok: false as const, error: "Tipe file tidak didukung." };
    }

    const maxBytes = Math.max(1, env.STORAGE_MAX_FILE_MB || 20) * 1024 * 1024;
    if (payload.body.byteLength > maxBytes) {
      return { ok: false as const, error: `Ukuran file melebihi ${env.STORAGE_MAX_FILE_MB || 20} MB.` };
    }

    const storage = getStorageProvider();
    const uploaded = await storage.upload({
      body: payload.body,
      fileName: sanitizeFileName(parsed.fileName),
      contentType,
      folder: `projects/${parsedId}`,
    });

    const [row] = await db
      .insert(projectFiles)
      .values({
        projectId: parsedId,
        userId: session.user.id,
        commentId: parsed.commentId ?? null,
        fileName: uploaded.fileName || sanitizeFileName(parsed.fileName),
        fileUrl: uploaded.url,
        storageKey: uploaded.key,
        fileSize: uploaded.size ?? payload.body.byteLength,
        mimeType: contentType,
      })
      .returning({ id: projectFiles.id, fileName: projectFiles.fileName, fileUrl: projectFiles.fileUrl });

    await logProjectActivity(parsedId, session.user.id, "file_uploaded", `Uploaded ${row?.fileName ?? parsed.fileName}.`);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin upload file." };
    return { ok: false as const, error: "Gagal upload file." };
  }
}

export async function deleteProjectFile(fileId: string) {
  const parsedFileId = uuidSchema.parse(fileId);
  const session = await requireSession();
  const [file] = await db
    .select({
      id: projectFiles.id,
      projectId: projectFiles.projectId,
      userId: projectFiles.userId,
      fileName: projectFiles.fileName,
      storageKey: projectFiles.storageKey,
    })
    .from(projectFiles)
    .where(eq(projectFiles.id, parsedFileId))
    .limit(1);
  if (!file) return { ok: false as const, error: "File tidak ditemukan." };

  const role = await getProjectRole(file.projectId, session.user.id);
  const canDelete = file.userId === session.user.id || isAdminSession(session) || role === "owner";
  if (!canDelete) return { ok: false as const, error: "Tidak boleh menghapus file." };

  await db.delete(projectFiles).where(eq(projectFiles.id, parsedFileId));
  if (file.storageKey) {
    await getStorageProvider().delete(file.storageKey);
  }
  await logProjectActivity(file.projectId, session.user.id, "file_deleted", `Deleted ${file.fileName}.`);
  revalidatePath(`/projects/${file.projectId}`);
  return { ok: true as const };
}

export async function listProjectActivity(projectId: string): Promise<ProjectActivityRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  return db
    .select({
      id: projectActivityLog.id,
      action: projectActivityLog.action,
      description: projectActivityLog.description,
      createdAt: projectActivityLog.createdAt,
      userId: projectActivityLog.userId,
      userName: users.namaLengkap,
    })
    .from(projectActivityLog)
    .leftJoin(users, eq(projectActivityLog.userId, users.id))
    .where(eq(projectActivityLog.projectId, parsedId))
    .orderBy(desc(projectActivityLog.createdAt));
}

export async function listProjectNotes(projectId: string): Promise<ProjectNoteRow[]> {
  const parsedId = uuidSchema.parse(projectId);
  await requireProjectMember(parsedId);

  return db
    .select({
      id: projectNotes.id,
      projectId: projectNotes.projectId,
      title: projectNotes.title,
      content: projectNotes.content,
      createdBy: projectNotes.createdBy,
      createdByName: users.namaLengkap,
      createdAt: projectNotes.createdAt,
      updatedAt: projectNotes.updatedAt,
    })
    .from(projectNotes)
    .leftJoin(users, eq(projectNotes.createdBy, users.id))
    .where(eq(projectNotes.projectId, parsedId))
    .orderBy(desc(projectNotes.createdAt));
}

export async function createProjectNote(projectId: string, data: unknown) {
  const result = noteSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;

  try {
    const parsedId = uuidSchema.parse(projectId);
    const { session, role } = await requireProjectMember(parsedId);
    if (role === "viewer") return { ok: false as const, error: "Viewer tidak bisa membuat catatan." };

    const [row] = await db
      .insert(projectNotes)
      .values({
        projectId: parsedId,
        title: parsed.title,
        content: parsed.content ?? null,
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning({ id: projectNotes.id, title: projectNotes.title });

    if (!row) throw new Error("INSERT_FAILED");

    await logProjectActivity(parsedId, session.user.id, "note_created", `Catatan "${row.title}" dibuat.`);
    revalidatePath(`/projects/${parsedId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin membuat catatan." };
    return { ok: false as const, error: `Gagal membuat catatan: ${message}` };
  }
}

export async function updateProjectNote(noteId: string, data: unknown) {
  const result = noteSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;

  try {
    const parsedId = uuidSchema.parse(noteId);
    const session = await requireSession();

    const [existing] = await db
      .select({ id: projectNotes.id, projectId: projectNotes.projectId, title: projectNotes.title, createdBy: projectNotes.createdBy })
      .from(projectNotes)
      .where(eq(projectNotes.id, parsedId))
      .limit(1);

    if (!existing) return { ok: false as const, error: "Catatan tidak ditemukan." };

    const access = await getGlobalAccess(session.user.id);
    const role = await getProjectRole(existing.projectId, session.user.id);
    const isAdmin = access.isAdmin;
    const isMember = role !== null;
    const isCreator = existing.createdBy === session.user.id;
    const isManager = role === "owner" || role === "manager";

    if (!isAdmin && !isManager && !(isCreator && isMember)) {
      return { ok: false as const, error: "Anda tidak memiliki izin mengubah catatan ini." };
    }

    const [row] = await db
      .update(projectNotes)
      .set({ title: parsed.title, content: parsed.content ?? null, updatedAt: new Date() })
      .where(eq(projectNotes.id, parsedId))
      .returning({ id: projectNotes.id, title: projectNotes.title });

    if (!row) return { ok: false as const, error: "Catatan tidak ditemukan." };

    await logProjectActivity(existing.projectId, session.user.id, "note_updated", `Catatan "${row.title}" diperbarui.`);
    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const, data: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin mengubah catatan." };
    return { ok: false as const, error: `Gagal mengubah catatan: ${message}` };
  }
}

export async function deleteProjectNote(noteId: string) {
  try {
    const parsedId = uuidSchema.parse(noteId);
    const session = await requireSession();

    const [existing] = await db
      .select({ id: projectNotes.id, projectId: projectNotes.projectId, title: projectNotes.title, createdBy: projectNotes.createdBy })
      .from(projectNotes)
      .where(eq(projectNotes.id, parsedId))
      .limit(1);

    if (!existing) return { ok: false as const, error: "Catatan tidak ditemukan." };

    const access = await getGlobalAccess(session.user.id);
    const role = await getProjectRole(existing.projectId, session.user.id);
    const isAdmin = access.isAdmin;
    const isMember = role !== null;
    const isCreator = existing.createdBy === session.user.id;
    const isManager = role === "owner" || role === "manager";

    if (!isAdmin && !isManager && !(isCreator && isMember)) {
      return { ok: false as const, error: "Anda tidak memiliki izin menghapus catatan ini." };
    }

    await db.delete(projectNotes).where(eq(projectNotes.id, parsedId));

    await logProjectActivity(existing.projectId, session.user.id, "note_deleted", `Catatan "${existing.title}" dihapus.`);
    revalidatePath(`/projects/${existing.projectId}`);
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return { ok: false as const, error: "Anda tidak memiliki izin menghapus catatan." };
    return { ok: false as const, error: `Gagal menghapus catatan: ${message}` };
  }
}
