# Rencana: DingTalk OAuth Login (Fitur 2)

**Status:** Belum diimplementasi  
**Prioritas:** High — menyelesaikan loop user onboarding tanpa manual input  
**Dependency:** Fitur 1 (sync absensi tanpa akun ARKA) ✅ selesai

---

## Tujuan

User DingTalk bisa login ke ARKA dengan scan QR atau tap "Login dengan DingTalk" di mobile. Akun ARKA auto-created saat pertama kali login. Tidak perlu registrasi manual atau import oleh admin.

---

## Flow Lengkap

```
[User buka ARKA] 
  → klik "Login dengan DingTalk"
  → redirect ke DingTalk OAuth consent
  → user approve di DingTalk (atau scan QR di desktop)
  → DingTalk callback ke ARKA dengan authorization code
  → ARKA tukar code → access token → ambil profile user
  → cek apakah email/dingtalkUserId sudah ada di DB
      ├─ Sudah ada → login langsung, update dingtalkUserId jika belum ter-set
      └─ Belum ada → buat akun ARKA baru (isActive: true), set dingtalkUserId
  → session dibuat → redirect ke dashboard
```

---

## DingTalk OAuth Endpoints

| Langkah | Method | URL |
|---------|--------|-----|
| Authorization | GET | `https://login.dingtalk.com/oauth2/auth` |
| Exchange token | POST | `https://api.dingtalk.com/v1.0/oauth2/userAccessToken` |
| Get user profile | GET | `https://api.dingtalk.com/v1.0/contact/users/me` |

### Authorization URL params

```
https://login.dingtalk.com/oauth2/auth
  ?response_type=code
  &client_id={DINGTALK_APP_KEY}
  &redirect_uri={BETTER_AUTH_URL}/api/auth/callback/dingtalk
  &scope=openid+Contact.User.Read
  &prompt=consent
  &state={csrf_token}
```

### Token exchange (POST)

```json
// Request body
{
  "clientId": "{DINGTALK_APP_KEY}",
  "clientSecret": "{DINGTALK_APP_SECRET}",
  "code": "{authorization_code}",
  "grantType": "authorization_code"
}

// Response
{
  "accessToken": "...",
  "refreshToken": "...",
  "expireIn": 7200,
  "corpId": "..."
}
```

### Get user profile (GET /v1.0/contact/users/me)

```
Header: x-acs-dingtalk-access-token: {user_access_token}

Response:
{
  "userId": "xxx",
  "name": "Budi Santoso",
  "email": "budi@example.com",
  "mobile": "08123456789",
  "avatar": "https://..."
}
```

---

## Implementasi dengan Better Auth

Better Auth mendukung custom OAuth provider via plugin `genericOAuth`.

### 1. Install / konfigurasi provider

Di `src/server/auth.ts`, tambah plugin:

```ts
import { genericOAuth } from "better-auth/plugins";

export const auth = betterAuth({
  // ...existing config...
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "dingtalk",
          clientId: env.DINGTALK_APP_KEY,
          clientSecret: env.DINGTALK_APP_SECRET,
          authorizationUrl: "https://login.dingtalk.com/oauth2/auth",
          tokenUrl: "https://api.dingtalk.com/v1.0/oauth2/userAccessToken",
          scopes: ["openid", "Contact.User.Read"],
          // Token endpoint DingTalk butuh JSON body, bukan form-encoded
          tokenEndpointAuthentication: "client_secret_post",
          getUserInfo: async (tokens) => {
            const res = await fetch("https://api.dingtalk.com/v1.0/contact/users/me", {
              headers: { "x-acs-dingtalk-access-token": tokens.accessToken },
            });
            const profile = await res.json();
            return {
              id: profile.userId,
              name: profile.name,
              email: profile.email,
              image: profile.avatar,
              // field custom
              dingtalkUserId: profile.userId,
            };
          },
          mapProfileToUser: (profile) => ({
            namaLengkap: profile.name,
            email: profile.email ?? `${profile.id}@dingtalk.noemail`,
            dingtalkUserId: profile.dingtalkUserId,
            isActive: true,
            role: "staff", // default, admin bisa ubah
          }),
        },
      ],
    }),
  ],
});
```

### 2. Tombol login di halaman sign-in

Di `src/app/(auth)/sign-in/page.tsx` atau komponen login:

```tsx
import { signIn } from "@/lib/auth-client";

<Button
  variant="outline"
  onClick={() => signIn.social({ provider: "dingtalk", callbackURL: "/dashboard" })}
>
  <DingTalkIcon className="mr-2 h-4 w-4" />
  Login dengan DingTalk
</Button>
```

### 3. Auto-link akun existing

Saat user OAuth login, jika email sudah ada di DB (akun ARKA yang diimport admin), Better Auth harus link account bukan buat baru. Konfigurasi di `auth.ts`:

```ts
betterAuth({
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["dingtalk"],
    },
  },
})
```

### 4. Retroactive link absensi unlinked

Setelah user pertama kali login via DingTalk, trigger background job untuk link record absensi lama (`userId = NULL`) ke akun ARKA baru:

```ts
// Di auth callback / onUserCreated hook
await db
  .update(absensiKaryawan)
  .set({ userId: newUser.id })
  .where(
    and(
      eq(absensiKaryawan.dingtalkUserId, profile.dingtalkUserId),
      isNull(absensiKaryawan.userId),
    )
  );
```

---

## Env vars yang dibutuhkan

Sudah ada di `.env.local`:
- `DINGTALK_APP_KEY` ✅
- `DINGTALK_APP_SECRET` ✅
- `BETTER_AUTH_URL` ✅ (untuk redirect URI)

Redirect URI yang perlu didaftarkan di DingTalk Open Platform:
```
{BETTER_AUTH_URL}/api/auth/callback/dingtalk
```

---

## Konfigurasi DingTalk Open Platform

1. Buka [DingTalk Open Platform](https://open.dingtalk.com)
2. Pilih aplikasi → **权限管理** (Permission Management)
3. Tambah scope: `Contact.User.Read`, `openid`
4. **回调域名** (Callback domain): tambah domain ARKA
5. **登录回调地址** (Login callback URL): `{BETTER_AUTH_URL}/api/auth/callback/dingtalk`

---

## Catatan Penting

- DingTalk token endpoint menggunakan **JSON body**, bukan `application/x-www-form-urlencoded`. Pastikan `genericOAuth` dikonfigurasi dengan benar atau buat custom fetch.
- `email` dari DingTalk bisa kosong jika user tidak set email di profil. Handle dengan fallback `{userId}@dingtalk.noemail` atau minta user isi email setelah login pertama.
- User yang login via DingTalk pertama kali langsung `isActive: true` — tidak perlu aktivasi manual.
- Setelah implementasi ini, flow import manual (Fitur admin di Pengaturan) tetap tersedia sebagai fallback untuk user yang tidak mau/tidak bisa akses DingTalk.

---

## Estimasi Implementasi

| Task | Effort |
|------|--------|
| Konfigurasi `genericOAuth` di `auth.ts` | ~2 jam |
| Tombol login DingTalk di halaman sign-in | ~30 menit |
| Handle edge case email kosong | ~1 jam |
| Retroactive link absensi unlinked | ~1 jam |
| Test end-to-end (mobile + desktop) | ~2 jam |
| Daftar callback URL di DingTalk portal | ~15 menit |

**Total estimasi: ~7 jam**
