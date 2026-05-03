import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Route yang memerlukan login ─────────────────────────────────────────────
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/surat-masuk",
  "/surat-keluar",
  "/disposisi",
  "/surat-keputusan",
  "/surat-mou",
  "/nomor-surat",
  "/pegawai",
  "/divisi",
  "/pejabat",
  "/pengaturan",
  "/audit-log",
  "/projects",
];

// ─── Route yang hanya boleh diakses saat BELUM login ─────────────────────────
const AUTH_ONLY_ROUTES = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lightweight check: cukup cek keberadaan session cookie.
  // Validasi session asli (ke DB) tetap dilakukan di layout Server Component.
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");
  const isLoggedIn = !!sessionCookie;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  // Belum login, akses halaman protected → redirect ke /login
  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    // Simpan tujuan asal agar bisa di-redirect balik setelah login
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Sudah login, akses /login → redirect ke /dashboard
  if (AUTH_ONLY_ROUTES.includes(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Terapkan proxy ke semua route kecuali asset statis & API auth
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
