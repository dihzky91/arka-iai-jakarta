"use server";

import { eq, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import {
  curriculumTemplate,
  curriculumExamPoints,
  classTypes,
  classSessions,
  nationalHolidays,
  classExcludedDates,
} from "@/server/db/schema";

const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function parseIsoDateLocal(isoDate: string): Date {
  const [yearText, monthText, dayText] = isoDate.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const month = Number.parseInt(monthText ?? "", 10);
  const day = Number.parseInt(dayText ?? "", 10);
  return new Date(year, month - 1, day);
}

function formatIsoDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getActiveDayNumbers(activeDaysStr: string): number[] {
  return activeDaysStr
    .split(",")
    .map((d) => DAY_MAP[d.trim()])
    .filter((n): n is number => n !== undefined);
}

function findNextActiveDate(
  currentDate: Date,
  activeDayNumbers: number[],
  excludedSet: Set<string>,
): Date {
  const d = new Date(currentDate);
  d.setHours(0, 0, 0, 0);

  let attempts = 0;
  while (attempts < 365) {
    if (activeDayNumbers.includes(d.getDay())) {
      const dateStr = formatIsoDateLocal(d);
      if (!excludedSet.has(dateStr)) {
        return d;
      }
    }
    d.setDate(d.getDate() + 1);
    attempts++;
  }
  throw new Error("Tidak dapat menemukan tanggal tersedia dalam 365 hari");
}

type SessionItem = NonNullable<typeof curriculumTemplate.$inferSelect>;
type ExamItem = NonNullable<typeof curriculumExamPoints.$inferSelect>;

type QueueItem =
  | { type: "session_pair"; session1Num: number; session2Num: number; session1Materi: string; session2Materi: string }
  | { type: "exam_day"; examSubjects: string[]; examSlotCount: number }
  | { type: "mixed"; sessionNum: number; materiName: string; examSubjects: string[] }
  | { type: "single_session"; sessionNum: number; materiName: string };

async function buildSessionQueue(programId: string): Promise<QueueItem[]> {
  const sessions = await db
    .select()
    .from(curriculumTemplate)
    .where(eq(curriculumTemplate.programId, programId))
    .orderBy(asc(curriculumTemplate.sessionNumber));

  const examPoints = await db
    .select()
    .from(curriculumExamPoints)
    .where(eq(curriculumExamPoints.programId, programId))
    .orderBy(asc(curriculumExamPoints.afterSessionNumber));

  const queue: QueueItem[] = [];
  let nextExamIdx = 0;

  for (let i = 0; i < sessions.length; i += 2) {
    const s1 = sessions[i];
    if (!s1) continue;
    const s2 = sessions[i + 1] ?? null;
    const lastSessionInPair = s2?.sessionNumber ?? s1.sessionNumber;

    while (nextExamIdx < examPoints.length) {
      const ep = examPoints[nextExamIdx];
      if (!ep) break;
      if (ep.afterSessionNumber > lastSessionInPair) break;
      nextExamIdx++;

      if (!ep.hasExam) continue;

      if (ep.isMixedDay) {
        const popped = queue.pop();
        if (popped?.type === "session_pair") {
          queue.push({
            type: "mixed",
            sessionNum: s1.sessionNumber,
            materiName: s1.materiName,
            examSubjects: ep.examSubjects,
          });
        } else {
          if (popped) queue.push(popped);
          queue.push({
            type: "mixed",
            sessionNum: s1.sessionNumber,
            materiName: s1.materiName,
            examSubjects: ep.examSubjects,
          });
        }
        continue;
      }

      queue.push({
        type: "exam_day",
        examSubjects: ep.examSubjects,
        examSlotCount: ep.examSlotCount,
      });
    }

    if (!s2) {
      queue.push({ type: "single_session", sessionNum: s1.sessionNumber, materiName: s1.materiName });
    } else {
      queue.push({
        type: "session_pair",
        session1Num: s1.sessionNumber,
        session2Num: s2.sessionNumber,
        session1Materi: s1.materiName,
        session2Materi: s2.materiName,
      });
    }
  }

  return queue;
}

export interface GenerateInput {
  kelasId: string;
  programId: string;
  classTypeId: string;
  startDate: string;
}

export async function generateSchedule(input: GenerateInput) {
  const ctRows = await db
    .select()
    .from(classTypes)
    .where(eq(classTypes.id, input.classTypeId));
  const ct = ctRows[0];
  if (!ct) throw new Error("Tipe kelas tidak ditemukan");

  const activeDayNumbers = getActiveDayNumbers(ct.activeDays);

  const excludedRows = await db
    .select()
    .from(classExcludedDates)
    .where(eq(classExcludedDates.kelasId, input.kelasId));

  const holidayRows = await db.select().from(nationalHolidays);

  const excludedSet = new Set<string>();
  for (const ex of excludedRows) excludedSet.add(ex.date);
  for (const h of holidayRows) excludedSet.add(h.date);

  const queue = await buildSessionQueue(input.programId);
  const startDate = parseIsoDateLocal(input.startDate);
  startDate.setHours(0, 0, 0, 0);

  let currentDate = new Date(startDate);
  const results: (typeof classSessions.$inferInsert)[] = [];

  for (const item of queue) {
    currentDate = findNextActiveDate(currentDate, activeDayNumbers, excludedSet);

    if (item.type === "session_pair") {
      results.push({
        id: nanoid(),
        kelasId: input.kelasId,
        sessionNumber: item.session1Num,
        isExamDay: false,
        scheduledDate: formatIsoDateLocal(currentDate),
        timeSlotStart: ct.slot1Start,
        timeSlotEnd: ct.slot1End,
        materiName: item.session1Materi,
        status: "scheduled",
      });
      results.push({
        id: nanoid(),
        kelasId: input.kelasId,
        sessionNumber: item.session2Num,
        isExamDay: false,
        scheduledDate: formatIsoDateLocal(currentDate),
        timeSlotStart: ct.slot2Start,
        timeSlotEnd: ct.slot2End,
        materiName: item.session2Materi,
        status: "scheduled",
      });
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (item.type === "exam_day") {
      if (item.examSlotCount >= 1) {
        results.push({
          id: nanoid(),
          kelasId: input.kelasId,
          sessionNumber: null,
          isExamDay: true,
          examSubjects: item.examSubjects,
          scheduledDate: formatIsoDateLocal(currentDate),
          timeSlotStart: ct.slot1Start,
          timeSlotEnd: ct.slot1End,
          materiName: null,
          status: "scheduled",
        });
      }
      if (item.examSlotCount >= 2) {
        results.push({
          id: nanoid(),
          kelasId: input.kelasId,
          sessionNumber: null,
          isExamDay: true,
          examSubjects: item.examSubjects,
          scheduledDate: formatIsoDateLocal(currentDate),
          timeSlotStart: ct.slot2Start,
          timeSlotEnd: ct.slot2End,
          materiName: null,
          status: "scheduled",
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (item.type === "mixed") {
      results.push({
        id: nanoid(),
        kelasId: input.kelasId,
        sessionNumber: item.sessionNum,
        isExamDay: false,
        scheduledDate: formatIsoDateLocal(currentDate),
        timeSlotStart: ct.slot1Start,
        timeSlotEnd: ct.slot1End,
        materiName: item.materiName,
        status: "scheduled",
      });
      results.push({
        id: nanoid(),
        kelasId: input.kelasId,
        sessionNumber: null,
        isExamDay: true,
        examSubjects: item.examSubjects,
        scheduledDate: formatIsoDateLocal(currentDate),
        timeSlotStart: ct.slot2Start,
        timeSlotEnd: ct.slot2End,
        materiName: null,
        status: "scheduled",
      });
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (item.type === "single_session") {
      results.push({
        id: nanoid(),
        kelasId: input.kelasId,
        sessionNumber: item.sessionNum,
        isExamDay: false,
        scheduledDate: formatIsoDateLocal(currentDate),
        timeSlotStart: ct.slot1Start,
        timeSlotEnd: ct.slot1End,
        materiName: item.materiName,
        status: "scheduled",
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  if (results.length > 0) {
    await db.insert(classSessions).values(results);
  }

  return results;
}
