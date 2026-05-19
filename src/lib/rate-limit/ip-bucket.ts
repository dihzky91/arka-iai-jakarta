/**
 * Simple in-memory IP-based rate limiter for auth endpoints.
 * Resets every windowMs. Suitable for single-instance deployments only.
 * For multi-instance / serverless, swap with Redis-backed implementation.
 */

type BucketKey = string;
type Bucket = { count: number; resetAt: number };

const buckets = new Map<BucketKey, Bucket>();

export type IpRateLimitConfig = {
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type IpRateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

export function checkIpRateLimit(
  ip: string,
  action: string,
  config: IpRateLimitConfig,
): IpRateLimitResult {
  const now = Date.now();
  const key = `${ip}:${action}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { ok: true, remaining: config.limit - 1 };
  }

  if (existing.count >= config.limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true, remaining: config.limit - existing.count };
}

// ─── AUTH RATE LIMIT POLICIES ─────────────────────────────────────────────────

export const AUTH_RATE_LIMITS = {
  /** Login: max 10 attempts per IP per minute */
  sign_in: { limit: 10, windowMs: 60_000 },
  /** Password reset request: max 5 per IP per 5 minutes */
  forget_password: { limit: 5, windowMs: 5 * 60_000 },
  /** Generic auth POST (catch-all): max 30 per IP per minute */
  auth_generic: { limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, IpRateLimitConfig>;

export function getClientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return headers.get("x-real-ip") ?? "unknown";
}
