import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { differenceInCalendarDays } from "date-fns";

export const DEFAULT_TZ = "Asia/Jakarta";

/** YYYY-MM-DD key in a specific IANA timezone. */
export function dateKey(date: Date = new Date(), timeZone: string = DEFAULT_TZ): string {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd");
}

/** Date object at UTC midnight for a YYYY-MM-DD key (matches @db.Date columns). */
export function dateOnly(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function todayDateOnly(timeZone: string = DEFAULT_TZ, now: Date = new Date()): Date {
  return dateOnly(dateKey(now, timeZone));
}

/** Convert a local wall-clock date + HH:mm in a timezone to an absolute UTC instant. */
export function zonedDateTime(date: string, time: string, timeZone: string = DEFAULT_TZ): Date {
  return fromZonedTime(`${date}T${time.length === 5 ? `${time}:00` : time}`, timeZone);
}

export function formatDateTime(date: Date | string | null | undefined, timeZone: string = DEFAULT_TZ): string {
  if (!date) return "—";
  return formatInTimeZone(new Date(date), timeZone, "d MMM yyyy, HH:mm");
}

export function formatDate(date: Date | string | null | undefined, timeZone: string = DEFAULT_TZ): string {
  if (!date) return "—";
  return formatInTimeZone(new Date(date), timeZone, "d MMM yyyy");
}

export function formatTime(date: Date | string | null | undefined, timeZone: string = DEFAULT_TZ): string {
  if (!date) return "—";
  return formatInTimeZone(new Date(date), timeZone, "HH:mm");
}

export function formatLongDate(date: Date | string | null | undefined, timeZone: string = DEFAULT_TZ): string {
  if (!date) return "—";
  return formatInTimeZone(new Date(date), timeZone, "EEEE, d MMMM yyyy");
}

export function localTimeParts(date: Date, timeZone: string = DEFAULT_TZ): { hours: number; minutes: number } {
  const zoned = toZonedTime(date, timeZone);
  return { hours: zoned.getHours(), minutes: zoned.getMinutes() };
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

/** Inclusive working-day count between two date-only values. */
export function inclusiveDays(start: Date, end: Date): number {
  return differenceInCalendarDays(end, start) + 1;
}

export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0)) };
}

export const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
