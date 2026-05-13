"use client";

import { useState, useMemo, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
  parse,
} from "date-fns";
import { id } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { CalendarEvent } from "@/server/db/schema";
import { getProjectCalendarEntries } from "@/server/actions/projects";

interface CalendarDashboardProps {
  initialEvents: CalendarEvent[];
  userId: string | undefined;
}

const eventTypeColors: Record<string, string> = {
  surat_deadline: "bg-blue-500",
  disposisi_deadline: "bg-amber-500",
  rapat: "bg-purple-500",
  reminder: "bg-green-500",
  other: "bg-gray-500",
  ujian: "bg-rose-500",
  ujian_pengawas: "bg-orange-500",
  admin_jaga: "bg-cyan-500",
  project: "bg-indigo-500",
};

const eventTypeLabels: Record<string, string> = {
  surat_deadline: "Deadline Surat",
  disposisi_deadline: "Deadline Disposisi",
  rapat: "Rapat",
  reminder: "Pengingat",
  other: "Lainnya",
  ujian: "Ujian",
  ujian_pengawas: "Pengawas",
  admin_jaga: "Admin Jaga",
  project: "Project",
};

type CalendarDisplayEvent = CalendarEvent & {
  _projectData?: {
    projectId: string;
    milestoneTitle: string | null;
    milestoneDate: string | null;
  };
};

export function CalendarDashboard({
  initialEvents,
  userId,
}: CalendarDashboardProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [projectEntries, setProjectEntries] = useState<
    Array<{
      projectId: string;
      title: string;
      startDate: string | null;
      endDate: string | null;
      milestones: Array<{ title: string; targetDate: string | null }>;
    }>
  >([]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const toggleProjects = useCallback(async (checked: boolean) => {
    setShowProjects(checked);
    if (checked) {
      try {
        const entries = await getProjectCalendarEntries(
          currentYear,
          currentMonth,
        );
        setProjectEntries(entries);
      } catch {
        setProjectEntries([]);
      }
    } else {
      setProjectEntries([]);
    }
  }, [currentYear, currentMonth]);

  const allEvents: CalendarDisplayEvent[] = useMemo(() => {
    const base = [...initialEvents] as CalendarDisplayEvent[];
    if (showProjects && projectEntries.length > 0) {
      for (const entry of projectEntries) {
        if (entry.startDate) {
          const parsedStart = parse(entry.startDate, "yyyy-MM-dd", new Date());
          const parsedEnd = entry.endDate
            ? parse(entry.endDate, "yyyy-MM-dd", new Date())
            : undefined;
          base.push({
            id: `project-${entry.projectId}`,
            title: `Project: ${entry.title}`,
            description: `Project period: ${entry.startDate} - ${entry.endDate ?? entry.startDate}`,
            eventType: "project" as CalendarEvent["eventType"],
            entitasType: "project",
            entitasId: entry.projectId,
            startDate: parsedStart,
            endDate: parsedEnd ?? null,
            allDay: true,
            userId: userId ?? null,
            isPublic: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            _projectData: {
              projectId: entry.projectId,
              milestoneTitle: null,
              milestoneDate: null,
            },
          } as CalendarDisplayEvent);
        }
        for (const milestone of entry.milestones) {
          if (milestone.targetDate) {
            const parsedMilestone = parse(
              milestone.targetDate,
              "yyyy-MM-dd",
              new Date(),
            );
            base.push({
              id: `milestone-${entry.projectId}-${milestone.title}`,
              title: `🗓 ${milestone.title}`,
              description: `Milestone project: ${entry.title}`,
              eventType: "project" as CalendarEvent["eventType"],
              entitasType: "project_milestone",
              entitasId: entry.projectId,
              startDate: parsedMilestone,
              endDate: null,
              allDay: true,
              userId: userId ?? null,
              isPublic: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              _projectData: {
                projectId: entry.projectId,
                milestoneTitle: milestone.title,
                milestoneDate: milestone.targetDate,
              },
            } as CalendarDisplayEvent);
          }
        }
      }
    }
    return base;
  }, [initialEvents, showProjects, projectEntries, userId]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarDisplayEvent[]>();
    allEvents.forEach((event) => {
      const dateKey = format(event.startDate, "yyyy-MM-dd");
      const existing = map.get(dateKey) || [];
      existing.push(event);
      map.set(dateKey, existing);
    });
    return map;
  }, [allEvents]);

  const selectedDateEvents = selectedDate
    ? eventsByDate.get(format(selectedDate, "yyyy-MM-dd")) || []
    : [];

  const getEventsForDate = (date: Date) => {
    return eventsByDate.get(format(date, "yyyy-MM-dd")) || [];
  };

  const weekDays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  const nextMonth = () => {
    const next = addMonths(currentDate, 1);
    setCurrentDate(next);
    setProjectEntries([]);
  };
  const prevMonth = () => {
    const prev = subMonths(currentDate, 1);
    setCurrentDate(prev);
    setProjectEntries([]);
  };
  const today = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
    setProjectEntries([]);
  };

  const indicators = (() => {
    const all = Object.entries(eventTypeLabels);
    if (!showProjects) {
      return all.filter(([type]) => type !== "project");
    }
    return all;
  })();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Calendar Grid */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">
            {format(currentDate, "MMMM yyyy", { locale: id })}
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-projects"
                checked={showProjects}
                onCheckedChange={toggleProjects}
              />
              <Label
                htmlFor="show-projects"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Tampilkan Project
              </Label>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={today}>
                Hari Ini
              </Button>
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday Headers */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map((date, index) => {
              const dateEvents = getEventsForDate(date);
              const isSelected =
                selectedDate && isSameDay(date, selectedDate);
              const isCurrentMonth = isSameMonth(date, currentDate);
              const isTodayDate = isToday(date);

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(date)}
                  className={`relative min-h-20 rounded-lg border p-2 text-left transition-colors ${
                    isCurrentMonth
                      ? "bg-card"
                      : "bg-muted/30 text-muted-foreground"
                  } ${
                    isSelected
                      ? "border-primary ring-2 ring-primary"
                      : "border-border hover:border-muted-foreground/30"
                  } ${isTodayDate ? "bg-primary/5" : ""}`}
                >
                  <span
                    className={`text-sm font-medium ${
                      isTodayDate ? "text-primary" : ""
                    } ${!isCurrentMonth ? "text-muted-foreground" : ""}`}
                  >
                    {format(date, "d")}
                  </span>

                  {/* Event Indicators */}
                  {dateEvents.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {dateEvents.slice(0, 3).map((event, i) => (
                        <div
                          key={i}
                          className={`h-1.5 w-1.5 rounded-full ${
                            eventTypeColors[event.eventType] || "bg-gray-500"
                          }`}
                        />
                      ))}
                      {dateEvents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{dateEvents.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-4 w-4" />
            {selectedDate
              ? format(selectedDate, "EEEE, d MMMM yyyy", { locale: id })
              : "Pilih Tanggal"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            {selectedDate ? (
              selectedDateEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Badge
                            className={`${
                              eventTypeColors[event.eventType] || "bg-gray-500"
                            } mb-2 text-white`}
                          >
                            {eventTypeLabels[event.eventType] ||
                              event.eventType}
                          </Badge>
                          <h4 className="text-sm font-medium">
                            {event.title}
                          </h4>
                          {event.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {event.description}
                            </p>
                          )}
                          {event._projectData?.milestoneTitle ? (
                            <p className="mt-1 text-xs font-medium text-indigo-600">
                              Milestone: {event._projectData.milestoneTitle}
                            </p>
                          ) : null}
                          {event.entitasType === "project" &&
                          event.entitasId ? (
                            <a
                              href={`/projects/${event.entitasId}`}
                              className="mt-1 inline-block text-xs text-primary hover:underline"
                            >
                              Buka Project →
                            </a>
                          ) : null}
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {event.allDay
                              ? "Sepanjang hari"
                              : format(new Date(event.startDate), "HH:mm")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <CalendarIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">Tidak ada event</p>
                </div>
              )
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <CalendarIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">Klik tanggal untuk melihat event</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="lg:col-span-3">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {indicators.map(([type, label]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${eventTypeColors[type]}`}
                />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
