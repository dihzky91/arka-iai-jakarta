import { getAccessToken } from "./auth";
import { dingtalkGet } from "./client";

export interface DingtalkUser {
  userId: string;
  name: string;
  email?: string;
  mobile?: string;
}

/**
 * List user dari DingTalk API dengan fallback:
 * 1. New API v1.0 (api.dingtalk.com) — /v1.0/contact/departments/users
 * 2. Old API v2 (oapi.dingtalk.com)  — /topapi/v2/user/list
 */
export async function listDingtalkUsers(): Promise<DingtalkUser[]> {
  const errors: string[] = [];

  for (const fetcher of FALLBACKS) {
    try {
      return await fetcher();
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  throw new Error(
    `Semua endpoint gagal:\n${errors.map((m, i) => `  ${i + 1}. ${m}`).join("\n")}`,
  );
}

// ─── FALLBACK 1: new API v1.0 (api.dingtalk.com) ─────────────────────────
// Endpoint: GET /v1.0/contact/departments/users
// Params: deptId, cursor, size (max 100)

interface V1ListResponse {
  result?: {
    list: Array<{
      userId: string;
      name: string;
      email?: string;
      mobile?: string;
    }>;
    hasMore?: boolean;
    nextCursor?: number;
  };
}

async function tryV1(): Promise<DingtalkUser[]> {
  const all: DingtalkUser[] = [];
  let cursor = 0;
  const size = 100;

  while (true) {
    const res = await dingtalkGet<V1ListResponse>(
      `/v1.0/contact/departments/users?deptId=1&cursor=${cursor}&size=${size}&orderField=custom_order&containAccessibleDepartment=false`,
    );
    const list = (res.result?.list ?? []).map((u) => ({
      userId: u.userId,
      name: u.name,
      email: u.email,
      mobile: u.mobile,
    }));
    all.push(...list);
    if (!res.result?.hasMore) break;
    cursor = res.result.nextCursor ?? cursor + size;
  }

  return all;
}

// ─── FALLBACK 2: old API v2 via oapi.dingtalk.com ────────────────────────
// Endpoint: POST /topapi/v2/user/list
// Response pakai has_more + next_cursor (snake_case)

interface OldApiUser {
  userid: string;
  name: string;
  email?: string;
  mobile?: string;
}

interface OldApiV2Response {
  errcode: number;
  errmsg: string;
  result?: {
    list: OldApiUser[];
    has_more: boolean;
    next_cursor: number;
  };
}

async function tryOld(): Promise<DingtalkUser[]> {
  const token = await getAccessToken();
  const all: DingtalkUser[] = [];
  let cursor = 0;
  const size = 100;

  while (true) {
    const url = `https://oapi.dingtalk.com/topapi/v2/user/list?access_token=${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dept_id: 1, cursor, size, order_field: "custom", contain_dept: false }),
    });

    const data = (await res.json()) as OldApiV2Response;

    if (data.errcode !== 0) {
      throw new Error(`DingTalk old API error: ${data.errmsg}`);
    }

    const list = (data.result?.list ?? []).map((u) => ({
      userId: u.userid,
      name: u.name,
      email: u.email,
      mobile: u.mobile,
    }));

    all.push(...list);
    if (!data.result?.has_more) break;
    cursor = data.result.next_cursor;
  }

  return all;
}

const FALLBACKS = [tryV1, tryOld];
