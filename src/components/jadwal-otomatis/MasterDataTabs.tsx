"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { ProgramRow, ClassTypeRow } from "./MasterDataTypes";
import { MasterDataProgramsTab } from "./MasterDataProgramsTab";
import { MasterDataClassTypesTab } from "./MasterDataClassTypesTab";
import { MasterDataCurriculumTab } from "./MasterDataCurriculumTab";

interface MasterDataTabsProps {
  programs: ProgramRow[];
  classTypes: ClassTypeRow[];
  canManage: boolean;
}

export function MasterDataTabs({ programs, classTypes, canManage }: MasterDataTabsProps) {
  return (
    <Tabs defaultValue="programs" className="w-full">
      <TabsList>
        <TabsTrigger value="programs">Program</TabsTrigger>
        <TabsTrigger value="class-types">Tipe Kelas</TabsTrigger>
        <TabsTrigger value="curriculum">Kurikulum</TabsTrigger>
      </TabsList>

      <TabsContent value="programs" className="space-y-4">
        <MasterDataProgramsTab programs={programs} canManage={canManage} />
      </TabsContent>

      <TabsContent value="class-types" className="space-y-4">
        <MasterDataClassTypesTab classTypes={classTypes} canManage={canManage} />
      </TabsContent>

      <TabsContent value="curriculum" className="space-y-4">
        <MasterDataCurriculumTab programs={programs} canManage={canManage} />
      </TabsContent>
    </Tabs>
  );
}
