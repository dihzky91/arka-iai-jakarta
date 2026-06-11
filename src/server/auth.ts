import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth } from "better-auth/plugins";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "./db";
import {
  users,
  session as sessionTable,
  account as accountTable,
  verification as verificationTable,
  absensiKaryawan,
} from "./db/schema";
import { sendTemplatedEmail } from "@/lib/email/template-engine";
import { env } from "@/lib/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessionTable,
      account: accountTable,
      verification: verificationTable,
    },
    usePlural: false,
  }),

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  // Izinkan request dari localhost dan semua subdomain devtunnels.ms
  // supaya tidak perlu ganti-ganti BETTER_AUTH_URL saat pakai dev tunnel.
  trustedOrigins: [
    "http://localhost:6700",
    "https://*.devtunnels.ms",
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
  ],

  generateId: () => crypto.randomUUID(),

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    disableSignUp: true,
    minPasswordLength: 8,
    // Better Auth memanggil callback ini setelah requestPasswordReset.
    // Dipakai untuk dua skenario:
    //  - Undangan aktivasi akun pegawai baru (createPegawai)
    //  - Reset kata sandi user existing (lupa password)
    sendResetPassword: async ({ user, url }) => {
      // Better Auth meneruskan querystring callbackURL via param `url`.
      // Kita arahkan link ke halaman /reset-password agar UX konsisten.
      const isInvite = url.includes("invite=1");
      const templateKey = isInvite ? "auth_invite" : "auth_reset_password";

      void sendTemplatedEmail(templateKey, {
        to: user.email,
        toName: user.name ?? undefined,
        variables: {
          "recipient.nama": user.name ?? user.email,
          "auth.invite_url": url,
          "auth.reset_url": url,
          "auth.inviter_name": "Admin ARKA",
          "auth.expiry": "1 jam",
        },
      });
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 hari
    updateAge: 60 * 60 * 24,     // refresh sekali sehari
  },

  user: {
    // Mapping nama kolom Better Auth → nama kolom di schema Drizzle
    // "name" (Better Auth) → "namaLengkap" (kolom kita)
    fields: {
      name: "namaLengkap",
    },
    // Field tambahan di luar standar Better Auth yang ingin bisa diakses dari session
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "staff",
        input: false, // tidak bisa diisi user sendiri saat register
      },
      roleId: {
        type: "number",
        required: false,
        input: false,
      },
      isSuperAdmin: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
      divisiId: {
        type: "number",
        required: false,
        input: false,
      },
      jabatan: {
        type: "string",
        required: false,
        input: false,
      },
      dingtalkUserId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["dingtalk"],
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const dtUserId = (user as Record<string, unknown>).dingtalkUserId as string | undefined;
          if (!dtUserId) return;
          await db
            .update(absensiKaryawan)
            .set({ userId: user.id })
            .where(
              and(
                eq(absensiKaryawan.dingtalkUserId, dtUserId),
                isNull(absensiKaryawan.userId),
              ),
            );
        },
      },
    },
  },

  plugins: [
    nextCookies(),
    genericOAuth({
      config: [
        {
          providerId: "dingtalk",
          clientId: env.DINGTALK_APP_KEY,
          clientSecret: env.DINGTALK_APP_SECRET,
          authorizationUrl: "https://login.dingtalk.com/oauth2/auth",
          tokenUrl: "https://api.dingtalk.com/v1.0/oauth2/userAccessToken",
          scopes: ["openid", "Contact.User.Read"],
          prompt: "consent",
          getToken: async ({ code }) => {
            const res = await fetch("https://api.dingtalk.com/v1.0/oauth2/userAccessToken", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clientId: env.DINGTALK_APP_KEY,
                clientSecret: env.DINGTALK_APP_SECRET,
                code,
                grantType: "authorization_code",
              }),
            });
            const data = (await res.json()) as {
              accessToken: string;
              refreshToken?: string;
              expireIn?: number;
            };
            return {
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              accessTokenExpiresAt: data.expireIn
                ? new Date(Date.now() + data.expireIn * 1000)
                : undefined,
            };
          },
          getUserInfo: async (tokens) => {
            const res = await fetch("https://api.dingtalk.com/v1.0/contact/users/me", {
              headers: { "x-acs-dingtalk-access-token": tokens.accessToken ?? "" },
            });
            const profile = (await res.json()) as Record<string, unknown>;
            const dtUserId = (profile.userId ?? profile.unionId ?? profile.openId) as string | undefined;
            const displayName = (profile.name ?? profile.nick) as string | undefined;
            if (!dtUserId || !displayName) return null;
            return {
              id: dtUserId,
              name: displayName,
              email: (profile.email as string | undefined) || `${dtUserId}@dingtalk.noemail`,
              image: (profile.avatarUrl ?? profile.avatar) as string | undefined,
              emailVerified: false,
              dingtalkUserId: dtUserId,
            };
          },
          mapProfileToUser: (profile) => ({
            name: (profile.name ?? profile.nick) as string,
            email: (profile.email as string | undefined) || `${profile.id as string}@dingtalk.noemail`,
            dingtalkUserId: (profile.dingtalkUserId ?? profile.id) as string,
            isActive: true,
            role: "staff" as const,
          }),
        },
      ],
    }),
  ],
});

// Type helper — gunakan ini di server actions untuk type session
export type AuthSession = typeof auth.$Infer.Session;

// Type untuk user dari session (includes additionalFields)
export type SessionUser = AuthSession["user"];
