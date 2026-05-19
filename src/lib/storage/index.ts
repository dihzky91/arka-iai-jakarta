import { env } from "@/lib/env";
import { CloudinaryStorageProvider } from "@/lib/storage/providers/cloudinary";
import { HostedStorageProvider } from "@/lib/storage/providers/hosted";
import { LocalStorageProvider } from "@/lib/storage/providers/local";
import type { StorageProvider, StorageProviderKind } from "@/lib/storage/types";

let storageProvider: StorageProvider | null = null;

function resolveProvider(kind: StorageProviderKind): StorageProvider {
  switch (kind) {
    case "cloudinary":
      return new CloudinaryStorageProvider();
    case "hosted":
      return new HostedStorageProvider();
    case "local":
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "[storage] FATAL: LocalStorageProvider tidak boleh dipakai di production. " +
          "File akan hilang di serverless/ephemeral environment. " +
          "Set STORAGE_PROVIDER=cloudinary.",
        );
      }
      return new LocalStorageProvider();
    default:
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          `[storage] FATAL: STORAGE_PROVIDER="${kind}" tidak dikenali. ` +
          `Gunakan "cloudinary" untuk production.`,
        );
      }
      return new LocalStorageProvider();
  }
}

export function getStorageProvider(): StorageProvider {
  if (storageProvider) return storageProvider;

  const rawKind = env.STORAGE_PROVIDER.toLowerCase();
  const kind: StorageProviderKind =
    rawKind === "cloudinary" || rawKind === "hosted" || rawKind === "local"
      ? rawKind
      : "local";

  storageProvider = resolveProvider(kind);
  return storageProvider;
}

export * from "@/lib/storage/types";
