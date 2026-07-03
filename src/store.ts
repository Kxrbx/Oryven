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
  DEFAULT_SETTINGS,
} from "@/types";
import { newId } from "@/utils/id";
import { nextOccurrence } from "@/utils/recurrence";

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

export const useStore = create<Store>()(
  subscribeWithSelector((set, get) => ({
    projects: [],
    labels: [],
    tasks: [],
    view: { kind: "inbox" },
    theme: "dark",
    sidebarCollapsed: false,
    selectedTaskId: null,
    detailOpen: false,
    settings: { ...DEFAULT_SETTINGS },
    modal: null,

    // --------- Tasks ---------
    createTask: (input) => {
      const tasks = get().tasks;
      const task: Task = {
        id: newId("t"),
        title: input.title,
        description: input.description ?? "",
        completed: false,
        completedAt: null,
        dueDate: input.dueDate ?? null,
        priority: input.priority ?? 4,
        projectId: input.projectId ?? null,
        labelIds: input.labelIds ?? [],
        subtasks: input.subtasks ?? [],
        recurrence: input.recurrence ?? null,
        parentRecurrenceId: input.parentRecurrenceId ?? null,
        order: input.order ?? nextOrder(tasks),
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ tasks: [...s.tasks, task] }));
      return task;
    },

    updateTask: (id, patch) =>
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),

    toggleTask: (id) =>
      set((s) => {
        const tasks = s.tasks.map((t) => {
          if (t.id !== id) return t;
          const completing = !t.completed;
          return {
            ...t,
            completed: completing,
            completedAt: completing ? new Date().toISOString() : null,
          };
        });
        // Recurrence rule: spawn the next occurrence, but only once per parent,
        // even if the user toggles the same task on/off repeatedly.
        const toggled = tasks.find((t) => t.id === id);
        if (
          toggled &&
          toggled.completed &&
          toggled.recurrence &&
          toggled.dueDate
        ) {
          const hasOpenChild = tasks.some(
            (t2) =>
              t2.id !== toggled.id &&
              t2.parentRecurrenceId === toggled.id &&
              !t2.completed
          );
          if (!hasOpenChild) {
            const next = nextOccurrence(toggled);
            if (next) {
              const fresh: Task = {
                ...toggled,
                id: newId("t"),
                completed: false,
                completedAt: null,
                dueDate: next,
                parentRecurrenceId: toggled.id,
                order: nextOrder(tasks) + 1,
                createdAt: new Date().toISOString(),
              };
              return { tasks: [...tasks, fresh] };
            }
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
        theme: "dark",
        sidebarCollapsed: false,
        selectedTaskId: null,
        detailOpen: false,
        settings: { ...DEFAULT_SETTINGS },
        modal: null,
      })),
  }))
);

