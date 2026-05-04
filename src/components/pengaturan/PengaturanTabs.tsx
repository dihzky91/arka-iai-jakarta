"use client";

import { Building2, Bell, MessageCircle, ServerCog, ShieldCheck, UserCircle2, UsersRound } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface PengaturanTabsProps {
  identitas: React.ReactNode;
  profil: React.ReactNode;
  notifikasi: React.ReactNode;
  sistem: React.ReactNode;
  manajemenUser?: React.ReactNode;
  roleManagement?: React.ReactNode;
  dingtalk?: React.ReactNode;
}

export function PengaturanTabs({
  identitas,
  profil,
  notifikasi,
  sistem,
  manajemenUser,
  roleManagement,
  dingtalk,
}: PengaturanTabsProps) {
  return (
    <Tabs defaultValue="profil" className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 sm:flex sm:w-fit sm:flex-wrap">
        <TabsTrigger value="profil" className="justify-start gap-2 sm:justify-center">
          <UserCircle2 className="h-4 w-4" />
          <span>Profil & Akun</span>
        </TabsTrigger>
        <TabsTrigger value="notifikasi" className="justify-start gap-2 sm:justify-center">
          <Bell className="h-4 w-4" />
          <span>Notifikasi</span>
        </TabsTrigger>
        <TabsTrigger value="identitas" className="justify-start gap-2 sm:justify-center">
          <Building2 className="h-4 w-4" />
          <span>Identitas Sistem</span>
        </TabsTrigger>
        <TabsTrigger value="sistem" className="justify-start gap-2 sm:justify-center">
          <ServerCog className="h-4 w-4" />
          <span>Sistem & Integrasi</span>
        </TabsTrigger>
        {manajemenUser ? (
          <TabsTrigger value="manajemenUser" className="justify-start gap-2 sm:justify-center">
            <UsersRound className="h-4 w-4" />
            <span>Manajemen User</span>
          </TabsTrigger>
        ) : null}
        {dingtalk ? (
          <TabsTrigger value="dingtalk" className="justify-start gap-2 sm:justify-center">
            <MessageCircle className="h-4 w-4" />
            <span>DingTalk</span>
          </TabsTrigger>
        ) : null}
        {roleManagement ? (
          <TabsTrigger value="roleManagement" className="justify-start gap-2 sm:justify-center">
            <ShieldCheck className="h-4 w-4" />
            <span>Role</span>
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="profil" className="mt-6">
        {profil}
      </TabsContent>
      <TabsContent value="notifikasi" className="mt-6">
        {notifikasi}
      </TabsContent>
      <TabsContent value="identitas" className="mt-6">
        {identitas}
      </TabsContent>
      <TabsContent value="sistem" className="mt-6">
        {sistem}
      </TabsContent>
      {manajemenUser ? (
        <TabsContent value="manajemenUser" className="mt-6">
          {manajemenUser}
        </TabsContent>
      ) : null}
      {dingtalk ? (
        <TabsContent value="dingtalk" className="mt-6">
          {dingtalk}
        </TabsContent>
      ) : null}
      {roleManagement ? (
        <TabsContent value="roleManagement" className="mt-6">
          {roleManagement}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
