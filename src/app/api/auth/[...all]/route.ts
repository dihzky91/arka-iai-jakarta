import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import {
  checkIpRateLimit,
  getClientIpFromHeaders,
  AUTH_RATE_LIMITS,
} from "@/lib/rate-limit/ip-bucket";

const { GET: originalGET, POST: originalPOST } = toNextJsHandler(auth.handler);

export { originalGET as GET };

// ─── Rate-limited POST handler ───────────────────────────────────────────────
// Sensitive auth actions (sign-in, forget-password) get stricter limits.

function detectAuthAction(pathname: string): keyof typeof AUTH_RATE_LIMITS {
  if (pathname.includes("/sign-in")) return "sign_in";
  if (pathname.includes("/forget-password") || pathname.includes("/reset-password")) {
    return "forget_password";
  }
  return "auth_generic";
}

export async function POST(request: NextRequest) {
  const ip = getClientIpFromHeaders(request.headers);
  const action = detectAuthAction(request.nextUrl.pathname);
  const limit = checkIpRateLimit(ip, action, AUTH_RATE_LIMITS[action]);

  if (!limit.ok) {
    const retryAfterSec = Math.ceil(limit.retryAfterMs / 1000);
    return NextResponse.json(
      {
        error: "Terlalu banyak percobaan. Coba lagi nanti.",
        retryAfter: retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      },
    );
  }

  return originalPOST(request);
}
