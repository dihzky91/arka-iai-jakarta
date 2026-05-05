import { getOldApiToken } from "./auth";
import { addDaysToIsoDate } from "@/lib/utils";

const BATCH_USER_SIZE = 50;
const MAX_DATE_RANGE_DAYS = 7;
// Old API limit: 50 records per call
const OLD_API_RECORD_LIMIT = 50;

// attendance/list response fields differ from deprecated getattrecords:
// checkTime (not userCheckTime), baseCheckTime (not planCheckTime)
interface OldApiAttendanceRecord {
  id?: string | number;
  recordId?: string | number;
  userId: string;
  workDate: string | number;
  checkType: "OnDuty" | "OffDuty";
  // attendance/list uses baseCheckTime; fallback for older field name
  baseCheckTime?: string | number | null;
  planCheckTime?: string | number | null;
  // attendance/list uses checkTime; fallback for older field name
  checkTime?: string | number | null;
  userCheckTime?: string | number | null;
  locationResult?: string;
  timeResult?: string;
  sourceType?: string;
}

interface OldApiAttendanceResponse {
  errcode: number;
  errmsg: string;
  recordresult?: OldApiAttendanceRecord[];
}

interface UpdatedDataAttendanceResult {
  record_id?: string | number;
  user_check_time?: string | number | null;
  plan_check_time?: string | number | null;
  check_type?: "OnDuty" | "OffDuty";
  location_result?: string;
  time_result?: string;
  source_type?: string;
}

interface UpdatedDataAttendanceResponse {
  errcode: number;
  errmsg?: string;
  success?: boolean;
  result?: {
    userid?: string;
    work_date?: string;
    attendance_result_list?: UpdatedDataAttendanceResult[];
  };
}

interface SmartReportColumn {
  id?: string | number;
  alias?: string;
  name?: string;
  status?: number;
  sub_type?: number;
  type?: number;
}

interface SmartReportColumnsResponse {
  errcode: number;
  errmsg?: string;
  result?: {
    columns?: SmartReportColumn[];
  };
}

export interface NormalizedAttendance {
  userId: string;
  tanggal: string;
  jamMasuk: string | null;
  jamPulang: string | null;
  status: "hadir" | "terlambat" | "alpha";
  keterlambatanMenit: number;
  dingtalkRecordId: string;
  catatan: string | null;
}

export type AttendanceRecordsDiagnostics = {
  source: "attendance/list" | "getupdatedata" | "none";
  primaryRawRecords: number;
  primaryNormalizedRecords: number;
  fallbackRawRecords: number;
  fallbackNormalizedRecords: number;
  smartReportColumnCount: number;
  smartReportCandidateColumns: Array<{
    id: string;
    alias: string | null;
    name: string | null;
  }>;
  errors: string[];
};

function parseAttendanceStatus(
  jamMasuk: string | null,
  planMasuk: string | null,
  onDuty?: OldApiAttendanceRecord,
): "hadir" | "terlambat" | "alpha" {
  const timeResult = (onDuty?.timeResult ?? "").toLowerCase();
  if (
    timeResult.includes("notsigned") ||
    timeResult.includes("not signed") ||
    timeResult.includes("missing") ||
    timeResult.includes("absenteeism")
  ) {
    return "alpha";
  }
  if (!jamMasuk) return "alpha";
  if (timeResult.includes("late")) return "terlambat";
  if (!planMasuk) return "hadir";
  const actual = new Date(jamMasuk).getTime();
  const plan = new Date(planMasuk).getTime();
  return actual > plan ? "terlambat" : "hadir";
}

function lateMins(actual: string, plan: string): number {
  const diffMs = new Date(actual).getTime() - new Date(plan).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

function jakartaIsoDateFromDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

function parseDingtalkDateTime(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? new Date(value).toISOString() : null;
  }

  const text = value.trim();
  if (!text) return null;

  if (/^\d{10,}$/.test(text)) {
    const timestamp = Number(text);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  }

  const localMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (localMatch) {
    const [, y, m, d, h, min, s] = localMatch;
    const date = new Date(
      Date.UTC(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(h) - 7,
        Number(min),
        Number(s ?? "0"),
      ),
    );
    return date.toISOString();
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeWorkDate(
  value: string | number,
  fallbackTime?: string | null,
): string {
  if (typeof value === "number") {
    return jakartaIsoDateFromDate(new Date(value));
  }

  const text = value.trim();
  if (/^\d{10,}$/.test(text)) {
    return jakartaIsoDateFromDate(new Date(Number(text)));
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const short = text.match(/^(\d{2})-(\d{2})-(\d{2})/);
  if (short) return `20${short[1]}-${short[2]}-${short[3]}`;

  if (fallbackTime) {
    return jakartaIsoDateFromDate(new Date(fallbackTime));
  }

  return text;
}

function getActualTime(record: OldApiAttendanceRecord | undefined): string | null {
  return parseDingtalkDateTime(record?.checkTime ?? record?.userCheckTime);
}

function getPlanTime(record: OldApiAttendanceRecord | undefined): string | null {
  return parseDingtalkDateTime(record?.baseCheckTime ?? record?.planCheckTime);
}

function shouldUseOnDuty(
  current: OldApiAttendanceRecord | undefined,
  candidate: OldApiAttendanceRecord,
): boolean {
  if (!current) return true;
  const currentTime = getActualTime(current);
  const candidateTime = getActualTime(candidate);
  if (!currentTime) return !!candidateTime;
  if (!candidateTime) return false;
  return new Date(candidateTime).getTime() < new Date(currentTime).getTime();
}

function shouldUseOffDuty(
  current: OldApiAttendanceRecord | undefined,
  candidate: OldApiAttendanceRecord,
): boolean {
  if (!current) return true;
  const currentTime = getActualTime(current);
  const candidateTime = getActualTime(candidate);
  if (!currentTime) return !!candidateTime;
  if (!candidateTime) return false;
  return new Date(candidateTime).getTime() > new Date(currentTime).getTime();
}

function formatResultLabel(record: OldApiAttendanceRecord | undefined): string | null {
  if (!record) return null;
  const parts = [record.timeResult, record.locationResult]
    .filter((value): value is string => !!value && value !== "Normal");
  return parts.length > 0 ? parts.join("/") : null;
}

function buildCatatan(
  onDuty: OldApiAttendanceRecord | undefined,
  offDuty: OldApiAttendanceRecord | undefined,
): string | null {
  const notes = [
    formatResultLabel(onDuty) ? `Clock-in ${formatResultLabel(onDuty)}` : null,
    formatResultLabel(offDuty) ? `Clock-out ${formatResultLabel(offDuty)}` : null,
  ].filter((value): value is string => !!value);
  return notes.length > 0 ? notes.join("; ") : null;
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
        isI18n: false,
      }),
    });

    const data = (await res.json()) as OldApiAttendanceResponse;

    console.log("[DingTalk attendance/list]", { errcode: data.errcode, errmsg: data.errmsg, recordCount: data.recordresult?.length ?? 0, from, to, userIds, rawResponse: JSON.stringify(data).slice(0, 500) });

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

async function fetchUpdatedDataAttendance(
  token: string,
  userId: string,
  workDate: string,
): Promise<OldApiAttendanceRecord[]> {
  const url = `https://oapi.dingtalk.com/topapi/attendance/getupdatedata?access_token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userid: userId,
      work_date: `${workDate} 00:00:00`,
    }),
  });

  const data = (await res.json()) as UpdatedDataAttendanceResponse;

  console.log("[DingTalk getupdatedata]", { userId, workDate, errcode: data.errcode, errmsg: data.errmsg, raw: JSON.stringify(data).slice(0, 500) });

  if (data.errcode !== 0) {
    throw new Error(`DingTalk attendance updatedata API error: ${data.errmsg ?? data.errcode}`);
  }

  return (data.result?.attendance_result_list ?? [])
    .filter((record) => record.check_type === "OnDuty" || record.check_type === "OffDuty")
    .map((record) => ({
      id: record.record_id,
      recordId: record.record_id,
      userId,
      workDate: normalizeWorkDate(data.result?.work_date ?? workDate),
      checkType: record.check_type!,
      baseCheckTime: record.plan_check_time,
      planCheckTime: record.plan_check_time,
      checkTime: record.user_check_time,
      userCheckTime: record.user_check_time,
      locationResult: record.location_result,
      timeResult: record.time_result,
      sourceType: record.source_type,
    }));
}

async function fetchUpdatedDataAttendanceRange(
  token: string,
  userIds: string[],
  dateFrom: string,
  dateTo: string,
): Promise<OldApiAttendanceRecord[]> {
  const records: OldApiAttendanceRecord[] = [];

  for (const userId of userIds) {
    let current = dateFrom;
    while (current <= dateTo) {
      records.push(...await fetchUpdatedDataAttendance(token, userId, current));
      current = addDaysToIsoDate(current, 1);
    }
  }

  return records;
}

async function fetchSmartReportColumns(token: string): Promise<SmartReportColumn[]> {
  const url = `https://oapi.dingtalk.com/topapi/attendance/getattcolumns?access_token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json()) as SmartReportColumnsResponse;

  if (data.errcode !== 0) {
    throw new Error(`DingTalk attendance report columns API error: ${data.errmsg ?? data.errcode}`);
  }

  return data.result?.columns ?? [];
}

function isAttendanceReportCandidate(column: SmartReportColumn): boolean {
  const text = `${column.alias ?? ""} ${column.name ?? ""}`.toLowerCase();
  return [
    "attendance",
    "check",
    "clock",
    "late",
    "early",
    "absence",
    "absenteeism",
    "lack",
    "missing",
    "work",
    "打卡",
    "考勤",
    "迟到",
    "早退",
    "缺卡",
    "缺勤",
    "旷工",
    "出勤",
    "休息",
    "班次",
    "工时",
  ].some((keyword) => text.includes(keyword));
}

function formatSmartReportColumn(column: SmartReportColumn) {
  return {
    id: String(column.id ?? ""),
    alias: column.alias ?? null,
    name: column.name ?? null,
  };
}

function normalizeAttendanceRecords(records: OldApiAttendanceRecord[]): NormalizedAttendance[] {
  const results: NormalizedAttendance[] = [];
  const grouped = new Map<
    string,
    { onDuty?: OldApiAttendanceRecord; offDuty?: OldApiAttendanceRecord }
  >();

  for (const record of records) {
    const actualTime = parseDingtalkDateTime(record.checkTime ?? record.userCheckTime);
    const key = `${record.userId}:${normalizeWorkDate(record.workDate, actualTime)}`;
    if (!grouped.has(key)) {
      grouped.set(key, {});
    }
    const entry = grouped.get(key)!;
    if (record.checkType === "OnDuty") {
      if (shouldUseOnDuty(entry.onDuty, record)) entry.onDuty = record;
    } else if (record.checkType === "OffDuty") {
      if (shouldUseOffDuty(entry.offDuty, record)) entry.offDuty = record;
    }
  }

  for (const [, recs] of grouped) {
    const onDuty = recs.onDuty;
    const offDuty = recs.offDuty;
    const jamMasuk = getActualTime(onDuty);
    const planMasuk = getPlanTime(onDuty);
    const jamPulang = getActualTime(offDuty);
    const tanggal = normalizeWorkDate(
      onDuty?.workDate ?? offDuty?.workDate ?? "",
      jamMasuk ?? jamPulang,
    );

    results.push({
      userId: onDuty?.userId ?? offDuty?.userId ?? "",
      tanggal,
      jamMasuk,
      jamPulang,
      status: parseAttendanceStatus(jamMasuk, planMasuk, onDuty),
      keterlambatanMenit:
        jamMasuk && planMasuk ? lateMins(jamMasuk, planMasuk) : 0,
      dingtalkRecordId: String(onDuty?.id ?? onDuty?.recordId ?? offDuty?.id ?? offDuty?.recordId ?? ""),
      catatan: buildCatatan(onDuty, offDuty),
    });
  }

  return results;
}

export async function getAttendanceRecords(
  userIds: string[],
  dateFrom: string,
  dateTo: string,
): Promise<NormalizedAttendance[]> {
  const result = await getAttendanceRecordsWithDiagnostics(userIds, dateFrom, dateTo);
  return result.records;
}

export async function getAttendanceRecordsWithDiagnostics(
  userIds: string[],
  dateFrom: string,
  dateTo: string,
): Promise<{
  records: NormalizedAttendance[];
  diagnostics: AttendanceRecordsDiagnostics;
}> {
  const token = await getOldApiToken();
  const userBatches = splitIntoBatches(userIds, BATCH_USER_SIZE);
  const dateRanges = splitDateRange(dateFrom, dateTo, MAX_DATE_RANGE_DAYS);

  const errors: string[] = [];
  const rawRecords: OldApiAttendanceRecord[] = [];

  try {
    for (const userBatch of userBatches) {
      for (const range of dateRanges) {
        const records = await fetchOldApiAttendance(token, userBatch, range.from, range.to);
        rawRecords.push(...records);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const primaryResults = normalizeAttendanceRecords(rawRecords);

  if (primaryResults.length > 0) {
    return {
      records: primaryResults,
      diagnostics: {
        source: "attendance/list",
        primaryRawRecords: rawRecords.length,
        primaryNormalizedRecords: primaryResults.length,
        fallbackRawRecords: 0,
        fallbackNormalizedRecords: 0,
        smartReportColumnCount: 0,
        smartReportCandidateColumns: [],
        errors,
      },
    };
  }

  let updatedDataRecords: OldApiAttendanceRecord[] = [];
  try {
    updatedDataRecords = await fetchUpdatedDataAttendanceRange(
      token,
      userIds,
      dateFrom,
      dateTo,
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const fallbackResults = normalizeAttendanceRecords(updatedDataRecords);
  let smartReportColumnCount = 0;
  let smartReportCandidateColumns: AttendanceRecordsDiagnostics["smartReportCandidateColumns"] = [];

  if (fallbackResults.length === 0) {
    try {
      const columns = await fetchSmartReportColumns(token);
      smartReportColumnCount = columns.length;
      smartReportCandidateColumns = columns
        .filter(isAttendanceReportCandidate)
        .slice(0, 80)
        .map(formatSmartReportColumn);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    records: fallbackResults,
    diagnostics: {
      source: fallbackResults.length > 0 ? "getupdatedata" : "none",
      primaryRawRecords: rawRecords.length,
      primaryNormalizedRecords: primaryResults.length,
      fallbackRawRecords: updatedDataRecords.length,
      fallbackNormalizedRecords: fallbackResults.length,
      smartReportColumnCount,
      smartReportCandidateColumns,
      errors,
    },
  };
}

export async function getAttendanceReport(
  userIds: string[],
  startDate: string,
  endDate: string,
): Promise<OldApiAttendanceRecord[]> {
  const token = await getOldApiToken();
  const userBatches = splitIntoBatches(userIds, BATCH_USER_SIZE);
  const results: OldApiAttendanceRecord[] = [];

  for (const batch of userBatches) {
    const records = await fetchOldApiAttendance(token, batch, startDate + " 00:00:00", endDate + " 23:59:59");
    results.push(...records);
  }

  return results;
}
