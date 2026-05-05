import { getAccessToken } from "./auth";
import { addDaysToIsoDate } from "@/lib/utils";

const BATCH_USER_SIZE = 50;
const MAX_DATE_RANGE_DAYS = 7;
// Old API limit: 50 records per call
const OLD_API_RECORD_LIMIT = 50;

// attendance/list response fields differ from deprecated getattrecords:
// checkTime (not userCheckTime), baseCheckTime (not planCheckTime)
interface OldApiAttendanceRecord {
  id?: string;
  recordId?: string;
  userId: string;
  workDate: string;
  checkType: "OnDuty" | "OffDuty";
  // attendance/list uses baseCheckTime; fallback for older field name
  baseCheckTime?: string;
  planCheckTime?: string;
  // attendance/list uses checkTime; fallback for older field name
  checkTime?: string;
  userCheckTime?: string;
  locationResult: string;
  sourceType?: string;
}

interface OldApiAttendanceResponse {
  errcode: number;
  errmsg: string;
  recordresult?: OldApiAttendanceRecord[];
}

export interface NormalizedAttendance {
  userId: string;
  tanggal: string;
  jamMasuk: string | null;
  jamPulang: string | null;
  status: "hadir" | "terlambat" | "alpha";
  keterlambatanMenit: number;
  dingtalkRecordId: string;
}

function parseAttendanceStatus(
  jamMasuk: string | null,
  planMasuk: string | null,
): "hadir" | "terlambat" | "alpha" {
  if (!jamMasuk) return "alpha";
  if (!planMasuk) return "hadir";
  const actual = new Date(jamMasuk).getTime();
  const plan = new Date(planMasuk).getTime();
  return actual > plan ? "terlambat" : "hadir";
}

function lateMins(actual: string, plan: string): number {
  const diffMs = new Date(actual).getTime() - new Date(plan).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

function splitIntoBatches<T>(arr: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}

function splitDateRange(
  start: string,
  end: string,
  maxDays: number,
): { from: string; to: string }[] {
  const ranges: { from: string; to: string }[] = [];

  let current = start;
  while (current <= end) {
    const chunkEnd = addDaysToIsoDate(current, maxDays - 1);
    const to = chunkEnd > end ? end : chunkEnd;
    ranges.push({
      from: `${current} 00:00:00`,
      to: `${to} 23:59:59`,
    });
    current = addDaysToIsoDate(current, maxDays);
  }

  return ranges;
}

// Old API: POST https://oapi.dingtalk.com/attendance/list
// Returns recordresult[] with OnDuty/OffDuty per user per day.
// Limit 50 per call, paginate by offset. Stop when records < limit.
async function fetchOldApiAttendance(
  token: string,
  userIds: string[],
  from: string,
  to: string,
): Promise<OldApiAttendanceRecord[]> {
  const all: OldApiAttendanceRecord[] = [];
  let offset = 0;

  while (true) {
    const url = `https://oapi.dingtalk.com/attendance/list?access_token=${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workDateFrom: from,
        workDateTo: to,
        userIdList: userIds,
        offset,
        limit: OLD_API_RECORD_LIMIT,
      }),
    });

    const data = (await res.json()) as OldApiAttendanceResponse;

    if (data.errcode !== 0) {
      throw new Error(`DingTalk attendance API error: ${data.errmsg}`);
    }

    const records = data.recordresult ?? [];
    all.push(...records);

    if (records.length < OLD_API_RECORD_LIMIT) break;
    offset += OLD_API_RECORD_LIMIT;
  }

  return all;
}

export async function getAttendanceRecords(
  userIds: string[],
  dateFrom: string,
  dateTo: string,
): Promise<NormalizedAttendance[]> {
  const token = await getAccessToken();
  const userBatches = splitIntoBatches(userIds, BATCH_USER_SIZE);
  const dateRanges = splitDateRange(dateFrom, dateTo, MAX_DATE_RANGE_DAYS);

  const results: NormalizedAttendance[] = [];

  for (const userBatch of userBatches) {
    for (const range of dateRanges) {
      const records = await fetchOldApiAttendance(token, userBatch, range.from, range.to);

      const grouped = new Map<
        string,
        { onDuty?: OldApiAttendanceRecord; offDuty?: OldApiAttendanceRecord }
      >();

      for (const record of records) {
        const key = `${record.userId}:${record.workDate}`;
        if (!grouped.has(key)) {
          grouped.set(key, {});
        }
        const entry = grouped.get(key)!;
        if (record.checkType === "OnDuty") {
          entry.onDuty = record;
        } else {
          entry.offDuty = record;
        }
      }

      for (const [, recs] of grouped) {
        const onDuty = recs.onDuty;
        const offDuty = recs.offDuty;
        // attendance/list: checkTime + baseCheckTime; fallback to old field names
        const jamMasuk = onDuty?.checkTime ?? onDuty?.userCheckTime ?? null;
        const planMasuk = onDuty?.baseCheckTime ?? onDuty?.planCheckTime ?? null;
        const jamPulang = offDuty?.checkTime ?? offDuty?.userCheckTime ?? null;

        results.push({
          userId: onDuty?.userId ?? offDuty?.userId ?? "",
          tanggal: onDuty?.workDate ?? offDuty?.workDate ?? "",
          jamMasuk,
          jamPulang,
          status: parseAttendanceStatus(jamMasuk, planMasuk),
          keterlambatanMenit:
            jamMasuk && planMasuk ? lateMins(jamMasuk, planMasuk) : 0,
          dingtalkRecordId: onDuty?.id ?? onDuty?.recordId ?? offDuty?.id ?? offDuty?.recordId ?? "",
        });
      }
    }
  }

  return results;
}

export async function getAttendanceReport(
  userIds: string[],
  startDate: string,
  endDate: string,
): Promise<OldApiAttendanceRecord[]> {
  const token = await getAccessToken();
  const userBatches = splitIntoBatches(userIds, BATCH_USER_SIZE);
  const results: OldApiAttendanceRecord[] = [];

  for (const batch of userBatches) {
    const records = await fetchOldApiAttendance(token, batch, startDate + " 00:00:00", endDate + " 23:59:59");
    results.push(...records);
  }

  return results;
}
