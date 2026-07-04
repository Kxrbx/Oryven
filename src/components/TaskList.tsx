// The classic "list" layout. The filter/sort logic was extracted to
// `@/utils/viewFilter.ts` so the other view components (Kanban,
// Calendar, Timeline, Table, Mindmap) all share the same definition
// of "what tasks belong to the current filter, in what order."

import { useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useStore } from "@/store";
import { Task, View } from "@/types";
import { TaskRow } from "./TaskRow";
import { QuickAdd } from "./QuickAdd";
import { EmptyState } from "./EmptyState";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { filterTasksForView } from "@/utils/viewFilter";
import { addDays, todayYMD } from "@/utils/dates";
import { modKey } from "@/utils/keyboard";
import "./TaskList.css";

interface TaskListProps {
  onOpenDetail: (id: string) => void;
}

interface DayGroup {
  key: string; // stable scope identifier (YMD)
  label: string; // human-readable label
  tasks: Task[];
}

export function TaskList({ onOpenDetail }: TaskListProps) {
  const view = useStore((s) => s.view);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const labels = useStore((s) => s.labels);
  const sortMode = useStore((s) => s.settings.sortMode);
  const reorderTasks = useStore((s) => s.reorderTasks);
  const reorderTasksByDate = useStore((s) => s.reorderTasksByDate);

  const filtered = useMemo(
    () => filterTasksForView(view, tasks, projects, labels, sortMode),
    [view, tasks, projects, labels, sortMode]
  );

  const groups = useMemo(() => groupForView(view, filtered), [view, filtered]);

  // Reset scroll on view change.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [view]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (evt: DragEndEvent, scope: string) => {
    const { active, over } = evt;
    if (!over || active.id === over.id) return;
    const ids = (scopeTasks(scope) ?? []).map((t) => t.id);
    const fromIdx = ids.indexOf(String(active.id));
    const toIdx = ids.indexOf(String(over.id));
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = arrayMove(ids, fromIdx, toIdx);
    if (scope === "__flat__") {
      reorderTasks(reordered);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(scope)) {
      reorderTasksByDate(scope, reordered);
    } else {
      reorderTasks(reordered, decodeScope(scope));
    }
  };

  const onTaskNav = (offset: number) => {
    const flat = filtered;
    if (flat.length === 0) return;
    const current = useStore.getState().selectedTaskId ?? flat[0].id;
    const idx = flat.findIndex((t) => t.id === current);
    const next = Math.min(Math.max(0, idx + offset), flat.length - 1);
    useStore.getState().selectTask(flat[next].id);
  };

  useKeyboardShortcuts({
    j: () => onTaskNav(1),
    k: () => onTaskNav(-1),
    arrowdown: () => onTaskNav(1),
    arrowup: () => onTaskNav(-1),
    enter: () => {
      const sel = useStore.getState().selectedTaskId;
      if (sel) onOpenDetail(sel);
    },
    [`${modKey()}+backspace`]: () => {
      const s = useStore.getState();
      const sel = s.selectedTaskId;
      if (!sel) return;
      const task = s.tasks.find((t) => t.id === sel);
      if (
        s.settings.confirmBeforeDelete &&
        !window.confirm(`Delete "${task?.title ?? "selected task"}"?`)
      ) {
        return;
      }
      s.deleteTask(sel);
    },
  });

  function scopeTasks(scope: string): Task[] | null {
    if (scope === "__flat__") return filtered;
    if (/^\d{4}-\d{2}-\d{2}$/.test(scope)) {
      return filtered.filter((t) => t.dueDate === scope);
    }
    if (scope.startsWith("p:")) {
      const id = scope.slice(2);
      return filtered.filter((t) => (t.projectId ?? null) === id);
    }
    return filtered;
  }

  if (filtered.length === 0) {
    return (
      <div className="tasklist-wrap">
        <div className="tasklist-scroll" ref={scrollRef}>
          <EmptyState view={view} />
        </div>
        <QuickAdd />
      </div>
    );
  }

  return (
    <div className="tasklist-wrap">
      <div className="tasklist-scroll" ref={scrollRef}>
        {groups.map((g) => (
          <section key={g.key} className="tasklist-group">
            {g.label !== "__flat__" && (
              <h3 className="tasklist-day-label">
                {g.label}
                <span className="tasklist-day-count">{g.tasks.length}</span>
              </h3>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => onDragEnd(e, g.key)}
            >
              <SortableContext
                items={g.tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="tasklist-list" role="list">
                  {g.tasks.map((t) => (
                    <li key={t.id}>
                      <TaskRow task={t} onOpenDetail={onOpenDetail} />
                    </li>
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </section>
        ))}
      </div>
      <QuickAdd />
    </div>
  );
}

function groupForView(view: View, tasks: Task[]): DayGroup[] {
  if (view.kind === "today" || view.kind === "upcoming") {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const k = t.dueDate ?? "no-date";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, ts]) => ({ key: k, label: prettyDay(k), tasks: ts }));
  }
  return [{ key: "__flat__", label: "__flat__", tasks }];
}

function prettyDay(ymd: string): string {
  const target = new Date(ymd + "T00:00:00");
  const todayStr = todayYMD();
  const tomorrow = addDays(todayStr, 1);
  if (ymd === todayStr) return "Today";
  if (ymd === tomorrow) return "Tomorrow";
  return target.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function decodeScope(scope: string): string | null {
  if (scope.startsWith("p:")) return scope.slice(2);
  return null;
}
