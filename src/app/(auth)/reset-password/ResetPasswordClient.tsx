"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  APP_BRAND_NAME,
  APP_BRAND_TAGLINE,
  APP_ORGANIZATION_NAME,
} from "@/lib/branding";
import { activateInvitedAccount } from "@/server/actions/invitations";

interface ResetPasswordClientProps {
  token: string;
  isInvite: boolean;
  linkError: string | null;
  inviteEmail?: string | null;
  systemIdentity: {
    namaSistem: string;
    logoUrl: string | null;
  };
}

export function ResetPasswordClient({
  token,
  isInvite,
  linkError,
  inviteEmail,
  systemIdentity,
}: ResetPasswordClientProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const heading = isInvite ? "Aktivasi Akun" : "Atur Ulang Kata Sandi";
  const subheading = isInvite
    ? "Buat kata sandi untuk mengaktifkan akun baru Anda."
    : "Masukkan kata sandi baru untuk akun Anda.";
  const submitLabel = isInvite ? "Aktivasi Akun" : "Simpan Kata Sandi Baru";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(
        "Token tidak ditemukan di URL. Pastikan Anda membuka tautan dari email.",
      );
      return;
    }

    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }

    if (password !== confirm) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password, token }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const reason =
          (body as { message?: string })?.message ??
          "Tautan tidak valid atau sudah kadaluarsa. Hubungi admin.";
        setError(reason);
        return;
      }

      // Untuk invite: aktifkan akun + mark invitation accepted
      if (isInvite && inviteEmail) {
        try {
          await activateInvitedAccount(inviteEmail);
        } catch (err) {
          console.error("[ResetPasswordClient] Gagal aktivasi:", err);
        }
      }

      setSuccess(true);
      // Beri jeda singkat agar user lihat konfirmasi sebelum di-redirect.
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan kata sandi.",
      );
    } finally {
      setLoading(false);
    }
  }

  const appName =
    systemIdentity.namaSistem ||
    process.env.NEXT_PUBLIC_APP_NAME ||
    APP_BRAND_NAME;
  const year = new Date().getFullYear();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,_hsl(221_83%_53%_/_0.08)_1px,_transparent_0)] bg-[length:22px_22px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(60%_60%_at_50%_0%,_hsl(221_83%_53%_/_0.18),_transparent_70%)]"
      />

      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          {systemIdentity.logoUrl ? (
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-md shadow-primary/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={systemIdentity.logoUrl}
                alt={appName}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-sky-600 text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-primary/20">
              <Building2 className="h-7 w-7" strokeWidth={2.2} />
              <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-background">
                <ShieldCheck className="h-3 w-3" />
              </span>
            </div>
          )}
          <h1 className="mt-4 text-xl font-medium tracking-tight text-foreground">
            {appName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {APP_BRAND_TAGLINE}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-7 shadow-xl shadow-primary/5 sm:p-8">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <h2 className="text-lg font-medium text-foreground">
                {isInvite ? "Akun Aktif" : "Kata Sandi Diperbarui"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Anda akan diarahkan ke halaman masuk...
              </p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-medium text-foreground">
                  {heading}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {subheading}
                </p>
              </div>

              {!token || linkError ? (
                <div
                  role="alert"
                  className="mt-6 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-3 text-sm text-destructive"
                >
                  Tautan tidak valid. Pastikan Anda membuka URL dari email
                  terbaru atau hubungi admin untuk dikirim ulang.
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="mt-6 space-y-4"
                  noValidate
                >
                  <div className="space-y-2">
                    <Label htmlFor="password">Kata Sandi Baru</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        aria-invalid={!!error || undefined}
                        className="h-11 pr-10 pl-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                        aria-label={
                          showPassword
                            ? "Sembunyikan kata sandi"
                            : "Tampilkan kata sandi"
                        }
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Minimal 8 karakter. Disarankan kombinasi huruf, angka, dan
                      simbol.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm">Konfirmasi Kata Sandi</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirm"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                        aria-invalid={!!error || undefined}
                        className="h-11 pl-10"
                      />
                    </div>
                  </div>

                  {error ? (
                    <div
                      role="alert"
                      className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
                    >
                      {error}
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        {submitLabel}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
                Sudah ingat kata sandi?{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  Masuk
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            © {year} {APP_ORGANIZATION_NAME}
          </span>
          <span className="font-mono">Reset Password</span>
        </div>
      </div>
    </main>
  );
}
