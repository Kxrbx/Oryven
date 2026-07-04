import { ID, RecurrenceRule, Task, YMD } from "@/types";
import { addDays, fromYMD, todayYMD, toYMD } from "./dates";

/**
 * Given a completed recurring task, compute the next due date. The result is
 * always strictly after both the task's anchor date and today, so an overdue
 * repeating task does not immediately recreate another overdue task.
 *
 * When `task.dueDate` is null (e.g. a "Every day" reminder without a
 * specific date), callers may pass `baseDate` — typically today — to anchor
 * the recurrence. Anchoring to today prevents the recurring pattern from
 * silently dying the moment the user ticks a recurring task that has no
 * due date set.
 */
export function nextOccurrence(
  task: Pick<Task, "recurrence" | "dueDate">,
  options: { today?: YMD; baseDate?: YMD } = {}
): YMD | null {
  if (!task.recurrence) return null;

  const baseDate =
    options.baseDate ?? task.dueDate ?? options.today ?? todayYMD();
  const rule = normalizeRecurrenceRule(task.recurrence, baseDate);
  if (!rule) return null;

  const floor = maxYMD(baseDate, options.today ?? todayYMD());
  let next = nextAfter(rule, baseDate);

  let guard = 0;
  while (next <= floor && guard < 500) {
    next = nextAfter(rule, next);
    guard += 1;
  }

  return next > floor ? next : null;
}

export function normalizeRecurrenceRule(
  rule: RecurrenceRule | null | undefined,
  fallbackDueDate?: YMD | null
): RecurrenceRule | null {
  if (!rule) return null;

  switch (rule.kind) {
    case "daily":
      return { kind: "daily" };
    case "weekly":
      return { kind: "weekly", weekdays: sanitizeWeekdays(rule.weekdays) };
    case "monthly": {
      const fallbackDay = fallbackDueDate
        ? fromYMD(fallbackDueDate).getDate()
        : undefined;
      const day = normalizeDayOfMonth(rule.dayOfMonth ?? fallbackDay);
      return day ? { kind: "monthly", dayOfMonth: day } : { kind: "monthly" };
    }
    case "yearly":
      return { kind: "yearly" };
    default:
      return null;
  }
}

export function recurrenceSeriesId(
  task: Pick<Task, "id" | "recurrenceId" | "parentRecurrenceId">
): ID {
  return task.recurrenceId ?? task.parentRecurrenceId ?? task.id;
}

function nextAfter(rule: RecurrenceRule, baseYMD: YMD): YMD {
  const base = fromYMD(baseYMD);

  switch (rule.kind) {
    case "daily": {
      return addDays(baseYMD, 1);
    }
    case "weekly": {
      const weekdays = sanitizeWeekdays(rule.weekdays);
      if (weekdays.length === 0) {
        return addDays(baseYMD, 7);
      }
      const cur = base.getDay();
      const nextDay = weekdays.find((d) => d > cur);
      const delta = nextDay != null ? nextDay - cur : 7 - cur + weekdays[0];
      return addDays(baseYMD, delta);
    }
    case "monthly": {
      const day = normalizeDayOfMonth(rule.dayOfMonth) ?? base.getDate();
      return addMonthsClamped(base, 1, day);
    }
    case "yearly": {
      return addYearsClamped(base, 1);
    }
  }
}

function addMonthsClamped(base: Date, months: number, dayOfMonth: number): YMD {
  const firstOfTargetMonth = new Date(
    base.getFullYear(),
    base.getMonth() + months,
    1
  );
  const day = Math.min(
    dayOfMonth,
    daysInMonth(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth())
  );
  firstOfTargetMonth.setDate(day);
  return toYMD(firstOfTargetMonth);
}

function addYearsClamped(base: Date, years: number): YMD {
  const next = new Date(base.getFullYear() + years, base.getMonth(), 1);
  next.setDate(Math.min(base.getDate(), daysInMonth(next.getFullYear(), next.getMonth())));
  return toYMD(next);
}

function maxYMD(a: YMD, b: YMD): YMD {
  return a >= b ? a : b;
}

function sanitizeWeekdays(days: number[] | undefined): number[] {
  if (!days) return [];
  return Array.from(
    new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  ).sort((a, b) => a - b);
}

function normalizeDayOfMonth(day: number | undefined): number | undefined {
  if (day == null || !Number.isInteger(day)) return undefined;
  return Math.min(31, Math.max(1, day));
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

export function describeRecurrence(rule: RecurrenceRule | null): string {
  if (!rule) return "Never";
  switch (rule.kind) {
    case "daily":
      return "Every day";
    case "weekly": {
      const weekdays = sanitizeWeekdays(rule.weekdays);
      if (weekdays.length === 0) return "Every week";
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return weekdays
        .map((d) => names[d])
        .join(", ");
    }
    case "monthly":
      return rule.dayOfMonth ? `Day ${rule.dayOfMonth} of every month` : "Every month";
    case "yearly":
      return "Every year";
  }
}
