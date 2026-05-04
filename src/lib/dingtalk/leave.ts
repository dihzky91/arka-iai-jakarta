import { dingtalkPost } from "./client";

const JENIS_CUTI_MAP: Record<string, string> = {
  tahunan: "年假",
  sakit: "病假",
  melahirkan: "产假",
  menikah: "婚假",
  kematian: "丧假",
  lainnya: "其他",
};

export interface LeaveFormData {
  jenisCuti: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: number;
  alasan?: string;
}

interface DingtalkLeaveResponse {
  processInstanceId: string;
}

export interface LeaveStatusResponse {
  processInstanceId: string;
  status: "running" | "completed" | "terminated";
  result: "agree" | "refuse" | "none";
  originatorUserId: string;
  originatorUserName?: string;
  title?: string;
  formComponentValues?: { name: string; value: string }[];
  createTime?: string;
  finishTime?: string;
}

function formatDtkDatetime(dateStr: string, isStart: boolean): string {
  const time = isStart ? "09:00" : "18:00";
  return `${dateStr} ${time}`;
}

export async function submitLeaveRequest(
  userId: string,
  formData: LeaveFormData,
): Promise<string> {
  const jenisLabel = JENIS_CUTI_MAP[formData.jenisCuti] ?? formData.jenisCuti;

  const formComponentValues = [
    { name: "请假类型", value: jenisLabel },
    {
      name: "开始时间",
      value: formatDtkDatetime(formData.tanggalMulai, true),
    },
    {
      name: "结束时间",
      value: formatDtkDatetime(formData.tanggalSelesai, false),
    },
    { name: "请假时长", value: `${formData.jumlahHari}天` },
    { name: "请假事由", value: formData.alasan ?? "-" },
  ];

  const res = await dingtalkPost<DingtalkLeaveResponse>(
    "/v1.0/attendance/approvals/create",
    {
      originatorUserId: userId,
      formComponentValues,
    },
  );

  return res.processInstanceId;
}

export async function getLeaveStatus(
  processInstanceId: string,
): Promise<LeaveStatusResponse> {
  return dingtalkPost<LeaveStatusResponse>(
    `/v1.0/attendance/approvals/${processInstanceId}`,
    {},
  );
}

export async function getLeaveRecords(
  userIds: string[],
  dateFrom: string,
  dateTo: string,
): Promise<LeaveStatusResponse[]> {
  const BATCH_SIZE = 50;
  const results: LeaveStatusResponse[] = [];

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);

    const res = await dingtalkPost<{ list: LeaveStatusResponse[] }>(
      "/v1.0/attendance/approvals/processinstances",
      {
        userIdList: batch,
        startTime: dateFrom + " 00:00:00",
        endTime: dateTo + " 23:59:59",
        processType: "leave",
      },
    );

    results.push(...(res.list ?? []));
  }

  return results;
}
