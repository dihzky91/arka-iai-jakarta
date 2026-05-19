/**
 * Upload rate limit guard.
 * Call this at the start of any upload server action to enforce per-user upload limits.
 */

import { checkUserRateLimit, RATE_LIMIT_POLICIES, formatRetryAfter } from "./user-bucket";

export function enforceUploadRateLimit(userId: string): void {
  const result = checkUserRateLimit(userId, "file_upload", RATE_LIMIT_POLICIES.file_upload);
  if (!result.ok) {
    throw new Error(
      `Upload terlalu sering. Coba lagi dalam ${formatRetryAfter(result.retryAfterMs)}.`,
    );
  }
}
