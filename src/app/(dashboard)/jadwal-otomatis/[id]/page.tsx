import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JadwalDetail } from "@/components/jadwal-otomatis/JadwalDetail";
import { JadwalUjianIntegrasi } from "@/components/jadwal-otomatis/JadwalUjianIntegrasi";
import { PesertaDanNilaiTab } from "@/components/jadwal-otomatis/PesertaDanNilaiTab";
import {
  getKelasOtomatisDetail,
  getLatestHonorariumWhatsappSnapshotByKelas,
  getSessionsByKelas,
} from "@/server/actions/jadwal-otomatis/kelasOtomatis";
import { getAssignmentsByKelas } from "@/server/actions/jadwal-otomatis/assignments";
import { listInstructors } from "@/server/actions/jadwal-otomatis/instructors";
import { getMateriBlocksByProgram } from "@/server/actions/jadwal-otomatis/expertise";
import { getKelasUjianByPelatihan } from "@/server/actions/jadwal-otomatis/integrasi";
import {
  listWhatsappMessageLogsByKelas,
  listWhatsappTemplatesForClassActions,
} from "@/server/actions/jadwal-otomatis/whatsapp";
import { getSession } from "@/server/actions/auth";
import { getSystemSettings } from "@/server/actions/systemSettings";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const kelas = await getKelasOtomatisDetail(id);
  if (!kelas) return { title: "Kelas Tidak Ditemukan" };
  return {
    title: `${kelas.namaKelas} | Jadwal Kelas | ARKA`,
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const kelas = await getKelasOtomatisDetail(id);

  if (!kelas) notFound();

  const [
    sessions,
    assignments,
    instructors,
    materiBlocks,
    linkedKelasUjian,
    honorariumSnapshot,
    whatsappTemplates,
    whatsappLogs,
    session,
    systemSettings,
  ] = await Promise.all([
    getSessionsByKelas(id),
    getAssignmentsByKelas(id),
    listInstructors(),
    getMateriBlocksByProgram(kelas.programId),
    getKelasUjianByPelatihan(id),
    getLatestHonorariumWhatsappSnapshotByKelas(id),
    listWhatsappTemplatesForClassActions(),
    listWhatsappMessageLogsByKelas(id, 30),
    getSession(),
    getSystemSettings(),
  ]);

  const role = (session?.user as { role?: string } | undefined)?.role;
  const canManage = role === "admin" || role === "staff";
  const whatsappBotEnabled = systemSettings.whatsappBotEnabled;
  const hasExamSessions = sessions.some((s) => s.isExamDay);

  const kelasProp = {
    ...kelas,
    programName: kelas.programName ?? "",
    programCode: kelas.programCode ?? "",
    classTypeName: kelas.classTypeName ?? "",
    mode: kelas.mode ?? "offline",
  };

  return (
    <PageWrapper
      title={kelas.namaKelas}
      description="Detail lengkap kelas pelatihan."
    >
      <Tabs defaultValue="informasi" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="informasi">Informasi Kelas</TabsTrigger>
          <TabsTrigger value="jadwal">Jadwal Sesi</TabsTrigger>
          <TabsTrigger value="instruktur">Instruktur</TabsTrigger>
          <TabsTrigger value="peserta">Peserta &amp; Nilai</TabsTrigger>
          <TabsTrigger value="ujian">Jadwal Ujian</TabsTrigger>
        </TabsList>

        <TabsContent value="informasi">
          <JadwalDetail
            kelas={kelasProp}
            sessions={sessions}
            assignments={assignments}
            instructors={instructors}
            materiBlocks={materiBlocks}
            canManage={canManage}
            mode="informasi"
            honorariumSnapshot={honorariumSnapshot}
            whatsappTemplates={whatsappTemplates}
            whatsappLogs={whatsappLogs}
            whatsappBotEnabled={whatsappBotEnabled}
          />
        </TabsContent>

        <TabsContent value="jadwal">
          <JadwalDetail
            kelas={kelasProp}
            sessions={sessions}
            assignments={assignments}
            instructors={instructors}
            materiBlocks={materiBlocks}
            canManage={canManage}
            mode="jadwal"
            honorariumSnapshot={honorariumSnapshot}
            whatsappTemplates={whatsappTemplates}
            whatsappLogs={whatsappLogs}
            whatsappBotEnabled={whatsappBotEnabled}
          />
        </TabsContent>

        <TabsContent value="instruktur">
          <JadwalDetail
            kelas={kelasProp}
            sessions={sessions}
            assignments={assignments}
            instructors={instructors}
            materiBlocks={materiBlocks}
            canManage={canManage}
            mode="instruktur"
            honorariumSnapshot={honorariumSnapshot}
            whatsappTemplates={whatsappTemplates}
            whatsappLogs={whatsappLogs}
            whatsappBotEnabled={whatsappBotEnabled}
          />
        </TabsContent>

        <TabsContent value="peserta">
          <PesertaDanNilaiTab kelasId={id} canManage={canManage} />
        </TabsContent>

        <TabsContent value="ujian">
          <JadwalUjianIntegrasi
            kelasId={id}
            canManage={canManage}
            linkedKelasUjian={linkedKelasUjian}
            hasExamSessions={hasExamSessions}
          />
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
}
