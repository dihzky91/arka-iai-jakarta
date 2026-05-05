import { env } from "@/lib/env";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;
let oldApiCache: TokenCache | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
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

// Old API token dari oapi.dingtalk.com/gettoken — diperlukan untuk
// endpoint lama seperti attendance/list yang tidak menerima new OAuth2 token.
export async function getOldApiToken(): Promise<string> {
  const now = Date.now();
  if (oldApiCache && oldApiCache.expiresAt - now > 5 * 60 * 1000) {
    return oldApiCache.token;
  }

  const url = `https://oapi.dingtalk.com/gettoken?appkey=${env.DINGTALK_APP_KEY}&appsecret=${env.DINGTALK_APP_SECRET}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`DingTalk old auth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { errcode: number; errmsg: string; access_token: string; expires_in: number };
  if (data.errcode !== 0) {
    throw new Error(`DingTalk old auth error: ${data.errmsg}`);
  }

  oldApiCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return oldApiCache.token;
}
