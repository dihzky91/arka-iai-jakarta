"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, CalendarDays, Users, Zap } from "lucide-react";
import { GenerateSaldoForm } from "./GenerateSaldoForm";
import { CutiBersamaManager } from "./CutiBersamaManager";
import { KelolaSaldoTable } from "./KelolaSaldoTable";
import { KonfigurasiCutiForm } from "./KonfigurasiCutiForm";

export function KelolaSaldoCutiPage() {
  return (
    <Tabs defaultValue="saldo" className="space-y-4">
      <TabsList>
        <TabsTrigger value="saldo">
          <Users className="mr-2 h-4 w-4" />
          Saldo Karyawan
        </TabsTrigger>
        <TabsTrigger value="cuti-bersama">
          <CalendarDays className="mr-2 h-4 w-4" />
          Cuti Bersama
        </TabsTrigger>
        <TabsTrigger value="generate">
          <Zap className="mr-2 h-4 w-4" />
          Generate Saldo
        </TabsTrigger>
        <TabsTrigger value="konfigurasi">
          <Settings className="mr-2 h-4 w-4" />
          Konfigurasi
        </TabsTrigger>
      </TabsList>

      <TabsContent value="saldo">
        <KelolaSaldoTable />
      </TabsContent>

      <TabsContent value="cuti-bersama">
        <CutiBersamaManager />
      </TabsContent>

      <TabsContent value="generate">
        <GenerateSaldoForm />
      </TabsContent>

      <TabsContent value="konfigurasi">
        <KonfigurasiCutiForm />
      </TabsContent>
    </Tabs>
  );
}
