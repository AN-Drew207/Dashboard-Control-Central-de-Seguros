import type { ISODate } from "./types";

/**
 * Date helpers that work on YYYY-MM-DD strings only.
 * All arithmetic goes through UTC so results never shift with the browser timezone.
 */

const MS_PER_DAY = 86_400_000;

export const MONTHS_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export const MONTHS_LONG_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISO(year: number, month: number, day: number): ISODate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parts(date: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

/** Today in the user's local calendar (not UTC), as YYYY-MM-DD. */
export function todayISO(): ISODate {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function toUTC(date: ISODate): number {
  const { y, m, d } = parts(date);
  return Date.UTC(y, m - 1, d);
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Whole days from `a` to `b` (positive when b is after a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / MS_PER_DAY);
}

export function addDays(date: ISODate, days: number): ISODate {
  const t = new Date(toUTC(date) + days * MS_PER_DAY);
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * Adds calendar months, clamping the day to the last day of the target month.
 * Always computed from the anchor date, so Jan 31 + 1 = Feb 28/29 and Jan 31 + 2 = Mar 31.
 */
export function addMonths(date: ISODate, months: number): ISODate {
  const { y, m, d } = parts(date);
  const total = (m - 1) + months;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12 + 1;
  return toISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

export function isSameMonth(a: ISODate, b: ISODate): boolean {
  return monthKey(a) === monthKey(b);
}

export function startOfMonth(date: ISODate): ISODate {
  const { y, m } = parts(date);
  return toISO(y, m, 1);
}

export function endOfMonth(date: ISODate): ISODate {
  const { y, m } = parts(date);
  return toISO(y, m, daysInMonth(y, m));
}

/** Exact age in completed years on `on`. */
export function ageOn(birthDate: ISODate, on: ISODate): number {
  const b = parts(birthDate);
  const t = parts(on);
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age -= 1;
  return age;
}

/**
 * The next birthday on or after `from`.
 * People born on Feb 29 celebrate on Feb 28 in non-leap years.
 */
export function nextBirthday(birthDate: ISODate, from: ISODate): ISODate {
  const b = parts(birthDate);
  const f = parts(from);
  const candidate = (year: number) => {
    const day = b.m === 2 && b.d === 29 && !isLeapYear(year) ? 28 : b.d;
    return toISO(year, b.m, day);
  };
  const thisYear = candidate(f.y);
  return diffDays(from, thisYear) >= 0 ? thisYear : candidate(f.y + 1);
}

export function formatDate(date: ISODate | null | undefined): string {
  if (!date) return "—";
  const { y, m, d } = parts(date);
  return `${pad(d)} ${MONTHS_ES[m - 1]} ${y}`;
}

export function formatDateLong(date: ISODate): string {
  const { y, m, d } = parts(date);
  return `${d} de ${MONTHS_LONG_ES[m - 1]}, ${y}`;
}

export function formatMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_ES[m - 1]} ${String(y).slice(2)}`;
}

/** Last `count` month keys ending at the month of `date` (oldest first). */
export function lastMonthKeys(date: ISODate, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(monthKey(addMonths(startOfMonth(date), -i)));
  return keys;
}

export function relativeDays(days: number): string {
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  return days > 0 ? `En ${days} días` : `Hace ${-days} días`;
}
