// Lightweight natural-language date parser for quick-add.
// Recognizes a small but useful set of phrases; everything else falls through.
//
//   "Pay rent tomorrow"
//   "Call mom Sun"
//   "Review PR by Friday"
//   "Plan retreat 2026-09-12"
//   "Ship MVP in 3 days"
//   "Dentist next monday"

import { addDays, todayYMD, toYMD, fromYMD } from "./dates";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface ParseResult {
  title: string;
  date?: string;
  priority?: 1 | 2 | 3 | 4;
  projectName?: string;
  labelNames?: string[];
}

const PRIORITY_TRIGGERS: Array<{ pattern: RegExp; priority: 1 | 2 | 3 | 4 }> = [
  { pattern: /\bp1\b/i, priority: 1 },
  { pattern: /\!\!\!/, priority: 1 },
  { pattern: /\bp2\b/i, priority: 2 },
  { pattern: /\!\!/, priority: 2 },
  { pattern: /\bp3\b/i, priority: 3 },
  { pattern: /\!/, priority: 3 },
];

export function parseQuickAdd(input: string): ParseResult {
  let text = input.trim();
  let priority: 1 | 2 | 3 | 4 | undefined;
  for (const { pattern, priority: p } of PRIORITY_TRIGGERS) {
    if (pattern.test(text)) {
      priority = p;
      text = text.replace(pattern, "");
      break;
    }
  }

  // Try recognized date phrases from the end of the string.
  let date: string | undefined;

  // "in N days/weeks/months"
  const inN = text.match(/\bin\s+(\d+)\s+(day|week|month)s?\b\s*$/i);
  if (inN) {
    const n = parseInt(inN[1], 10);
    const unit = inN[2].toLowerCase();
    let delta = n;
    if (unit === "week") delta = n * 7;
    if (unit === "month") delta = n * 30;
    date = addDays(todayYMD(), delta);
    text = text.replace(/\bin\s+(\d+)\s+(day|week|month)s?\s*$/i, "");
  }
  // "today" / "tomorrow" / "yesterday"
  else if (/\btoday\b\s*$/i.test(text)) {
    date = todayYMD();
    text = text.replace(/\btoday\b\s*$/i, "");
  } else if (/\btomorrow\b\s*$/i.test(text)) {
    date = addDays(todayYMD(), 1);
    text = text.replace(/\btomorrow\b\s*$/i, "");
  } else if (/\byesterday\b\s*$/i.test(text)) {
    date = addDays(todayYMD(), -1);
    text = text.replace(/\byesterday\b\s*$/i, "");
  }
  // "by <weekday>" / "<weekday>" / "next <weekday>"
  else {
    const byWD = text.match(
      /\b(?:by|on|next)?\s*(sun|mon|tue|wed|thu|fri|sat)(?:day)?\s*$/i
    );
    if (byWD) {
      const isNext = /next/i.test(byWD[0]);
      const idx = WEEKDAYS.indexOf(byWD[1].toLowerCase().slice(0, 3));
      if (idx >= 0) date = nextWeekday(idx, isNext);
      text = text.replace(
        /\b(?:by|on|next)?\s*(?:sun|mon|tue|wed|thu|fri|sat)(?:day)?\s*$/i,
        ""
      );
    } else {
      // Strict ISO date "YYYY-MM-DD" at end
      const iso = text.match(/\b\d{4}-\d{2}-\d{2}\s*$/);
      if (iso) {
        date = iso[0].trim();
        text = text.replace(/\s*\d{4}-\d{2}-\d{2}\s*$/, "");
      }
    }
  }

  // Trim trailing connectors (/, ,, "on", "by") and whitespace.
  text = text
    .replace(/\s+(\/|,|\.)\s*$/, "")
    .replace(/\s+(on|by)\s*$/i, "")
    .trim();

  // Project: "+ProjectName" anywhere
  let projectName: string | undefined;
  const proj = text.match(/\s*\+(\S+)/);
  if (proj) {
    projectName = proj[1];
    text = text.replace(/\s*\+(\S+)/, "");
  }

  // Labels: "@label"
  const labelNames: string[] = [];
  text = text.replace(/\s*@(\S+)/g, (_, name: string) => {
    labelNames.push(name);
    return "";
  });

  text = text.replace(/\s{2,}/g, " ").trim();

  const result: ParseResult = { title: text };
  if (date) result.date = date;
  if (priority) result.priority = priority;
  if (projectName) result.projectName = projectName;
  if (labelNames.length) result.labelNames = labelNames;
  return result;
}

function nextWeekday(target: number, forceNext: boolean): string {
  const today = new Date();
  const cur = today.getDay();
  let delta = target - cur;
  if (delta <= 0 || forceNext) {
    if (forceNext) delta += delta <= 0 ? 7 : 0;
    else delta += 7;
  }
  return addDays(todayYMD(), delta);
}

// Force-referenced to avoid unused-import warnings.
export const _internal = { fromYMD, toYMD };
