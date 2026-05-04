import { env } from "@/lib/env";

export function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\//, "")
    .replace(/\.\./g, "")
    .replace(/[^a-zA-Z0-9/._-]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^-+|-+$/g, "");
}

export function sanitizeFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
  const extension = dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";

  const safeBase = baseName
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${safeBase || "file"}${extension}`;
}

export function buildStorageKey(parts: string[]) {
  return parts
    .map((part) => sanitizePathSegment(part))
    .filter(Boolean)
    .join("/");
}

export function prependStoragePrefix(prefix: string, folder?: string) {
  return buildStorageKey([prefix, folder ?? ""]);
}

export function ensureBuffer(body: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body, "base64");
  return Buffer.from(body);
}

export type PreparedUploadPayload = {
  body: Buffer;
  contentType: string;
  fileName: string;
  size: number;
};

const DATA_URL_PATTERN = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,(.+)$/s;

// Validators check actual file bytes, not client-declared MIME type.
// Prevents rename attack (e.g. .exe renamed to .pdf).
const MAGIC_BYTE_VALIDATORS: Record<string, (buf: Buffer) => boolean> = {
  "application/pdf": (buf) =>
    buf.length >= 4 &&
    buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46,
  "image/jpeg": (buf) =>
    buf.length >= 3 &&
    buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  "image/png": (buf) =>
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a,
  "image/webp": (buf) =>
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50,
  // OLE Compound Document (legacy .doc, .xls, .ppt)
  "application/msword": (buf) =>
    buf.length >= 4 &&
    buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0,
  // OOXML formats (.docx, .xlsx, .pptx) are ZIP archives
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (buf) =>
    buf.length >= 4 &&
    buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04,
};

export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const validator = MAGIC_BYTE_VALIDATORS[mimeType];
  if (!validator) return true;
  return validator(buffer);
}

export function getAllowedMimeTypes(): string[] {
  return env.STORAGE_ALLOWED_MIME_TYPES.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function parseDataUrl(dataUrl: string) {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new Error("Format file upload tidak valid.");
  }

  const contentType = match[1];
  const encodedBody = match[2];

  if (!contentType || !encodedBody) {
    throw new Error("Konten file upload tidak lengkap.");
  }

  return {
    contentType: contentType.toLowerCase(),
    body: Buffer.from(encodedBody, "base64"),
  };
}

export function prepareUploadPayload(input: {
  fileName: string;
  contentType?: string;
  dataUrl: string;
}): PreparedUploadPayload {
  const safeFileName = sanitizeFileName(input.fileName);
  const parsed = parseDataUrl(input.dataUrl);
  const declaredType = input.contentType?.trim().toLowerCase();
  const contentType = declaredType || parsed.contentType;
  const allowedMimeTypes = getAllowedMimeTypes();
  const maxBytes = Math.max(1, env.STORAGE_MAX_FILE_MB) * 1024 * 1024;

  if (declaredType && declaredType !== parsed.contentType) {
    throw new Error("Tipe file tidak konsisten dengan konten upload.");
  }

  if (!allowedMimeTypes.includes(contentType)) {
    throw new Error("Tipe file tidak didukung.");
  }

  if (!validateMagicBytes(parsed.body, contentType)) {
    throw new Error("Konten file tidak sesuai dengan tipe yang dideklarasikan.");
  }

  if (!parsed.body.byteLength) {
    throw new Error("File upload kosong.");
  }

  if (parsed.body.byteLength > maxBytes) {
    throw new Error(
      `Ukuran file melebihi batas ${env.STORAGE_MAX_FILE_MB} MB.`,
    );
  }

  return {
    body: parsed.body,
    contentType,
    fileName: safeFileName,
    size: parsed.body.byteLength,
  };
}
