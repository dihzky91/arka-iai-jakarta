"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, CalendarX, Banknote, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addExpertise,
  removeExpertise,
  addUnavailability,
  removeUnavailability,
} from "@/server/actions/jadwal-otomatis/expertise";
import { updateInstructor } from "@/server/actions/jadwal-otomatis/instructors";
import {
  upsertInstructorRate,
  removeInstructorRate,
} from "@/server/actions/jadwal-otomatis/honorarium";

const expertiseLevelLabels: Record<string, string> = {
  basic: "Basic",
  middle: "Middle",
  senior: "Senior",
  intermediate: "Middle",
  expert: "Senior",
};

const modeLabels: Record<"online" | "offline", string> = {
  online: "Online",
  offline: "Offline",
};

const sessionStatusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  scheduled: "default",
  completed: "secondary",
  cancelled: "destructive",
  makeup: "outline",
};

const availabilityStatusLabels: Record<string, string> = {
  pending_wa_confirmation: "Menunggu WA",
  accepted: "Diterima",
  rejected: "Ditolak",
  no_response: "No Response",
};

interface Props {
  instructor: any;
  expertise: any[];
  rates: any[];
  unavailability: any[];
  history: any[];
  programs: any[];
  allocationSummary: {
    weeklySessions: number;
    monthlySessions: number;
    totalUpcomingSessions: number;
    pendingWaConfirmation: number;
    activeClasses: Array<{
      kelasId: string;
      namaKelas: string;
      programName: string;
      nextSessionDate: string;
      sessionCount: number;
    }>;
  };
}

function formatCurrency(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function InstrukturDetail({
  instructor,
  expertise,
  rates,
  unavailability,
  history,
  programs,
  allocationSummary,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toggling, startToggle] = useTransition();

  const [expProgram, setExpProgram] = useState("");
  const [expBlock, setExpBlock] = useState("");
  const [expLevel, setExpLevel] = useState<"basic" | "middle" | "senior">("middle");

  const [rateProgram, setRateProgram] = useState("");
  const [rateBlock, setRateBlock] = useState("");
  const [rateMode, setRateMode] = useState<"online" | "offline">("offline");
  const [rateAmount, setRateAmount] = useState("");
  const [showRateOverrideForm, setShowRateOverrideForm] = useState(false);

  const [unavDate, setUnavDate] = useState("");
  const [unavReason, setUnavReason] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(instructor.name as string);
  const [editEmail, setEditEmail] = useState((instructor.email ?? "") as string);
  const [editPhone, setEditPhone] = useState((instructor.phone ?? "") as string);
  const [saving, startSave] = useTransition();
  const hasOverrides = rates.length > 0;

  const rateProgramOptions = useMemo(() => {
    const ids = new Set(expertise.map((item: any) => item.programId));
    return programs.filter((program: any) => ids.has(program.id));
  }, [expertise, programs]);

  const expertiseByProgram = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of expertise) {
      const current = map.get(item.programId) ?? [];
      if (!current.includes(item.materiBlock)) current.push(item.materiBlock);
      map.set(item.programId, current);
    }
    for (const [programId, blocks] of map) {
      map.set(
        programId,
        blocks.sort((a, b) => a.localeCompare(b)),
      );
    }
    return map;
  }, [expertise]);

  const availableRateBlocks = useMemo(
    () => (rateProgram ? (expertiseByProgram.get(rateProgram) ?? []) : []),
    [rateProgram, expertiseByProgram],
  );

  function handleStartRateOverride() {
    if (rateProgramOptions.length === 0) {
      toast.error("Tambahkan keahlian instruktur dulu sebelum membuat override rate.");
      return;
    }
    const firstProgram = rateProgramOptions[0]?.id ?? "";
    const nextProgram = rateProgram || firstProgram;
    const nextBlocks = expertiseByProgram.get(nextProgram) ?? [];
    setRateProgram(nextProgram);
    setRateBlock(nextBlocks[0] ?? "");
    setRateMode("offline");
    setRateAmount("");
    setShowRateOverrideForm(true);
  }

  function handleAddExpertise() {
    if (!expProgram || !expBlock) {
      toast.error("Pilih program dan blok materi");
      return;
    }

    start(async () => {
      const result = await addExpertise({
        instructorId: instructor.id,
        programId: expProgram,
        materiBlock: expBlock,
        level: expLevel,
      });
      if (result.ok) {
        toast.success("Keahlian ditambahkan");
        setExpBlock("");
        setExpLevel("middle");
        router.refresh();
      }
    });
  }

  function handleRemoveExpertise(id: string) {
    start(async () => {
      await removeExpertise(id);
      toast.success("Keahlian dihapus");
      router.refresh();
    });
  }

  function handleAddUnavailability() {
    if (!unavDate) {
      toast.error("Pilih tanggal");
      return;
    }

    start(async () => {
      const result = await addUnavailability({
        instructorId: instructor.id,
        date: unavDate,
        reason: unavReason,
      });
      if (result.ok) {
        toast.success("Ketidaktersediaan ditambahkan");
        setUnavDate("");
        setUnavReason("");
        router.refresh();
      }
    });
  }

  function handleSaveRate() {
    const parsedAmount = Number.parseFloat(rateAmount);
    if (!rateProgram || !rateBlock) {
      toast.error("Pilih program dan isi materi block");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      toast.error("Nominal rate tidak valid");
      return;
    }

    start(async () => {
      const result = await upsertInstructorRate({
        instructorId: instructor.id,
        programId: rateProgram,
        materiBlock: rateBlock,
        mode: rateMode,
        rateAmount: parsedAmount,
      });
      if (result.ok) {
        toast.success("Rate honorarium disimpan");
        setShowRateOverrideForm(false);
        setRateProgram("");
        setRateBlock("");
        setRateMode("offline");
        setRateAmount("");
        router.refresh();
      }
    });
  }

  function handleRemoveRate(id: string) {
    start(async () => {
      await removeInstructorRate(id);
      toast.success("Rate honorarium dihapus");
      router.refresh();
    });
  }

  function handleRemoveUnavailability(id: string) {
    start(async () => {
      await removeUnavailability(id);
      toast.success("Ketidaktersediaan dihapus");
      router.refresh();
    });
  }

  function handleSaveEdit() {
    startSave(async () => {
      const result = await updateInstructor({
        id: instructor.id,
        name: editName,
        email: editEmail,
        phone: editPhone,
      });
      if (result.ok) {
        toast.success("Data instruktur diperbarui");
        setEditMode(false);
        router.refresh();
      }
    });
  }

  function handleToggleActive() {
    startToggle(async () => {
      await updateInstructor({
        id: instructor.id,
        name: instructor.name,
        isActive: !instructor.isActive,
      });
      toast.success(`Instruktur ${instructor.isActive ? "dinonaktifkan" : "diaktifkan"}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Data Instruktur</CardTitle>
              <CardDescription>Informasi dasar instruktur.</CardDescription>
            </div>
            <div className="flex gap-2">
              {!editMode && (
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleToggleActive} disabled={toggling}>
                {instructor.isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {editMode ? (
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Nama</p>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Email</p>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email (opsional)" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Telepon</p>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Telepon (opsional)" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); setEditName(instructor.name); setEditEmail(instructor.email ?? ""); setEditPhone(instructor.phone ?? ""); }} disabled={saving}>
                Batal
              </Button>
            </div>
          </CardContent>
        ) : (
          <CardContent className="pt-6 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{instructor.email ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telepon</p>
              <p className="font-medium">{instructor.phone ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={instructor.isActive ? "default" : "secondary"}>
                {instructor.isActive ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Kelas Aktif & Beban Kerja</CardTitle>
          <CardDescription>Konteks alokasi instruktur untuk penjadwalan terbaru.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">7 Hari</p>
              <p className="text-2xl font-semibold">{allocationSummary.weeklySessions}</p>
              <p className="text-xs text-muted-foreground">sesi</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">30 Hari</p>
              <p className="text-2xl font-semibold">{allocationSummary.monthlySessions}</p>
              <p className="text-xs text-muted-foreground">sesi</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-2xl font-semibold">{allocationSummary.totalUpcomingSessions}</p>
              <p className="text-xs text-muted-foreground">sesi</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Menunggu WA</p>
              <p className="text-2xl font-semibold">
                {allocationSummary.pendingWaConfirmation}
              </p>
              <p className="text-xs text-muted-foreground">konfirmasi</p>
            </div>
          </div>

          {allocationSummary.activeClasses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada kelas aktif terjadwal.</p>
          ) : (
            <div className="space-y-2">
              {allocationSummary.activeClasses.map((activeClass) => (
                <div
                  key={activeClass.kelasId}
                  className="rounded-lg bg-muted/50 px-3 py-2 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{activeClass.namaKelas}</p>
                    <p className="text-xs text-muted-foreground">{activeClass.programName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{activeClass.sessionCount} sesi</p>
                    <p className="text-xs text-muted-foreground">
                      Sesi terdekat: {activeClass.nextSessionDate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Keahlian (Expertise)</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-2 md:grid-cols-4 md:items-end">
            <div>
              <Select value={expProgram} onValueChange={setExpProgram}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program: any) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Input
                placeholder="Blok materi (contoh: PPh OP)"
                value={expBlock}
                onChange={(event) => setExpBlock(event.target.value)}
              />
            </div>
            <div>
              <Select
                value={expLevel}
                onValueChange={(value: "basic" | "middle" | "senior") => setExpLevel(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="middle">Middle</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button onClick={handleAddExpertise} disabled={pending} className="w-full">
                <Plus className="h-4 w-4 mr-1" />
                Tambah
              </Button>
            </div>
          </div>

          {expertise.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada keahlian.</p>
          ) : (
            <div className="space-y-2">
              {expertise.map((item: any) => {
                const program = programs.find((programOption: any) => programOption.id === item.programId);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                  >
                    <div className="space-x-2">
                      <Badge variant="secondary">{program?.name ?? item.programId}</Badge>
                      <span className="text-sm">{item.materiBlock}</span>
                      <Badge variant="outline">
                        {expertiseLevelLabels[item.level ?? "middle"] ?? "Middle"}
                      </Badge>
                    </div>
                    <button
                      onClick={() => handleRemoveExpertise(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Rate Honorarium</CardTitle>
              <CardDescription>
                Default otomatis dari matriks standar berdasarkan program, level keahlian, dan metode kelas.
              </CardDescription>
            </div>
            <Badge variant={hasOverrides ? "secondary" : "outline"}>
              {hasOverrides ? "Override Manual Aktif" : "Rate Otomatis Aktif"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {hasOverrides
              ? `Override tersimpan: ${rates.length} item. Selain item override, sesi lain tetap mengikuti matriks standar.`
              : "Jika tidak ada override, honorarium dihitung otomatis mengikuti matriks standar."}
          </div>

          {!showRateOverrideForm ? (
            <div>
              <Button variant="outline" onClick={handleStartRateOverride} disabled={pending}>
                <Plus className="h-4 w-4 mr-1" />
                Tambah Override
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-5 md:items-end">
              <div>
                <Select
                  value={rateProgram}
                  onValueChange={(value) => {
                    setRateProgram(value);
                    const nextBlocks = expertiseByProgram.get(value) ?? [];
                    setRateBlock(nextBlocks[0] ?? "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih program" />
                  </SelectTrigger>
                  <SelectContent>
                    {rateProgramOptions.map((program: any) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={rateBlock} onValueChange={setRateBlock} disabled={!rateProgram || availableRateBlocks.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={rateProgram ? "Pilih materi block" : "Pilih program dulu"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRateBlocks.map((block) => (
                      <SelectItem key={block} value={block}>
                        {block}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={rateMode} onValueChange={(value) => setRateMode(value as "online" | "offline")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih metode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Rate per sesi"
                  value={rateAmount}
                  onChange={(event) => setRateAmount(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveRate} disabled={pending} className="flex-1">
                  <Banknote className="h-4 w-4 mr-1" />
                  Simpan
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowRateOverrideForm(false)}
                  disabled={pending}
                >
                  Batal
                </Button>
              </div>
            </div>
          )}

          {rates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada override rate honorarium.</p>
          ) : (
            <div className="space-y-2">
              {rates.map((rate: any) => (
                <div
                  key={rate.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{rate.programName}</Badge>
                      <span className="text-sm">{rate.materiBlock}</span>
                      <Badge variant="outline">
                        {modeLabels[(rate.mode === "online" ? "online" : "offline")]}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">
                      {formatCurrency(Number(rate.rateAmount ?? 0))}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveRate(rate.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Ketidaktersediaan</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2 items-end">
            <div>
              <Input type="date" value={unavDate} onChange={(event) => setUnavDate(event.target.value)} />
            </div>
            <div className="flex-1">
              <Input
                placeholder="Alasan (opsional)"
                value={unavReason}
                onChange={(event) => setUnavReason(event.target.value)}
              />
            </div>
            <Button size="sm" onClick={handleAddUnavailability} disabled={pending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {unavailability.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada ketidaktersediaan.</p>
          ) : (
            <div className="space-y-2">
              {unavailability.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <CalendarX className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.date}</span>
                    {item.reason ? (
                      <span className="text-sm text-muted-foreground">- {item.reason}</span>
                    ) : null}
                  </div>
                  <button
                    onClick={() => handleRemoveUnavailability(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Histori Mengajar</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Tanggal</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Kelas</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Program</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Materi/Sesi</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status Sesi</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Penugasan</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      Belum ada histori mengajar.
                    </td>
                  </tr>
                ) : (
                  history.map((item: any) => (
                    <tr key={item.assignmentId} className="border-b border-border hover:bg-muted/50">
                      <td className="px-6 py-3">{item.scheduledDate}</td>
                      <td className="px-6 py-3 font-medium">{item.namaKelas}</td>
                      <td className="px-6 py-3">{item.programName}</td>
                      <td className="px-6 py-3">
                        {item.isExamDay ? "Ujian" : item.materiName ?? `Sesi ${item.sessionNumber}`}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={sessionStatusVariants[item.sessionStatus] ?? "outline"}>
                          {item.sessionStatus}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        {item.isSubstitute ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            Substitusi
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Planned</Badge>
                        )}
                        {item.availabilityStatus ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {availabilityStatusLabels[item.availabilityStatus] ?? item.availabilityStatus}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
