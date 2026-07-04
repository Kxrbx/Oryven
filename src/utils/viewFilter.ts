// Single source of truth for "given the current filter (View), return
// the tasks that should appear, in the order they should appear."
//
// This used to live inside TaskList.tsx as a private helper. Now that we
// render the same filter in four different layouts, every layout calls
// this function and gets the same result. The earlier "completed"
// timestamp sort and the four sort modes (smart/due/alpha/manual) live
// here too, so Kanban cards, Calendar chips, and Table rows all agree
// on what "sorted" means.

import { Task, Project, Label, View, SortMode } from "@/types";

/**
 * Filter `tasks` down to those that belong to the current `view`, then
 * sort by `sortMode` (or by completion date when the view is "completed").
 *
 * The function is pure: no React, no zustand, no side effects. Easy to
 * unit-test and easy to memoize at the call site.
 */
export function filterTasksForView(
  view: View,
  tasks: Task[],
  // We accept any[] here (instead of Project[]/Label[]) so call sites
  // don't have to thread full typed arrays when they only need an id/name
  // lookup. The shape used below is `{ id, name }` which both Project
  // and Label satisfy.
  projects: Array<{ id: string; name: string }>,
  labels: Array<{ id: string; name: string }>,
  sortMode: SortMode
): Task[] {
  const today = todayISO();
  const in7Days = addDaysISO(today, 7);
  const open = (t: Task) => !t.completed;

  let pool: Task[];
  switch (view.kind) {
    case "inbox":
      pool = tasks.filter((t) => open(t) && !t.projectId);
      break;
    case "today":
      pool = tasks.filter(
        (t) => open(t) && t.dueDate !== null && t.dueDate <= today
      );
      break;
    case "upcoming":
      pool = tasks.filter(
        (t) =>
          open(t) &&
          t.dueDate !== null &&
          t.dueDate > today &&
          t.dueDate <= in7Days
      );
      break;
    case "all":
      pool = tasks.filter(open);
      break;
    case "completed":
      pool = tasks.filter((t) => t.completed);
      break;
    case "project":
      pool = tasks.filter((t) => open(t) && t.projectId === view.id);
      break;
    case "label":
      pool = tasks.filter((t) => open(t) && t.labelIds.includes(view.id));
      break;
    case "search":
      pool = tasks.filter((t) => matchQuery(t, view.query));
      break;
  }

  if (view.kind === "completed") {
    return pool.sort((a, b) =>
      (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
    );
  }
  switch (sortMode) {
    case "alpha":
      return pool.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      );
    case "due":
      return pool.sort((a, b) => {
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return a.order - b.order;
      });
    case "manual":
      return pool.sort((a, b) => a.order - b.order);
    case "smart":
    default:
      return pool.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate && b.dueDate)
          return a.dueDate.localeCompare(b.dueDate);
        return a.order - b.order;
      });
  }
}

/**
 * Pure text match used by the Search filter. Kept here alongside
 * `filterTasksForView` so the two stay semantically aligned.
 */
export function matchQuery(t: Task, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    t.title.toLowerCase().includes(s) ||
    t.description.toLowerCase().includes(s)
  );
}

/**
 * Bucket tasks by project id (or `null` for inbox). Used by Kanban to
 * build one column per bucket. The order of columns matches the
 * project sidebar order; the inbox column sits at the end.
 */
export function bucketByProject(
  tasks: Task[],
  projects: Project[]
): Array<{ key: string; label: string; project: Project | null; tasks: Task[] }> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const k = t.projectId ?? "__inbox__";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  const sortedProjects = [...projects].sort((a, b) => a.order - b.order);
  const cols: Array<{
    key: string;
    label: string;
    project: Project | null;
    tasks: Task[];
  }> = [];
  for (const p of sortedProjects) {
    const ts = map.get(p.id);
    if (ts && ts.length) {
      cols.push({ key: p.id, label: p.name, project: p, tasks: ts });
    }
  }
  const inbox = map.get("__inbox__");
  if (inbox && inbox.length) {
    cols.push({ key: "__inbox__", label: "Inbox", project: null, tasks: inbox });
  }
  return cols;
}

/**
 * Bucket tasks by YYYY-MM-DD. Tasks without a date land in a single
 * "No date" bucket at the end. Calendar and Timeline use this.
 */
export function bucketByDate(
  tasks: Task[]
): Array<{ key: string; label: string; tasks: Task[] }> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const k = t.dueDate ?? "no-date";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "no-date") return 1;
      if (b === "no-date") return -1;
      return a.localeCompare(b);
    })
    .map(([k, ts]) => ({ key: k, label: k, tasks: ts }));
}

// ── Date helpers (kept local to this file so the view layer doesn't
//    need to import @/utils/dates for the trivial cases it needs) ──

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
