"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  APP_BRAND_NAME,
  APP_BRAND_TAGLINE,
  APP_ORGANIZATION_NAME,
} from "@/lib/branding";

const REMEMBER_KEY = "iaij.login.rememberedEmail";

interface LoginPageClientProps {
  redirectTo: string;
  systemIdentity: {
    namaSistem: string;
    logoUrl: string | null;
  };
}

export function LoginPageClient({
  redirectTo,
  systemIdentity,
}: LoginPageClientProps) {
  const router = useRouter();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dingtalkLoading, setDingtalkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      // localStorage tidak tersedia (mode privat) — abaikan.
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string })?.message ??
            "Gagal masuk. Periksa email & kata sandi.",
        );
      }
      try {
        if (remember) {
          window.localStorage.setItem(REMEMBER_KEY, normalizedEmail);
        } else {
          window.localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        // abaikan kegagalan localStorage
      }
      setEmail(normalizedEmail);
      const destination = redirectTo || "/dashboard";
      router.push(destination);
      window.location.assign(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  async function handleDingTalkLogin() {
    setDingtalkLoading(true);
    setError(null);
    try {
      await authClient.signIn.oauth2({
        providerId: "dingtalk",
        callbackURL: redirectTo || "/dashboard",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal login dengan DingTalk");
      setDingtalkLoading(false);
    }
  }

  function handleTogglePasswordVisibility() {
    setShowPassword((current) => {
      const next = !current;
      if (passwordInputRef.current) {
        passwordInputRef.current.type = next ? "text" : "password";
      }
      return next;
    });
  }

  const appName =
    systemIdentity.namaSistem ||
    process.env.NEXT_PUBLIC_APP_NAME ||
    APP_BRAND_NAME;
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "v1.0.0";
  const year = new Date().getFullYear();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Pattern dot halus */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,_hsl(221_83%_53%_/_0.08)_1px,_transparent_0)] bg-[length:22px_22px]"
      />
      {/* Glow lembut di atas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(60%_60%_at_50%_0%,_hsl(221_83%_53%_/_0.18),_transparent_70%)]"
      />

      <div className="w-full max-w-[420px]">
        {/* Brand */}
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
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            {appName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {APP_BRAND_TAGLINE}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-7 shadow-xl shadow-primary/5 sm:p-8">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Masuk ke akun Anda
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gunakan email kantor untuk mengakses dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@iai-jakarta.or.id"
                  autoComplete="email"
                  aria-invalid={!!error || undefined}
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Kata Sandi</Label>
                <a
                  href="mailto:admin@iai-jakarta.or.id?subject=Permohonan%20Reset%20Kata%20Sandi"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Lupa kata sandi?
                </a>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={!!error || undefined}
                  className="h-11 pr-10 pl-10"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleTogglePasswordVisibility}
                  className="absolute top-1/2 right-1 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
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
            </div>

            <div className="flex items-center pt-1">
              <Label
                htmlFor="remember"
                className="cursor-pointer text-sm font-normal text-muted-foreground"
              >
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                />
                Ingat email saya
              </Label>
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
                  Masuk
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">atau</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={dingtalkLoading || loading}
            onClick={handleDingTalkLogin}
            className="mt-4 h-11 w-full"
            size="lg"
          >
            {dingtalkLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menghubungkan ke DingTalk...
              </>
            ) : (
              <>
                {/* DingTalk logo inline SVG */}
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  aria-hidden="true"
                  fill="currentColor"
                >
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.293 13.657c-.195.195-.512.195-.707 0l-2.586-2.586-2.586 2.586c-.195.195-.512.195-.707 0-.195-.195-.195-.512 0-.707L12.293 12 9.707 9.414c-.195-.195-.195-.512 0-.707.195-.195.512-.195.707 0L12 11.293l2.586-2.586c.195-.195.512-.195.707 0 .195.195.195.512 0 .707L12.707 12l2.586 2.586c.195.195.195.512 0 .707z" />
                </svg>
                Login dengan DingTalk
              </>
            )}
          </Button>

          <div className="mt-4 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            Belum punya akses?{" "}
            <a
              href="mailto:admin@iai-jakarta.or.id?subject=Permohonan%20Akses%20Sistem"
              className="font-medium text-foreground hover:text-primary hover:underline"
            >
              Hubungi admin sistem
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            © {year} {APP_ORGANIZATION_NAME}
          </span>
          <span className="font-mono">{appVersion}</span>
        </div>
      </div>
    </main>
  );
}
