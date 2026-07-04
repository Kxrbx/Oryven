// Core data model for Oryven.
// Keep this file small and stable; the rest of the app reads it.

export type ID = string;
export type ISO = string;
export type YMD = string; // "YYYY-MM-DD"

export type ColorKey =
  | "rose"
  | "orange"
  | "amber"
  | "green"
  | "teal"
  | "sky"
  | "indigo"
  | "violet"
  | "slate";

export const COLOR_KEYS: ColorKey[] = [
  "rose",
  "orange",
  "amber",
  "green",
  "teal",
  "sky",
  "indigo",
  "violet",
  "slate",
];

export interface Project {
  id: ID;
  name: string;
  color: ColorKey;
  // Optional single-emoji marker shown alongside the project name in the
  // sidebar (and in detail meta rows). Purely cosmetic. Empty string or
  // omitted → no emoji rendered, just the color dot.
  emoji?: string;
  order: number;
  archived: boolean;
  createdAt: ISO;
}

export interface Label {
  id: ID;
  name: string;
  color: ColorKey;
  order: number;
}

export interface SubTask {
  id: ID;
  title: string;
  completed: boolean;
  order: number;
}

export interface Comment {
  id: ID;
  body: string;
  createdAt: ISO;
}

export type RecurrenceKind = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  kind: RecurrenceKind;
  weekdays?: number[]; // for weekly: 0..6 (Sun..Sat)
  dayOfMonth?: number; // for monthly: 1..31
}

// "smart" = priority -> due date -> order (current default).
// "due"  = due date ascending (no date sinks last)
// "alpha" = alphabetical by title
// "manual" = user-controlled order (drag). Smart is still applied as a tiebreaker.
export type SortMode = "smart" | "due" | "alpha" | "manual";

export interface AppSettings {
  sortMode: SortMode;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  confirmBeforeDelete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  sortMode: "smart",
  weekStartsOn: 1,
  confirmBeforeDelete: true,
};

// 1 = highest visual urgency, 4 = none
export type Priority = 1 | 2 | 3 | 4;

// Display layout for the current filter. Orthogonal to `View`, which is
// the filter (inbox/today/...). A user can be in the "Today" filter
// while seeing it as a Kanban board, or a calendar, etc. Persisted so
// each user gets the layout they prefer on next launch.
export type ViewMode = "list" | "kanban" | "calendar" | "table";

export const VIEW_MODES: ViewMode[] = [
  "list",
  "kanban",
  "calendar",
  "table",
];

export const DEFAULT_VIEW_MODE: ViewMode = "list";

export interface Task {
  id: ID;
  title: string;
  description: string;
  completed: boolean;
  completedAt: ISO | null;
  dueDate: YMD | null;
  priority: Priority;
  projectId: ID | null;
  labelIds: ID[];
  subtasks: SubTask[];
  comments?: Comment[];
  recurrence: RecurrenceRule | null;
  // Stable id shared by all future instances in the same repeating series.
  // Optional for compatibility with state files written before this field.
  recurrenceId?: ID | null;
  // For an instance spawned by completing a recurring task: id of the spawner.
  // Kept for lineage and to migrate older chains into recurrenceId.
  parentRecurrenceId: ID | null;
  order: number;
  createdAt: ISO;
}

export type View =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "all" }
  | { kind: "completed" }
  | { kind: "project"; id: ID }
  | { kind: "label"; id: ID }
  | { kind: "search"; query: string };

export type ModalKind =
  | "project-new"
  | "project-edit"
  | "label-new"
  | "label-edit"
  | "settings";

// What we save/load to disk. UI-only modal state is intentionally excluded.
// `viewMode` is optional for backward compatibility with state written
// before the multi-view feature shipped.
export interface PersistedAppState {
  projects: Project[];
  labels: Label[];
  tasks: Task[];
  view: View;
  viewMode?: ViewMode;
  theme: "dark" | "light";
  sidebarCollapsed: boolean;
  selectedTaskId: ID | null;
  detailOpen: boolean;
  settings: AppSettings;
}

// Full app state (transient + persisted).
export interface AppState extends PersistedAppState {
  modal: { kind: ModalKind; props?: Record<string, unknown> } | null;
}
