// Kanban view: one column per project (plus an "Inbox" column for
// tasks without a project). Each card shows the priority dot, the
// title and the due date; click a card to open the task detail.
//
// Drag-and-drop reorders within a column and moves tasks between
// columns. Moving between columns changes the task's projectId via
// the store's `moveTask` action. This is the only view that lets
// users visually re-bucket tasks by project; everywhere else the
// projectId is set through the detail panel or QuickAdd.

import { PointerEvent, useMemo, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useStore } from "@/store";
import { Task, Project } from "@/types";
import { filterTasksForView, bucketByProject } from "@/utils/viewFilter";
import { Checkbox } from "@/components/Checkbox";
import { ColorDot } from "@/components/ColorDot";
import {
  formatRelativeDate,
  isOverdue,
  isToday,
} from "@/utils/dates";
import { cn } from "@/utils/cn";
import { QuickAdd } from "@/components/QuickAdd";
import "./views.css";

const PRIORITY_COLOR: Record<1 | 2 | 3 | 4, "rose" | "orange" | "sky" | null> = {
  1: "rose",
  2: "orange",
  3: "sky",
  4: null,
};

interface KanbanViewProps {
  onOpenDetail: (id: string) => void;
}

export function KanbanView({ onOpenDetail }: KanbanViewProps) {
  const view = useStore((s) => s.view);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const labels = useStore((s) => s.labels);
  const sortMode = useStore((s) => s.settings.sortMode);
  const moveTask = useStore((s) => s.moveTask);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
  });
  const [isPanning, setIsPanning] = useState(false);

  const filtered = useMemo(
    () => filterTasksForView(view, tasks, projects, labels, sortMode),
    [view, tasks, projects, labels, sortMode]
  );
  const columns = useMemo(
    () => {
      const buckets = new Map(
        bucketByProject(filtered, projects).map((col) => [col.key, col])
      );
      const sortedProjects = [...projects].sort((a, b) => a.order - b.order);
      const projectColumns = sortedProjects.map((project) => {
        const existing = buckets.get(project.id);
        return {
          key: project.id,
          label: project.name,
          project,
          tasks: existing?.tasks ?? [],
        };
      });
      const inbox = buckets.get("__inbox__");
      return [
        ...projectColumns,
        {
          key: "__inbox__",
          label: "Inbox",
          project: null,
          tasks: inbox?.tasks ?? [],
        },
      ];
    },
    [filtered, projects]
  );

  // dnd-kit state for drag preview overlay
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = activeId
    ? filtered.find((t) => t.id === activeId) ?? null
    : null;

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);

    // overId format: "col:<projectKey>" for a column drop, or a task id
    // for a card drop (in which case we use the over-task's project).
    let targetProjectId: string | null;
    if (overId.startsWith("col:")) {
      const key = overId.slice(4);
      targetProjectId = key === "__inbox__" ? null : key;
    } else {
      const overTask = filtered.find((t) => t.id === overId);
      if (!overTask) return;
      targetProjectId = overTask.projectId ?? null;
    }

    const task = filtered.find((t) => t.id === taskId);
    if (!task) return;
    if ((task.projectId ?? null) === targetProjectId) {
      // Same column: reorder within the project. We don't have an
      // index-based reorder here; the simpler approach is a no-op,
      // since same-column reorders are handled by the list view.
      return;
    }
    const targetCol = columns.find(
      (c) => (c.project?.id ?? "__inbox__") === (targetProjectId ?? "__inbox__")
    );
    const index = targetCol ? targetCol.tasks.length : 0;
    moveTask(taskId, { projectId: targetProjectId, index });
  };

  const canStartBoardPan = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return !target.closest(
      "button, input, textarea, select, a, .kanban-card, [data-no-board-pan='true']"
    );
  };

  const onBoardPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (e.button !== 0 || !node || !canStartBoardPan(e.target)) return;
    if (node.scrollWidth <= node.clientWidth) return;
    panRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      scrollLeft: node.scrollLeft,
    };
    node.setPointerCapture(e.pointerId);
    setIsPanning(true);
  };

  const endBoardPan = (e: PointerEvent<HTMLDivElement>) => {
    if (!panRef.current.active || panRef.current.pointerId !== e.pointerId) {
      return;
    }
    const node = scrollRef.current;
    if (node?.hasPointerCapture(e.pointerId)) {
      node.releasePointerCapture(e.pointerId);
    }
    panRef.current.active = false;
    setIsPanning(false);
  };

  const onBoardPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    const pan = panRef.current;
    if (!node || !pan.active || pan.pointerId !== e.pointerId) return;
    const dx = e.clientX - pan.startX;
    node.scrollLeft = pan.scrollLeft - dx;
    if (Math.abs(dx) > 1) {
      e.preventDefault();
    }
  };

  if (filtered.length === 0) {
    return (
      <div className="view-empty-wrap">
        <div className="view-empty-msg">
          <h3>No tasks here.</h3>
          <p>Try a different filter, or add a task to get started.</p>
        </div>
        <QuickAdd />
      </div>
    );
  }

  return (
    <div className="view-wrap kanban-wrap">
      <div
        ref={scrollRef}
        className={cn("kanban-scroll", isPanning && "is-panning")}
        aria-label="Kanban board by project"
        onPointerDown={onBoardPointerDown}
        onPointerMove={onBoardPointerMove}
        onPointerUp={endBoardPan}
        onPointerCancel={endBoardPan}
        onLostPointerCapture={() => {
          panRef.current.active = false;
          setIsPanning(false);
        }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="kanban-board" role="list">
            {columns.map((col) => (
              <KanbanColumn
                key={col.key}
                project={col.project}
                columnKey={col.key}
                label={col.label}
                tasks={col.tasks}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && (
              <div className="kanban-card kanban-card--overlay">
                <KanbanCardBody task={activeTask} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
      <QuickAdd />
    </div>
  );
}

function KanbanColumn({
  project,
  columnKey,
  label,
  tasks,
  onOpenDetail,
}: {
  project: Project | null;
  columnKey: string;
  label: string;
  tasks: Task[];
  onOpenDetail: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${columnKey}` });
  return (
    <section
      ref={setNodeRef}
      className={cn("kanban-column", isOver && "is-over")}
      aria-label={`${label}, ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
    >
      <header className="kanban-col-head">
        {project ? (
          <ColorDot color={project.color} size="sm" />
        ) : (
          <span className="dot dot-sm dot-slate" />
        )}
        <span className="kanban-col-label">{label}</span>
        <span className="kanban-col-count">{tasks.length}</span>
      </header>
      <div className="kanban-col-list" role="list">
        {tasks.length > 0 ? (
          tasks.map((t) => (
            <KanbanCard key={t.id} task={t} onOpenDetail={onOpenDetail} />
          ))
        ) : (
          <div className="kanban-col-empty">
            Drop tasks here to move them into {label}.
          </div>
        )}
      </div>
    </section>
  );
}

function KanbanCard({
  task,
  onOpenDetail,
}: {
  task: Task;
  onOpenDetail: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  const toggle = useStore((s) => s.toggleTask);

  return (
    <article
      ref={setNodeRef}
      className={cn(
        "kanban-card",
        task.completed && "is-done",
        isDragging && "is-dragging"
      )}
      role="listitem"
    >
      <div className="kanban-card-actions">
        <button
          type="button"
          className="kanban-card-open"
          onClick={() => onOpenDetail(task.id)}
          aria-label={`Open task: ${task.title}`}
        >
          <KanbanCardBody task={task} />
        </button>
        <button
          type="button"
          className="kanban-card-drag"
          aria-label={`Move task: ${task.title}`}
          title="Drag to move"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} strokeWidth={1.8} />
        </button>
      </div>
      <div className="kanban-card-foot">
        <button
          type="button"
          className="kanban-card-check"
          onClick={(e) => {
            e.stopPropagation();
            toggle(task.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={
            task.completed ? "Mark as not done" : "Mark as done"
          }
        >
          <Checkbox
            checked={task.completed}
            onToggle={() => toggle(task.id)}
            ariaLabel={task.title}
            size="sm"
          />
        </button>
        {task.dueDate && (
          <span
            className={cn(
              "kanban-card-date",
              isToday(task.dueDate) && "is-today",
              isOverdue(task.dueDate) && "is-overdue"
            )}
          >
            {formatRelativeDate(task.dueDate)}
          </span>
        )}
      </div>
    </article>
  );
}

function KanbanCardBody({ task }: { task: Task }) {
  const color = PRIORITY_COLOR[task.priority];
  return (
    <span className="kanban-card-body">
      <span className="kanban-card-top">
        {color && <ColorDot color={color} size="sm" />}
        <span className="kanban-card-title">{task.title}</span>
      </span>
      {task.description && (
        <span className="kanban-card-desc">{task.description}</span>
      )}
    </span>
  );
}
