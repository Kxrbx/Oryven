import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  AppState,
  Task,
  Project,
  Label,
  View,
  ID,
  ModalKind,
  AppSettings,
  ViewMode,
  DEFAULT_SETTINGS,
  DEFAULT_VIEW_MODE,
} from "@/types";
import { newId } from "@/utils/id";
import { todayYMD } from "@/utils/dates";
import {
  nextOccurrence,
  normalizeRecurrenceRule,
  recurrenceSeriesId,
} from "@/utils/recurrence";

interface Actions {
  // ---------- Tasks ----------
  createTask: (
    input: Partial<Task> & { title: string }
  ) => Task;
  updateTask: (id: ID, patch: Partial<Task>) => void;
  toggleTask: (id: ID) => void;
  deleteTask: (id: ID) => void;
  reorderTasks: (orderedIds: ID[], projectId?: ID | null) => void;
  reorderTasksByDate: (dateKey: string, orderedIds: ID[]) => void;
  moveTask: (id: ID, target: { projectId: ID | null; index: number }) => void;

  addSubTask: (taskId: ID, title: string) => void;
  toggleSubTask: (taskId: ID, subId: ID) => void;
  updateSubTask: (
    taskId: ID,
    subId: ID,
    patch: Partial<{ title: string; completed: boolean }>
  ) => void;
  deleteSubTask: (taskId: ID, subId: ID) => void;

  addComment: (taskId: ID, body: string) => void;
  updateComment: (taskId: ID, cid: ID, patch: Partial<{ body: string }>) => void;
  deleteComment: (taskId: ID, cid: ID) => void;

  // ---------- Projects ----------
  createProject: (input: {
    name: string;
    color?: Project["color"];
    emoji?: string;
  }) => Project;
  updateProject: (id: ID, patch: Partial<Project>) => void;
  deleteProject: (id: ID) => void;
  reorderProjects: (orderedIds: ID[]) => void;

  // ---------- Labels ----------
  createLabel: (input: { name: string; color?: Label["color"] }) => Label;
  updateLabel: (id: ID, patch: Partial<Label>) => void;
  deleteLabel: (id: ID) => void;

  // ---------- UI ----------
  setView: (view: View) => void;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: AppState["theme"]) => void;
  toggleSidebar: () => void;
  selectTask: (id: ID | null) => void;
  openDetail: (id: ID) => void;
  closeDetail: () => void;

  // ---------- Settings ----------
  setSettings: (patch: Partial<AppSettings>) => void;
  resetAll: () => void;

  // ---------- Modal ----------
  openModal: (kind: ModalKind, props?: Record<string, unknown>) => void;
  closeModal: () => void;
}

export type Store = AppState & Actions;

function nextOrder(prev: { order: number }[]): number {
  if (prev.length === 0) return 1000;
  return Math.max(...prev.map((p) => p.order)) + 1000;
}

function normalizeTaskPatch(task: Task, patch: Partial<Task>): Partial<Task> {
  // Re-normalize the recurrence rule when *either* recurrence or dueDate
  // is being patched. Monthly/weekly rules can depend on the current
  // dueDate (e.g. day-of-month fallbacks), and leaving the rule stale
  // after a date change would silently break the pattern's correct
  // rollover.
  const recurrenceProvided = "recurrence" in patch;
  const dueDateProvided = "dueDate" in patch;
  if (!recurrenceProvided && !dueDateProvided) return patch;

  const dueDate = patch.dueDate !== undefined ? patch.dueDate : task.dueDate;
  const rawRecurrence = recurrenceProvided
    ? patch.recurrence
    : task.recurrence;
  const recurrence = normalizeRecurrenceRule(rawRecurrence, dueDate);

  return {
    ...patch,
    recurrence,
    recurrenceId: recurrence
      ? patch.recurrenceId ?? recurrenceSeriesId(task)
      : null,
  };
}

/**
 * Two tasks are part of the same recurring line when they share the same
 * `recurrenceId` chain. The series id is the original task's id, optionally
 * held by either the explicit `recurrenceId` of any descendant or, for
 * older pre-`recurrenceId` state, the `parentRecurrenceId` lineage.
 *
 * `recurrenceSeriesId` evaluates to the same value for every member of a
 * chain, regardless of where in the lineage the task sits, so a single
 * equality check is sufficient.
 */
function isSameRecurringLine(
  candidate: Task,
  active: Task,
  seriesId: ID
): boolean {
  return recurrenceSeriesId(candidate) === seriesId;
}

/**
 * Returns true when `child` looks like the auto-spawned instance that
 * `toggleTask` produced immediately after completing `parent` — same
 * title, description, priority, project, labels, no user-added
 * subtasks/comments, and a `dueDate` that still matches the natural
 * recurrence step from `parent`. We use this to decide whether
 * un-ticking `parent` is allowed to clean the child up. A child the
 * user has since edited stays put, because removing it would silently
 * discard their work (a date customisation in particular should
 * survive an un-tick).
 */
function isPristineAutoSpawn(child: Task, parent: Task): boolean {
  if (child.title !== parent.title) return false;
  if (child.description !== parent.description) return false;
  if (child.priority !== parent.priority) return false;
  if ((child.projectId ?? null) !== (parent.projectId ?? null)) return false;
  if (child.subtasks.length > 0) return false;
  if ((child.comments?.length ?? 0) > 0) return false;
  const a = child.labelIds.slice().sort().join("\u0001");
  const b = parent.labelIds.slice().sort().join("\u0001");
  if (a !== b) return false;
  // A user who rescheduled the auto-spawned child has effectively
  // claimed it; treat that as an edit and preserve it on un-tick.
  const naturalNext = nextOccurrence(parent, {
    baseDate: parent.dueDate ?? undefined,
  });
  if (naturalNext == null) return child.dueDate == null;
  return child.dueDate === naturalNext;
}

export const useStore = create<Store>()(
  subscribeWithSelector((set, get) => ({
    projects: [],
    labels: [],
    tasks: [],
    view: { kind: "inbox" },
    viewMode: DEFAULT_VIEW_MODE,
    theme: "dark",
    sidebarCollapsed: false,
    selectedTaskId: null,
    detailOpen: false,
    settings: { ...DEFAULT_SETTINGS },
    modal: null,

    // --------- Tasks ---------
    createTask: (input) => {
      const tasks = get().tasks;
      const id = newId("t");
      const recurrence = normalizeRecurrenceRule(
        input.recurrence,
        input.dueDate ?? null
      );
      const task: Task = {
        id,
        title: input.title,
        description: input.description ?? "",
        completed: false,
        completedAt: null,
        dueDate: input.dueDate ?? null,
        priority: input.priority ?? 4,
        projectId: input.projectId ?? null,
        labelIds: input.labelIds ?? [],
        subtasks: input.subtasks ?? [],
        recurrence,
        recurrenceId: input.recurrenceId ?? (recurrence ? id : null),
        parentRecurrenceId: input.parentRecurrenceId ?? null,
        order: input.order ?? nextOrder(tasks),
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ tasks: [...s.tasks, task] }));
      return task;
    },

    updateTask: (id, patch) =>
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, ...normalizeTaskPatch(t, patch) } : t
        ),
      })),

    toggleTask: (id) =>
      set((s) => {
        const now = new Date().toISOString();
        let tasks = s.tasks.map((t) => {
          if (t.id !== id) return t;
          const completing = !t.completed;
          return {
            ...t,
            completed: completing,
            completedAt: completing ? now : null,
          };
        });

        const toggled = tasks.find((t) => t.id === id);
        if (!toggled) return { tasks };

        // Un-ticking a recurring task: if completing it auto-spawned an
        // immediate next instance, drop that instance now so the user's
        // reversion of the tick doesn't leave a phantom future task
        // dangling in the inbox. We only remove the *direct* child that
        // looks pristine (so deep edits the user made are preserved) and
        // never re-touch anything the user has independently completed.
        if (!toggled.completed && toggled.recurrence) {
          tasks = tasks.filter((t) => {
            if (t.id === toggled.id) return true;
            if (t.parentRecurrenceId !== toggled.id) return true;
            if (t.completed) return true;
            return !isPristineAutoSpawn(t, toggled);
          });
        }

        // Ticking a recurring task: spawn the next occurrence. We anchor
        // to today when the task has no due date so the pattern keeps
        // cycling instead of silently dying the moment the user drops
        // the anchor date.
        if (toggled.completed && toggled.recurrence) {
          const baseDate = toggled.dueDate ?? todayYMD();
          const recurrence = normalizeRecurrenceRule(
            toggled.recurrence,
            baseDate
          );
          if (!recurrence) return { tasks };

          const seriesId = recurrenceSeriesId(toggled);
          const normalizedToggled: Task = {
            ...toggled,
            recurrence,
            recurrenceId: seriesId,
          };

          tasks = tasks.map((t) => (t.id === id ? normalizedToggled : t));

          const hasOpenContinuation = tasks.some(
            (candidate) =>
              candidate.id !== normalizedToggled.id &&
              !candidate.completed &&
              isSameRecurringLine(candidate, normalizedToggled, seriesId)
          );
          if (hasOpenContinuation) {
            return { tasks };
          }

          const next = nextOccurrence(normalizedToggled, { baseDate });
          if (next) {
            const fresh: Task = {
              id: newId("t"),
              title: normalizedToggled.title,
              description: normalizedToggled.description,
              completed: false,
              completedAt: null,
              dueDate: next,
              priority: normalizedToggled.priority,
              projectId: normalizedToggled.projectId,
              labelIds: [...normalizedToggled.labelIds],
              subtasks: normalizedToggled.subtasks.map((subtask) => ({
                ...subtask,
                id: newId("s"),
                completed: false,
              })),
              comments: [],
              recurrence,
              recurrenceId: seriesId,
              parentRecurrenceId: normalizedToggled.id,
              order: nextOrder(tasks),
              createdAt: now,
            };
            return { tasks: [...tasks, fresh] };
          }
        }
        return { tasks };
      }),

    deleteTask: (id) =>
      set((s) => ({
        tasks: s.tasks.filter((t) => t.id !== id),
        selectedTaskId: s.selectedTaskId === id ? null : s.selectedTaskId,
        detailOpen: s.selectedTaskId === id ? false : s.detailOpen,
      })),

    reorderTasks: (orderedIds, projectId) =>
      set((s) => {
        const orders = new Map<ID, number>();
        orderedIds.forEach((id, i) => orders.set(id, (i + 1) * 1000));
        return {
          tasks: s.tasks.map((t) => {
            const sameScope =
              projectId === undefined
                ? true
                : (t.projectId ?? null) === (projectId ?? null);
            if (!sameScope) return t;
            const newOrder = orders.get(t.id);
            return newOrder != null ? { ...t, order: newOrder } : t;
          }),
        };
      }),

    reorderTasksByDate: (dateKey, orderedIds) =>
      set((s) => {
        const orders = new Map<ID, number>();
        orderedIds.forEach((id, i) => orders.set(id, (i + 1) * 1000));
        return {
          tasks: s.tasks.map((t) => {
            if (t.dueDate !== dateKey) return t;
            const newOrder = orders.get(t.id);
            return newOrder != null ? { ...t, order: newOrder } : t;
          }),
        };
      }),

    moveTask: (id, target) =>
      set((s) => {
        const tasks = s.tasks.slice();
        const idx = tasks.findIndex((t) => t.id === id);
        if (idx < 0) return s;
        const moving = { ...tasks[idx], projectId: target.projectId };
        tasks.splice(idx, 1);
        let insertAt = tasks.length;
        let seen = 0;
        for (let i = 0; i < tasks.length; i++) {
          if ((tasks[i].projectId ?? null) !== (target.projectId ?? null)) continue;
          if (seen === target.index) {
            insertAt = i;
            break;
          }
          seen++;
        }
        tasks.splice(insertAt, 0, moving);
        const orders = new Map<ID, number>();
        let order = 1000;
        for (const t of tasks) {
          if ((t.projectId ?? null) !== (target.projectId ?? null)) continue;
          orders.set(t.id, order);
          order += 1000;
        }
        return {
          tasks: tasks.map((t) =>
            orders.has(t.id) ? { ...t, order: orders.get(t.id)! } : t
          ),
        };
      }),

    addSubTask: (taskId, title) =>
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                subtasks: [
                  ...t.subtasks,
                  {
                    id: newId("s"),
                    title,
                    completed: false,
                    order: nextOrder(t.subtasks),
                  },
                ],
              }
            : t
        ),
      })),

    toggleSubTask: (taskId, subId) =>
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                subtasks: t.subtasks.map((st) =>
                  st.id === subId ? { ...st, completed: !st.completed } : st
                ),
              }
            : t
        ),
      })),

    updateSubTask: (taskId, subId, patch) =>
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                subtasks: t.subtasks.map((st) =>
                  st.id === subId ? { ...st, ...patch } : st
                ),
              }
            : t
        ),
      })),

    deleteSubTask: (taskId, subId) =>
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: t.subtasks.filter((st) => st.id !== subId) }
            : t
        ),
      })),

    addComment: (taskId, body) => {
      const clean = body.trim();
      if (!clean) return;
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                comments: [
                  ...(t.comments ?? []),
                  {
                    id: newId("c"),
                    body: clean,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : t
        ),
      }));
    },

    updateComment: (taskId, cid, patch) =>
      set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const cur = t.comments ?? [];
          return {
            ...t,
            comments: cur.map((c) =>
              c.id === cid
                ? {
                    ...c,
                    ...("body" in patch && patch.body != null
                      ? { body: patch.body.trim() }
                      : {}),
                  }
                : c
            ),
          };
        }),
      })),

    deleteComment: (taskId, cid) =>
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                comments: (t.comments ?? []).filter((c) => c.id !== cid),
              }
            : t
        ),
      })),

    // --------- Projects ---------
    createProject: (input) => {
      const projects = get().projects;
      const project: Project = {
        id: newId("p"),
        name: input.name,
        color: input.color ?? "indigo",
        emoji: (input.emoji ?? "").trim(),
        order: nextOrder(projects),
        archived: false,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ projects: [...s.projects, project] }));
      return project;
    },

    updateProject: (id, patch) =>
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      })),

    deleteProject: (id) =>
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        tasks: s.tasks.map((t) =>
          t.projectId === id ? { ...t, projectId: null } : t
        ),
        view:
          s.view.kind === "project" && s.view.id === id
            ? { kind: "inbox" }
            : s.view,
        selectedTaskId:
          s.selectedTaskId && !s.tasks.find((t) => t.id === s.selectedTaskId)
            ? null
            : s.selectedTaskId,
      })),

    reorderProjects: (orderedIds) =>
      set((s) => {
        const orders = new Map<ID, number>();
        orderedIds.forEach((id, i) => orders.set(id, (i + 1) * 1000));
        return {
          projects: s.projects.map((p) =>
            orders.has(p.id) ? { ...p, order: orders.get(p.id)! } : p
          ),
        };
      }),

    // --------- Labels ---------
    createLabel: (input) => {
      const labels = get().labels;
      const label: Label = {
        id: newId("l"),
        name: input.name,
        color: input.color ?? "slate",
        order: nextOrder(labels),
      };
      set((s) => ({ labels: [...s.labels, label] }));
      return label;
    },

    updateLabel: (id, patch) =>
      set((s) => ({
        labels: s.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      })),

    deleteLabel: (id) =>
      set((s) => ({
        labels: s.labels.filter((l) => l.id !== id),
        tasks: s.tasks.map((t) => ({
          ...t,
          labelIds: t.labelIds.filter((lid) => lid !== id),
        })),
      })),

    // --------- UI ---------
    setView: (view) => set({ view, selectedTaskId: null, detailOpen: false }),
    // Switching view mode does NOT close the detail panel — users
    // often want to keep their context while re-rendering the same
    // filter in a different layout. Only `setView` clears it.
    setViewMode: (viewMode) => set({ viewMode }),
    setTheme: (theme) => set({ theme }),
    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    selectTask: (id) => set({ selectedTaskId: id }),
    openDetail: (id) => set({ selectedTaskId: id, detailOpen: true }),
    closeDetail: () => set({ detailOpen: false, selectedTaskId: null }),

    openModal: (kind, props) => set({ modal: { kind, props } }),
    closeModal: () => set({ modal: null }),

    // --------- Settings ---------
    setSettings: (patch) =>
      set((s) => ({ settings: { ...s.settings, ...patch } })),

    // Reset wipes everything. The Settings UI double-checks with the user
    // before invoking this.
    resetAll: () =>
      set(() => ({
        projects: [],
        labels: [],
        tasks: [],
        view: { kind: "inbox" },
        viewMode: DEFAULT_VIEW_MODE,
        theme: "dark",
        sidebarCollapsed: false,
        selectedTaskId: null,
        detailOpen: false,
        settings: { ...DEFAULT_SETTINGS },
        modal: null,
      })),
  }))
);
