import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { IdentitasSistemCard } from "@/components/pengaturan/IdentitasSistemCard";
import { ProfilAkunCard } from "@/components/pengaturan/ProfilAkunCard";
import { NotifikasiPreferencesCard } from "@/components/pengaturan/NotifikasiPreferencesCard";
import { SistemStatusSection } from "@/components/pengaturan/SistemStatusSection";
import { ManajemenUserCard } from "@/components/pengaturan/ManajemenUserCard";
import { RoleManagementCard } from "@/components/pengaturan/RoleManagementCard";
import { DingtalkConfigCard } from "@/components/pengaturan/DingtalkConfigCard";
import { PengaturanTabs } from "@/components/pengaturan/PengaturanTabs";
import {
  getSystemSettings,
  getSessionRole,
} from "@/server/actions/systemSettings";
import { getMyProfile } from "@/server/actions/profile";
import { getMyNotificationPreferences } from "@/server/actions/notificationPreferences";
import {
  listInvitations,
  listUsersForManagement,
} from "@/server/actions/invitations";
import { listDivisi } from "@/server/actions/divisi";
import {
  listCapabilityMetadata,
  listRoleManagementRows,
  listRoleOptions,
} from "@/server/actions/roles";
import {
  getDingtalkConfig,
  getDingtalkSyncStatus,
  getDingtalkUserMappings,
} from "@/server/actions/dingtalk/config";

export const metadata: Metadata = {
  title: "Pengaturan | ARKA",
};

export default async function PengaturanPage() {
  const [systemSettingsData, role, profile, notifPrefs] = await Promise.all([
    getSystemSettings(),
    getSessionRole(),
    getMyProfile(),
    getMyNotificationPreferences(),
  ]);

  if (!profile) {
    redirect("/login");
  }

  const isAdmin = role === "admin";

  // Fetch data manajemen user hanya untuk admin
  let invitations: Awaited<ReturnType<typeof listInvitations>> = [];
  let userRows: Awaited<ReturnType<typeof listUsersForManagement>> = [];
  let divisiOptions: Array<{ id: number; nama: string }> = [];
  let roleOptions: Awaited<ReturnType<typeof listRoleOptions>> = [];
  let roleRows: Awaited<ReturnType<typeof listRoleManagementRows>> = [];
  let capabilityMetadata: Awaited<
    ReturnType<typeof listCapabilityMetadata>
  > | null = null;

  let dingtalkConfig = null;
  let dingtalkSyncStatus = null;
  let dingtalkMappings: Awaited<ReturnType<typeof getDingtalkUserMappings>>["data"] = [];

  if (isAdmin) {
    [
      invitations,
      userRows,
      divisiOptions,
      roleOptions,
      roleRows,
      capabilityMetadata,
      dingtalkConfig,
      dingtalkSyncStatus,
      dingtalkMappings,
    ] = await Promise.all([
      listInvitations(),
      listUsersForManagement(),
      listDivisi().then((rows) =>
        rows.map((r) => ({ id: r.id, nama: r.nama })),
      ),
      listRoleOptions(),
      listRoleManagementRows(),
      listCapabilityMetadata(),
      getDingtalkConfig(),
      getDingtalkSyncStatus(),
      getDingtalkUserMappings().then((r) => r.data),
    ]);
  }

  return (
    <PageWrapper
      title="Pengaturan"
      description="Kelola profil pribadi, preferensi notifikasi, identitas sistem, dan status integrasi."
    >
      <PengaturanTabs
        profil={<ProfilAkunCard initial={profile} />}
        notifikasi={<NotifikasiPreferencesCard initial={notifPrefs} />}
        identitas={
          <IdentitasSistemCard initial={systemSettingsData} isAdmin={isAdmin} />
        }
        sistem={
          <SistemStatusSection
            systemSettings={systemSettingsData}
            isAdmin={isAdmin}
          />
        }
        manajemenUser={
          isAdmin ? (
            <ManajemenUserCard
              invitations={invitations}
              users={userRows}
              divisiOptions={divisiOptions}
              roleOptions={roleOptions}
            />
          ) : undefined
        }
        roleManagement={
          isAdmin && capabilityMetadata ? (
            <RoleManagementCard
              roles={roleRows}
              capabilityGroups={capabilityMetadata.groups}
              capabilityLabels={capabilityMetadata.labels}
            />
          ) : undefined
        }
        dingtalk={
          isAdmin ? (
            <DingtalkConfigCard
              initialConfig={dingtalkConfig?.data ?? null}
              initialSyncStatus={dingtalkSyncStatus?.data ?? null}
              initialMappings={dingtalkMappings}
            />
          ) : undefined
        }
      />
    </PageWrapper>
  );
}
