import type { KelasHonorariumWhatsappSnapshot } from "@/server/actions/jadwal-otomatis/kelasOtomatis";
import type { WhatsappTemplateKey } from "@/server/actions/jadwal-otomatis/whatsapp";
import { APP_TIME_ZONE, parseIsoDateInJakarta } from "@/lib/utils";

export interface KelasDetail {
  id: string;
  namaKelas: string;
  programId: string;
  programName: string;
  programCode: string;
  classTypeId: string;
  classTypeName: string;
  mode: string;
  startDate: string;
  endDate: string | null;
  lokasi: string | null;
  financeContactNameOverride?: string | null;
  financeWhatsappNumberOverride?: string | null;
  financeContactName?: string | null;
  financeWhatsappNumber?: string | null;
  financeContactSource?: string | null;
  status: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  kelasId: string;
  sessionNumber: number | null;
  isExamDay: boolean;
  examSubjects: string[] | null;
  scheduledDate: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  materiName: string | null;
  status: string;
}

export interface Assignment {
  assignmentId: string;
  sessionId: string;
  sessionNumber: number | null;
  scheduledDate: string;
  materiName: string | null;
  isExamDay: boolean;
  plannedInstructorId: string;
  plannedInstructorName: string;
  actualInstructorId: string | null;
  substitutionReason: string | null;
  availabilityStatus: string;
  availabilityCheckedAt: Date | null;
  availabilityNote: string | null;
}

export interface Instructor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  expertiseCount: number;
  weeklySessions: number;
  monthlySessions: number;
  activeClassCount: number;
  createdAt: Date;
}

export interface JadwalDetailProps {
  kelas: KelasDetail;
  sessions: Session[];
  assignments: Assignment[];
  instructors: Instructor[];
  materiBlocks: string[];
  canManage: boolean;
  honorariumSnapshot: KelasHonorariumWhatsappSnapshot | null;
  whatsappTemplates: Array<{
    templateKey: WhatsappTemplateKey;
    templateName: string;
    content: string;
  }>;
  whatsappLogs: Array<{
    id: string;
    templateKey: string;
    recipientRole: string;
    recipientName: string | null;
    recipientWhatsappNumber: string | null;
    messageContent: string;
    metadata: unknown;
    sentAt: Date;
    sentByName: string | null;
  }>;
  mode?: "informasi" | "jadwal" | "instruktur" | "full";
}

export const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  scheduled: "default",
  completed: "secondary",
  cancelled: "destructive",
  makeup: "outline",
};

export type AvailabilityStatus = "pending_wa_confirmation" | "accepted" | "rejected" | "no_response";
export type BulkSessionStatus = "scheduled" | "completed";

export const availabilityStatusLabels: Record<AvailabilityStatus, string> = {
  pending_wa_confirmation: "Menunggu WA",
  accepted: "Diterima",
  rejected: "Ditolak",
  no_response: "No Response",
};

export const availabilityStatusBadgeVariant: Record<
  AvailabilityStatus,
  "outline" | "default" | "destructive" | "secondary"
> = {
  pending_wa_confirmation: "outline",
  accepted: "default",
  rejected: "destructive",
  no_response: "secondary",
};

export function formatDate(dateStr: string) {
  const date = parseIsoDateInJakarta(dateStr);
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE,
  });
}

export function getDayName(dateStr: string) {
  return parseIsoDateInJakarta(dateStr).toLocaleDateString("id-ID", {
    weekday: "long",
    timeZone: APP_TIME_ZONE,
  });
}

export function toAvailabilityStatus(value: string): AvailabilityStatus {
  if (value === "accepted" || value === "rejected" || value === "no_response") return value;
  return "pending_wa_confirmation";
}

export function toExpertiseLabel(level: string) {
  if (level === "basic") return "Basic";
  if (level === "middle" || level === "intermediate") return "Middle";
  if (level === "senior" || level === "expert") return "Senior";
  return "Middle";
}
