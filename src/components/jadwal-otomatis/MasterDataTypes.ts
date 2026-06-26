export type ProgramRow = {
  id: string;
  code: string;
  name: string;
  financeContactName: string | null;
  financeWhatsappNumber: string | null;
  totalSessions: number;
  totalMeetings: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ClassTypeRow = {
  id: string;
  code: string;
  name: string;
  activeDays: string;
  slot1Start: string;
  slot1End: string;
  slot2Start: string;
  slot2End: string;
  createdAt: Date;
};

export type TemplateItem = {
  id: string;
  programId: string;
  sessionNumber: number;
  materiBlock: string;
  materiName: string;
  slot: number;
};

export type ExamPointItem = {
  id: string;
  programId: string;
  afterSessionNumber: number;
  isMixedDay: boolean;
  examSlotCount: number;
  examSubjects: string[];
  hasExam: boolean;
};
