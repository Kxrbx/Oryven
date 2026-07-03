import { Task, RecurrenceRule } from "@/types";
import { toYMD, fromYMD } from "./dates";
import { addDays as fnsAddDays } from "date-fns";

/**
 * Given a completed recurring task, compute the next due date.
 * Returns null if the task has no recurrence.
 */
export function nextOccurrence(task: Task): string | null {
  if (!task.recurrence || !task.dueDate) return null;
  const base = fromYMD(task.dueDate); // Date
  switch (task.recurrence.kind) {
    case "daily": {
      return toYMD(fnsAddDays(base, 1));
    }
    case "weekly": {
      if (!task.recurrence.weekdays || task.recurrence.weekdays.length === 0) {
        return toYMD(fnsAddDays(base, 7));
      }
      const sorted = [...task.recurrence.weekdays].sort((a, b) => a - b);
      const cur = base.getDay();
      const nextDay = sorted.find((d) => d > cur);
      const delta = nextDay != null ? nextDay - cur : 7 - cur + sorted[0];
      return toYMD(fnsAddDays(base, delta));
    }
    case "monthly": {
      const day = task.recurrence.dayOfMonth ?? base.getDate();
      const next = new Date(base);
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
      return toYMD(next);
    }
    case "yearly": {
      const next = new Date(base);
      next.setFullYear(next.getFullYear() + 1);
      return toYMD(next);
    }
  }
  return null;
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
      if (!rule.weekdays || rule.weekdays.length === 0) return "Every week";
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return rule.weekdays
        .slice()
        .sort((a, b) => a - b)
        .map((d) => names[d])
        .join(", ");
    }
    case "monthly":
      return rule.dayOfMonth ? `Day ${rule.dayOfMonth} of every month` : "Every month";
    case "yearly":
      return "Every year";
  }
}
