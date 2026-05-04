import { env } from "@/lib/env";
import { getAccessToken } from "./auth";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 30_000;

async function dingtalkFetch(
  path: string,
  options: RequestInit = {},
  retries = 0,
): Promise<Response> {
  const token = await getAccessToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${env.DINGTALK_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-acs-dingtalk-access-token": token,
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (res.status === 429 && retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return dingtalkFetch(path, options, retries + 1);
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function dingtalkPost<T>(path: string, body: unknown): Promise<T> {
  const res = await dingtalkFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DingTalk POST ${path} failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function dingtalkGet<T>(path: string): Promise<T> {
  const res = await dingtalkFetch(path, { method: "GET" });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DingTalk GET ${path} failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}
