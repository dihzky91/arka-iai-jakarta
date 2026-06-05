"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { users, auditLog } from "@/server/db/schema";
import { requireSession } from "./auth";
import { getStorageProvider } from "@/lib/storage";
import { env } from "@/lib/env";
import { enforceUploadRateLimit } from "@/lib/rate-limit/upload-guard";

export type ProfileRow = {
  id: string;
  namaLengkap: string;
  email: string;
  emailPribadi: string | null;
  noHp: string | null;
  jabatan: string | null;
  avatarUrl: string | null;
  role: string | null;
};

export async function getMyProfile(): Promise<ProfileRow | null> {
  const session = await requireSession();
  const [row] = await db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
      email: users.email,
      emailPribadi: users.emailPribadi,
      noHp: users.noHp,
      jabatan: users.jabatan,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  return row ?? null;
}

const profileUpdateSchema = z.object({
  namaLengkap: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama maksimal 100 karakter")
    .optional()
    .or(z.literal("")),
  emailPribadi: z
    .string()
    .trim()
    .email("Email pribadi tidak valid")
    .optional()
    .or(z.literal("")),
  noHp: z
    .string()
    .trim()
    .max(20, "Maksimal 20 karakter")
    .optional()
    .or(z.literal("")),
});

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function updateMyProfile(formData: FormData) {
  const session = await requireSession();

  const parsed = profileUpdateSchema.safeParse({
    namaLengkap: formData.get("namaLengkap") ?? "",
    emailPribadi: formData.get("emailPribadi") ?? "",
    noHp: formData.get("noHp") ?? "",
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  let avatarUrl: string | undefined;
  const avatarFile = formData.get("avatar") as File | null;
  if (avatarFile && avatarFile.size > 0) {
    enforceUploadRateLimit(session.user.id);
    if (!ALLOWED_AVATAR_TYPES.includes(avatarFile.type)) {
      return {
        ok: false as const,
        error: "Format avatar tidak didukung. Gunakan PNG, JPG, atau WebP.",
      };
    }
    const maxBytes = env.STORAGE_MAX_FILE_MB * 1024 * 1024;
    if (avatarFile.size > maxBytes) {
      return {
        ok: false as const,
        error: `Avatar melebihi batas ${env.STORAGE_MAX_FILE_MB} MB.`,
      };
    }
    const storage = getStorageProvider();
    const result = await storage.upload({
      body: Buffer.from(await avatarFile.arrayBuffer()),
      fileName: avatarFile.name,
      contentType: avatarFile.type,
      folder: "avatars",
      publicId: session.user.id,
    });
    avatarUrl = result.url;
  }

  const namaLengkap = parsed.data.namaLengkap || undefined;

  await db
    .update(users)
    .set({
      ...(namaLengkap && { namaLengkap }),
      emailPribadi: parsed.data.emailPribadi || null,
      noHp: parsed.data.noHp || null,
      ...(avatarUrl !== undefined && { avatarUrl }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_PROFILE",
    entitasType: "user",
    entitasId: session.user.id,
    detail: {
      namaLengkapChanged: !!namaLengkap,
      emailPribadiChanged: !!parsed.data.emailPribadi,
      noHpChanged: !!parsed.data.noHp,
      avatarChanged: !!avatarUrl,
    },
  });

  revalidatePath("/pengaturan");
  revalidatePath("/profil");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
