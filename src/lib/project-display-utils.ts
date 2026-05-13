import { Archive, File, FileImage, FileSpreadsheet, FileText } from "lucide-react";
import type { ProjectMemberRole, ProjectStatus } from "@/lib/project-constants";

export function statusLabel(status: ProjectStatus) {
  const labels: Record<ProjectStatus, string> = {
    not_started: "Belum mulai",
    in_progress: "Berjalan",
    on_hold: "Tertunda",
    completed: "Selesai",
    cancelled: "Dibatalkan",
  };
  return labels[status];
}

export function fileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileTypeIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("word") || mimeType.includes("document")) return FileText;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z")) return Archive;
  return File;
}

export function canManage(role: ProjectMemberRole | "admin") {
  return role === "admin" || role === "owner" || role === "manager";
}

export function canContribute(role: ProjectMemberRole | "admin") {
  return canManage(role) || role === "member";
}

export function getCaretPixelPos(el: HTMLTextAreaElement, pos: number): { top: number; left: number } {
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

export function getMentionContext(text: string, cursorPos: number): { start: number; query: string } | null {
  const beforeCursor = text.slice(0, cursorPos);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex < 0) return null;
  const afterAt = beforeCursor.slice(atIndex + 1);
  if (afterAt.includes(" ")) return null;
  if (/[@#]/.test(afterAt)) return null;
  return { start: atIndex, query: afterAt };
}

export function rupiah(value: number | string | null | undefined) {
  return `Rp ${Number(value ?? 0).toLocaleString("id-ID")}`;
}

export function minutesLabel(minutes: number | null | undefined) {
  const total = Number(minutes ?? 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} menit`;
  if (mins === 0) return `${hours} jam`;
  return `${hours} jam ${mins} menit`;
}

export function dateTimeLocalValue(date: Date | string | null | undefined) {
  if (!date) return "";
  const parsed = new Date(date);
  const offset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}
