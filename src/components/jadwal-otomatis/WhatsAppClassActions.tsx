"use client";

import { useMemo, useState, useTransition } from "react";
import { CircleCheckBig, MessageCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { APP_TIME_ZONE, parseIsoDateInJakarta } from "@/lib/utils";
import {
  createWhatsappMessageLog,
  sendWhatsappViaBot,
  type WhatsappTemplateKey,
} from "@/server/actions/jadwal-otomatis/whatsapp";
import {
  updateKelasFinanceContactOverride,
  type KelasHonorariumWhatsappSnapshot,
} from "@/server/actions/jadwal-otomatis/kelasOtomatis";

type SessionRow = {
  id: string;
  sessionNumber: number | null;
  isExamDay: boolean;
  scheduledDate: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  materiName: string | null;
};

type AssignmentRow = {
  sessionId: string;
  plannedInstructorId: string;
  plannedInstructorName: string;
  actualInstructorId: string | null;
};

type InstructorRow = {
  id: string;
  name: string;
  phone: string | null;
};

type KelasWhatsappData = {
  id: string;
  namaKelas: string;
  programName: string;
  mode: string;
  lokasi: string | null;
  startDate: string;
  endDate: string | null;
  financeContactNameOverride?: string | null;
  financeWhatsappNumberOverride?: string | null;
  financeContactName?: string | null;
  financeWhatsappNumber?: string | null;
  financeContactSource?: string | null;
};

type WhatsappLogRow = {
  id: string;
  templateKey: string;
  recipientRole: string;
  recipientName: string | null;
  recipientWhatsappNumber: string | null;
  messageContent: string;
  metadata: unknown;
  sentAt: Date;
  sentByName: string | null;
};

type PreviewPayload = {
  title: string;
  description: string;
  message: string;
  waLink: string | null;
  templateKey: WhatsappTemplateKey;
  recipientRole: "instructor" | "finance";
  recipientName: string;
  recipientWhatsappNumber: string | null;
  metadata?: Record<string, unknown>;
};

interface WhatsAppClassActionsProps {
  kelas: KelasWhatsappData;
  sessions: SessionRow[];
  assignments: AssignmentRow[];
  instructors: InstructorRow[];
  honorariumSnapshot: KelasHonorariumWhatsappSnapshot | null;
  templates: Array<{
    templateKey: WhatsappTemplateKey;
    templateName: string;
    content: string;
  }>;
  logs: WhatsappLogRow[];
  canManage: boolean;
  whatsappBotEnabled: boolean;
}

const TEMPLATE_FALLBACK: Record<WhatsappTemplateKey, string> = {
  offer_schedule_instructor:
    "Yth. Bapak/Ibu {{nama_instruktur}},\n\nKami menawarkan jadwal mengajar untuk kelas {{nama_kelas}} ({{nama_program}}).\nPeriode kelas: {{periode_kelas}}.\n{{lokasi_info}}\n\nRingkasan jadwal:\n{{ringkasan_jadwal}}\n\nMohon konfirmasi ketersediaan. Terima kasih.",
  finance_honorarium_reminder:
    "Yth. {{nama_kontak_keuangan}},\n\nReminder pengajuan honorarium untuk kelas {{nama_kelas}} ({{nama_program}}).\nPeriode kelas: {{periode_kelas}}.\nTotal sesi pelatihan: {{total_sesi}} sesi.\nEstimasi honor: {{estimasi_honor}}.\n\nMohon diproses sesuai SOP. Terima kasih.",
  honor_transferred_instructor:
    "Yth. Bapak/Ibu {{nama_instruktur}},\n\nKami informasikan honor mengajar kelas {{nama_kelas}} ({{nama_program}}) sudah ditransfer.\nNominal: {{nominal_honor}}.\nReferensi batch: {{referensi_batch}}.\nTanggal bayar: {{tanggal_bayar}}.\n\nTerima kasih atas kontribusinya.",
};

function formatDateLong(dateStr: string) {
  return parseIsoDateInJakarta(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizePhoneForWa(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function renderTemplate(
  content: string,
  replacements: Record<string, string>,
) {
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return replacements[key] ?? "";
  });
}

export function WhatsAppClassActions({
  kelas,
  sessions,
  assignments,
  instructors,
  honorariumSnapshot,
  templates,
  logs,
  canManage,
  whatsappBotEnabled,
}: WhatsAppClassActionsProps) {
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [saveFinancePending, startSaveFinance] = useTransition();
  const [sendPending, startSend] = useTransition();
  const [sendDirectPending, startSendDirect] = useTransition();
  const [financeContactNameDraft, setFinanceContactNameDraft] = useState(
    kelas.financeContactNameOverride ?? "",
  );
  const [financeWhatsappDraft, setFinanceWhatsappDraft] = useState(
    kelas.financeWhatsappNumberOverride ?? "",
  );

  const templateMap = useMemo(() => {
    const map = new Map<WhatsappTemplateKey, string>();
    templates.forEach((template) => {
      map.set(template.templateKey, template.content);
    });
    return map;
  }, [templates]);

  const assignmentsBySession = useMemo(() => {
    const map = new Map<string, AssignmentRow>();
    assignments.forEach((assignment) => {
      map.set(assignment.sessionId, assignment);
    });
    return map;
  }, [assignments]);

  const instructorById = useMemo(
    () => new Map(instructors.map((instructor) => [instructor.id, instructor])),
    [instructors],
  );

  const instructorOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string | null }>();
    assignments.forEach((assignment) => {
      const instructorId = assignment.actualInstructorId || assignment.plannedInstructorId;
      const instructorName = assignment.actualInstructorId
        ? instructorById.get(assignment.actualInstructorId)?.name ??
          assignment.plannedInstructorName
        : assignment.plannedInstructorName;
      const instructorPhone =
        instructorById.get(instructorId)?.phone ??
        instructorById.get(assignment.plannedInstructorId)?.phone ??
        null;
      if (!map.has(instructorId)) {
        map.set(instructorId, {
          id: instructorId,
          name: instructorName,
          phone: instructorPhone,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments, instructorById]);

  const sessionCount = useMemo(
    () => sessions.filter((session) => !session.isExamDay).length,
    [sessions],
  );

  const periodKelas = `${formatDateLong(kelas.startDate)}${
    kelas.endDate ? ` s.d. ${formatDateLong(kelas.endDate)}` : ""
  }`;

  function getTemplateContent(key: WhatsappTemplateKey) {
    return templateMap.get(key) ?? TEMPLATE_FALLBACK[key];
  }

  function openPreview(payload: PreviewPayload) {
    setPreview(payload);
    setDialogOpen(true);
  }

  function handleOfferSchedule() {
    const instructor = instructorOptions.find((option) => option.id === selectedInstructorId);
    if (!instructor) return;

    const rows = sessions
      .filter((session) => {
        const assignment = assignmentsBySession.get(session.id);
        if (!assignment) return false;
        const assignedInstructorId =
          assignment.actualInstructorId || assignment.plannedInstructorId;
        return assignedInstructorId === instructor.id;
      })
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

    const ringkasanJadwal =
      rows.slice(0, 6).map((row) => {
        const materi = row.materiName ? ` - ${row.materiName}` : "";
        return `- ${formatDateLong(row.scheduledDate)} (${row.timeSlotStart}-${row.timeSlotEnd})${materi}`;
      }).join("\n") || "- Jadwal akan kami kirimkan terpisah.";

    let lokasiInfo = "";
    if (kelas.mode === "online") {
      lokasiInfo = "Pelaksanaan secara online menggunakan platform Ms Teams.";
    } else if (kelas.lokasi) {
      lokasiInfo = `Lokasi: ${kelas.lokasi}.`;
    }

    const message = renderTemplate(getTemplateContent("offer_schedule_instructor"), {
      nama_instruktur: instructor.name,
      nama_kelas: kelas.namaKelas,
      nama_program: kelas.programName,
      periode_kelas: periodKelas,
      ringkasan_jadwal: ringkasanJadwal,
      lokasi_info: lokasiInfo,
    });

    const normalizedPhone = normalizePhoneForWa(instructor.phone);
    openPreview({
      title: "Preview WA: Tawarkan Jadwal",
      description: `Pesan ke ${instructor.name}`,
      message,
      waLink: normalizedPhone
        ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
        : null,
      templateKey: "offer_schedule_instructor",
      recipientRole: "instructor",
      recipientName: instructor.name,
      recipientWhatsappNumber: instructor.phone,
      metadata: {
        instructorId: instructor.id,
        sessionCount: rows.length,
      },
    });
  }

  function handleFinanceReminder() {
    const sourceLabel =
      kelas.financeContactSource === "kelas_override"
        ? "override kelas"
        : kelas.financeContactSource === "global_default"
          ? "default global"
          : "belum terkonfigurasi";

    const message = renderTemplate(getTemplateContent("finance_honorarium_reminder"), {
      nama_kontak_keuangan: kelas.financeContactName || "Tim Keuangan",
      nama_kelas: kelas.namaKelas,
      nama_program: kelas.programName,
      periode_kelas: periodKelas,
      total_sesi: String(sessionCount),
      estimasi_honor: honorariumSnapshot
        ? formatCurrency(honorariumSnapshot.totalAmount)
        : "mohon dicek pada modul honorarium",
      sumber_kontak: sourceLabel,
    });

    const normalizedPhone = normalizePhoneForWa(kelas.financeWhatsappNumber);
    openPreview({
      title: "Preview WA: Reminder Keuangan",
      description: `Pesan ke ${kelas.financeContactName || "Tim Keuangan"}`,
      message,
      waLink: normalizedPhone
        ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
        : null,
      templateKey: "finance_honorarium_reminder",
      recipientRole: "finance",
      recipientName: kelas.financeContactName || "Tim Keuangan",
      recipientWhatsappNumber: kelas.financeWhatsappNumber || null,
      metadata: {
        source: sourceLabel,
        honorariumBatch: honorariumSnapshot?.documentNumber ?? null,
      },
    });
  }

  function handleHonorTransferred() {
    const instructor = instructorOptions.find((option) => option.id === selectedInstructorId);
    if (!instructor) return;

    const honorRow = honorariumSnapshot?.perInstructor.find(
      (row) => row.instructorId === instructor.id,
    );
    const message = renderTemplate(getTemplateContent("honor_transferred_instructor"), {
      nama_instruktur: instructor.name,
      nama_kelas: kelas.namaKelas,
      nama_program: kelas.programName,
      nominal_honor: honorRow
        ? formatCurrency(honorRow.amount)
        : "silakan cek pada bukti pembayaran",
      referensi_batch: honorariumSnapshot
        ? `${honorariumSnapshot.documentNumber} (${honorariumSnapshot.status})`
        : "belum tersedia",
      tanggal_bayar: honorariumSnapshot?.paidAt
        ? new Date(honorariumSnapshot.paidAt).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            timeZone: APP_TIME_ZONE,
          })
        : "-",
    });

    const normalizedPhone = normalizePhoneForWa(instructor.phone);
    openPreview({
      title: "Preview WA: Info Honor Ditransfer",
      description: `Pesan ke ${instructor.name}`,
      message,
      waLink: normalizedPhone
        ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
        : null,
      templateKey: "honor_transferred_instructor",
      recipientRole: "instructor",
      recipientName: instructor.name,
      recipientWhatsappNumber: instructor.phone,
      metadata: {
        instructorId: instructor.id,
        honorAmount: honorRow?.amount ?? null,
        honorariumBatch: honorariumSnapshot?.documentNumber ?? null,
      },
    });
  }

  function handleSaveFinanceOverride() {
    startSaveFinance(async () => {
      const result = await updateKelasFinanceContactOverride({
        id: kelas.id,
        financeContactNameOverride: financeContactNameDraft,
        financeWhatsappNumberOverride: financeWhatsappDraft,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal menyimpan override kontak keuangan.");
        return;
      }
      toast.success("Override kontak keuangan kelas berhasil disimpan.");
    });
  }

  function handleSendWhatsapp() {
    if (!preview || !preview.waLink) return;

    startSend(async () => {
      const logResult = await createWhatsappMessageLog({
        kelasId: kelas.id,
        templateKey: preview.templateKey,
        recipientRole: preview.recipientRole,
        recipientName: preview.recipientName,
        recipientWhatsappNumber: preview.recipientWhatsappNumber,
        messageContent: preview.message,
        metadata: preview.metadata ?? {},
      });

      if (!logResult.ok) {
        toast.error(logResult.error ?? "Gagal menyimpan log pesan WhatsApp.");
      }

      window.open(preview.waLink!, "_blank", "noopener,noreferrer");
      setDialogOpen(false);
      toast.success("WhatsApp dibuka dan log pesan disimpan.");
    });
  }

  function handleSendDirect() {
    if (!preview || !preview.recipientWhatsappNumber) return;

    startSendDirect(async () => {
      const result = await sendWhatsappViaBot({
        kelasId: kelas.id,
        templateKey: preview.templateKey,
        recipientRole: preview.recipientRole,
        recipientName: preview.recipientName,
        recipientWhatsappNumber: preview.recipientWhatsappNumber!,
        messageContent: preview.message,
        metadata: preview.metadata ?? {},
      });

      if (!result.ok) {
        toast.error(result.error ?? "Gagal kirim via bot WhatsApp.");
        return;
      }

      setDialogOpen(false);
      toast.success("Pesan terkirim langsung via bot WhatsApp.");
    });
  }

  return (
    <>
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <CardTitle>Aksi WhatsApp</CardTitle>
          <CardDescription>
            Template pesan diambil dari pengaturan dan otomatis diisi data kelas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-sm font-medium">Target Instruktur</p>
            <div className="mt-2 flex gap-2">
              <Select value={selectedInstructorId} onValueChange={setSelectedInstructorId}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Pilih instruktur" />
                </SelectTrigger>
                <SelectContent>
                  {instructorOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                      {option.phone ? ` (${option.phone})` : " (tanpa nomor WA)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleOfferSchedule}
                disabled={!selectedInstructorId || !canManage}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Tawarkan Jadwal
              </Button>
              <Button
                variant="outline"
                onClick={handleHonorTransferred}
                disabled={!selectedInstructorId || !canManage}
              >
                <CircleCheckBig className="mr-2 h-4 w-4" />
                Info Honor Ditransfer
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Target Keuangan</p>
                <p className="text-xs text-muted-foreground">
                  {kelas.financeContactName || "Tim Keuangan"} -{" "}
                  {kelas.financeWhatsappNumber || "Nomor belum diatur"}
                </p>
              </div>
              <Badge variant="outline">{kelas.financeContactSource || "unconfigured"}</Badge>
            </div>
            <div className="mt-3">
              <Button variant="outline" onClick={handleFinanceReminder} disabled={!canManage}>
                <Wallet className="mr-2 h-4 w-4" />
                Reminder Pengajuan Honorarium
              </Button>
            </div>
            {canManage ? (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Input
                    value={financeContactNameDraft}
                    onChange={(event) => setFinanceContactNameDraft(event.target.value)}
                    placeholder="Override nama kontak keuangan"
                    maxLength={200}
                  />
                  <Input
                    value={financeWhatsappDraft}
                    onChange={(event) => setFinanceWhatsappDraft(event.target.value)}
                    placeholder="Override nomor WA keuangan"
                    maxLength={30}
                  />
                </div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    onClick={handleSaveFinanceOverride}
                    disabled={saveFinancePending}
                  >
                    Simpan Override Kelas
                  </Button>
                </div>
              </>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border/60 p-4">
            <p className="text-sm font-medium">Riwayat Pesan WA</p>
            <div className="mt-3 space-y-2">
              {logs.length === 0 ? (
                <EmptyState icon={MessageCircle} title="Belum ada riwayat WhatsApp" description="Riwayat pengiriman pesan untuk kelas ini akan tampil setelah pesan dibuat atau dikirim." className="min-h-32" />
              ) : (
                logs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs transition-colors hover:bg-muted/35"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{log.templateKey}</Badge>
                      <span>{log.recipientName || "-"}</span>
                      <span className="text-muted-foreground">
                        {new Date(log.sentAt).toLocaleString("id-ID", {
                          timeZone: APP_TIME_ZONE,
                        })}
                      </span>
                      <span className="text-muted-foreground">
                        oleh {log.sentByName || "Sistem"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.title ?? "Preview Pesan"}</DialogTitle>
            <DialogDescription>{preview?.description ?? ""}</DialogDescription>
          </DialogHeader>
          <Textarea value={preview?.message ?? ""} readOnly className="min-h-[260px]" />
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Tutup
            </Button>
            {whatsappBotEnabled && preview?.recipientWhatsappNumber ? (
              <Button
                variant="secondary"
                onClick={handleSendDirect}
                disabled={sendDirectPending}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {sendDirectPending ? "Mengirim..." : "Kirim Langsung (Bot)"}
              </Button>
            ) : null}
            {preview?.waLink ? (
              <Button onClick={handleSendWhatsapp} disabled={sendPending}>
                <MessageCircle className="mr-2 h-4 w-4" />
                Buka WhatsApp
              </Button>
            ) : (
              <Button disabled>
                <MessageCircle className="mr-2 h-4 w-4" />
                Nomor WA belum valid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
