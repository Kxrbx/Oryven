// Date utilities. We store dates as "YYYY-MM-DD" (no time, no timezone).
// "Today" is computed in the user's local timezone.

import {
  addDays as fnsAddDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  startOfWeek as fnsStartOfWeek,
  endOfWeek as fnsEndOfWeek,
} from "date-fns";

export type YMD = string;

export function todayYMD(): YMD {
  return toYMD(new Date());
}

export function toYMD(d: Date): YMD {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function fromYMD(ymd: YMD): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(ymd: YMD, n: number): YMD {
  return toYMD(fnsAddDays(fromYMD(ymd), n));
}

export function isToday(ymd: YMD | null | undefined): boolean {
  return !!ymd && ymd === todayYMD();
}

export function isTomorrow(ymd: YMD | null | undefined): boolean {
  return !!ymd && ymd === addDays(todayYMD(), 1);
}

export function isYesterday(ymd: YMD | null | undefined): boolean {
  return !!ymd && ymd === addDays(todayYMD(), -1);
}

export function isOverdue(ymd: YMD | null | undefined): boolean {
  if (!ymd) return false;
  return differenceInCalendarDays(fromYMD(ymd), startOfDay(new Date())) < 0;
}

export function isThisWeek(ymd: YMD | null | undefined): boolean {
  if (!ymd) return false;
  const d = fromYMD(ymd);
  const start = fnsStartOfWeek(new Date(), { weekStartsOn: 1 });
  const end = fnsEndOfWeek(new Date(), { weekStartsOn: 1 });
  return d >= start && d <= end;
}

/**
 * Human-friendly date label.
 * "Today", "Tomorrow", "Yesterday" for near dates.
 * Short weekday ("Mon", "Tue") within ~6 days.
 * Short month + day ("Aug 5") for the same year.
 * Long ("Aug 5, 2026") for other years.
 */
export function formatRelativeDate(ymd: YMD | null | undefined): string {
  if (!ymd) return "";
  if (isToday(ymd)) return "Today";
  if (isTomorrow(ymd)) return "Tomorrow";
  if (isYesterday(ymd)) return "Yesterday";

  const today = startOfDay(new Date());
  const target = fromYMD(ymd);
  const diff = differenceInCalendarDays(target, today);

  if (diff > 0 && diff < 7) {
    return format(target, "EEE"); // "Mon"
  }
  const sameYear = target.getFullYear() === today.getFullYear();
  if (sameYear) {
    return format(target, "MMM d"); // "Aug 5"
  }
  return format(target, "MMM d, yyyy");
}

export function formatLongDate(ymd: YMD | null | undefined): string {
  if (!ymd) return "";
  return format(fromYMD(ymd), "EEEE, MMMM d, yyyy");
}

export function formatClock(d: Date): string {
  return format(d, "h:mm a");
}

/**
 * Human-friendly relative-from-now label for a past or near-future ISO
 * timestamp. Returns:
 *   "just now"     -> within 60 seconds
 *   "5m ago"       -> within an hour
 *   "3h ago"       -> within a day
 *   "Mon"          -> within 6 days (short weekday)
 *   "Aug 5"        -> same year
 *   "Aug 5, 2025"  -> other year
 *
 * Negative diffs (future timestamps) get an "in …" prefix instead.
 *
 * Used by the Activity rail in TaskDetail.
 */
export function formatRelativeFrom(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const sec = Math.round((now.getTime() - date.getTime()) / 1000);

  const absSec = Math.abs(sec);
  const future = sec < 0;

  if (absSec < 60) return "just now";

  const min = Math.round(absSec / 60);
  if (min < 60) return future ? `in ${min}m` : `${min}m ago`;

  const hr = Math.round(min / 60);
  if (hr < 24) return future ? `in ${hr}h` : `${hr}h ago`;

  const day = Math.round(hr / 24);
  if (day >= 0 && day < 7) return format(date, "EEE");

  const sameYear = date.getFullYear() === now.getFullYear();
  if (sameYear) return format(date, "MMM d");

  return format(date, "MMM d, yyyy");
}

export function groupByDay(
  tasks: { id: string; dueDate: YMD | null }[]
): Map<string, { id: string; dueDate: YMD | null }[]> {
  const map = new Map<string, { id: string; dueDate: YMD | null }[]>();
  for (const t of tasks) {
    const key = t.dueDate ?? "no-date";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return map;
}

export function parseStrictYMD(s: string): YMD | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  try {
    const parsed = parseISO(s);
    if (Number.isNaN(parsed.getTime())) return null;
    const ymd = toYMD(parsed);
    return ymd === s ? ymd : null;
  } catch {
    return null;
  }
}
