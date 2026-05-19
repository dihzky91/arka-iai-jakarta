/**
 * Simple in-memory token-bucket rate limiter keyed by `${userId}:${action}`.
 * Resets every windowMs. Suitable for single-instance deployments only.
 * For multi-instance / serverless, swap with Redis-backed implementation.
 */

type BucketKey = string;
type Bucket = { count: number; resetAt: number };

const buckets = new Map<BucketKey, Bucket>();

export type RateLimitConfig = {
  /** Limit per window (e.g. 60 = 60 requests per windowMs). */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfterMs: number; resetAt: number };

export function checkUserRateLimit(
  userId: string,
  action: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const key = `${userId}:${action}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + config.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: config.limit - 1, resetAt };
  }

  if (existing.count >= config.limit) {
    return {
      ok: false,
      retryAfterMs: existing.resetAt - now,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  return { ok: true, remaining: config.limit - existing.count, resetAt: existing.resetAt };
}

// Default policies for sertifikat module
export const RATE_LIMIT_POLICIES = {
  certificate_download: { limit: 60, windowMs: 60_000 },          // 60/menit
  certificate_email: { limit: 30, windowMs: 60_000 },             // 30/menit
  certificate_bulk_download: { limit: 5, windowMs: 60_000 },      // 5/menit (heavy)
  certificate_bulk_email: { limit: 3, windowMs: 60_000 },         // 3/menit (heavy)
  file_upload: { limit: 30, windowMs: 60_000 },                   // 30 upload/menit
  file_upload_heavy: { limit: 10, windowMs: 60_000 },             // 10 large file/menit
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitAction = keyof typeof RATE_LIMIT_POLICIES;

export function checkSertifikatRateLimit(userId: string, action: RateLimitAction): RateLimitResult {
  return checkUserRateLimit(userId, action, RATE_LIMIT_POLICIES[action]);
}

export function formatRetryAfter(retryAfterMs: number): string {
  const seconds = Math.ceil(retryAfterMs / 1000);
  if (seconds < 60) return `${seconds} detik`;
  return `${Math.ceil(seconds / 60)} menit`;
}
