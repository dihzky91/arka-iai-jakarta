// Helper pembacaan env yang memberi warning jelas bila kosong saat development.
// Server-side only — jangan impor dari komponen client.

function readEnv(key: string, required = false): string {
  const v = process.env[key];
  if (!v) {
    if (required) {
      throw new Error(`Env var ${key} wajib di-set.`);
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[env] ${key} kosong — fitur terkait akan non-fungsional.`);
    }
    return "";
  }
  return v;
}

function readEnvOptional(key: string): string {
  return process.env[key] ?? "";
}

export const env = {
  DATABASE_URL: readEnv("DATABASE_URL"),
  BETTER_AUTH_SECRET: readEnv("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: readEnv("BETTER_AUTH_URL"),
  STORAGE_PROVIDER: readEnv("STORAGE_PROVIDER") || "local",
  STORAGE_ENV_PREFIX:
    readEnvOptional("STORAGE_ENV_PREFIX") ||
    (process.env.NODE_ENV === "production" ? "prod" : "dev"),
  // Jangan pakai folder di bawah ./public — file harus di-serve lewat Route Handler beretentikasi.
  STORAGE_LOCAL_DIR: readEnv("STORAGE_LOCAL_DIR") || "./storage/uploads",
  STORAGE_PUBLIC_BASE_URL: readEnv("STORAGE_PUBLIC_BASE_URL") || "/api/files",
  STORAGE_MAX_FILE_MB: Number(readEnvOptional("STORAGE_MAX_FILE_MB") || "10"),
  STORAGE_ALLOWED_MIME_TYPES:
    readEnvOptional("STORAGE_ALLOWED_MIME_TYPES") ||
    [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].join(","),
  CLOUDINARY_CLOUD_NAME: readEnv("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: readEnv("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: readEnv("CLOUDINARY_API_SECRET"),
  MAILJET_API_KEY: readEnv("MAILJET_API_KEY"),
  MAILJET_API_SECRET: readEnv("MAILJET_API_SECRET"),
  MAILJET_FROM_EMAIL: readEnv("MAILJET_FROM_EMAIL"),
  MAILJET_FROM_NAME: readEnv("MAILJET_FROM_NAME"),
  BREVO_API_KEY: readEnv("BREVO_API_KEY"),
  BREVO_FROM_EMAIL: readEnv("BREVO_FROM_EMAIL"),
  BREVO_FROM_NAME: readEnv("BREVO_FROM_NAME"),
  DINGTALK_APP_KEY: readEnv("DINGTALK_APP_KEY"),
  DINGTALK_APP_SECRET: readEnv("DINGTALK_APP_SECRET"),
  DINGTALK_BASE_URL: readEnvOptional("DINGTALK_BASE_URL") || "https://api.dingtalk.com",
  FONNTE_TOKEN: readEnvOptional("FONNTE_TOKEN"),
};
