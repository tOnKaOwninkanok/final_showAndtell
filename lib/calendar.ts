import type { CalendarDay, UpcomingDay } from "../types/calendar";

export const CALENDAR_TIME_ZONE = "Asia/Bangkok";
const millisecondsPerDay = 86_400_000;

export function calendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Subtract calendar days in UTC so time of day and daylight saving cannot
// turn tomorrow into zero or two days. "today" is supplied in Bangkok time.
export function daysUntil(date: string, today: string): number | null {
  if (!isCalendarDate(date) || !isCalendarDate(today)) return null;
  return (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / millisecondsPerDay;
}

export function upcomingDays(days: CalendarDay[], today: string): UpcomingDay[] {
  return days.flatMap((day) => {
    const remaining = daysUntil(day.date, today);
    return remaining !== null && remaining >= 0 ? [{ ...day, daysUntil: remaining }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

export function formatCalendarDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}
