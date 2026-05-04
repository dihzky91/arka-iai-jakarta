import { env } from "@/lib/env";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  // Refresh 5 menit sebelum expire
  if (cache && cache.expiresAt - now > 5 * 60 * 1000) {
    return cache.token;
  }

  const res = await fetch(`${env.DINGTALK_BASE_URL}/v1.0/oauth2/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appKey: env.DINGTALK_APP_KEY,
      appSecret: env.DINGTALK_APP_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`DingTalk auth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { accessToken: string; expireIn: number };
  cache = {
    token: data.accessToken,
    expiresAt: now + data.expireIn * 1000,
  };

  return cache.token;
}
