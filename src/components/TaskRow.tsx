import { memo, useState } from "react";
import { GripVertical, RotateCw } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "@/store";
import { Task } from "@/types";
import { Checkbox } from "./Checkbox";
import { ColorDot } from "./ColorDot";
import {
  formatRelativeDate,
  isOverdue,
  isToday,
} from "@/utils/dates";
import { cn } from "@/utils/cn";
import "./TaskRow.css";

interface TaskRowProps {
  task: Task;
  onOpenDetail: (id: string) => void;
}

const PRIORITY_COLOR: Record<1 | 2 | 3 | 4, "rose" | "orange" | "sky" | null> = {
  1: "rose",
  2: "orange",
  3: "sky",
  4: null,
};

function TaskRowImpl({ task, onOpenDetail }: TaskRowProps) {
  const toggle = useStore((s) => s.toggleTask);
  const projects = useStore((s) => s.projects);
  const labels = useStore((s) => s.labels);
  const [editing, setEditing] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const project = task.projectId
    ? projects.find((p) => p.id === task.projectId)
    : null;
  const labelsForTask = task.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter(Boolean);

  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;
  const dueToday = isToday(task.dueDate);
  const priorityColor = PRIORITY_COLOR[task.priority];

  const openRow = () => {
    if (editing) return;
    onOpenDetail(task.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "task-row",
        task.completed && "completed",
        dueToday && "today",
        overdue && "overdue"
      )}
      role="row"
      onClick={openRow}
      onDoubleClick={(e) => {
        e.preventDefault();
        setEditing(true);
        onOpenDetail(task.id);
      }}
    >
      <span
        className="drag-handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} strokeWidth={1.6} />
      </span>

      <Checkbox
        checked={task.completed}
        onToggle={() => toggle(task.id)}
        ariaLabel={task.title}
      />

      {/* Always render the third grid cell so .task-row-body keeps its
       * 1fr column. Without this placeholder, completed tasks and tasks
       * without a priority would shift the body into the 10px slot and
       * crush the title to a single letter. */}
      {priorityColor && !task.completed ? (
        <ColorDot
          color={priorityColor}
          size="md"
          pulse={priorityColor === "rose"}
        />
      ) : (
        <span aria-hidden="true" className="priority-slot" />
      )}

      <div className="task-row-body" data-tilt>
        <div className="task-row-title-row">
          {editing && !task.completed ? (
            <input
              autoFocus
              defaultValue={task.title}
              className="task-row-input"
              onBlur={(e) => {
                const v = e.currentTarget.value.trim();
                if (v && v !== task.title) {
                  useStore.getState().updateTask(task.id, { title: v });
                }
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                if (e.key === "Escape") setEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="task-row-title">{task.title}</span>
          )}
          {task.recurrence && (
            <span className="task-row-recurring" title="Recurring">
              <RotateCw size={11} strokeWidth={2.2} />
            </span>
          )}
        </div>
        {task.description && (
          <div className="task-row-desc">{task.description}</div>
        )}
        <div className="task-row-meta">
          {project && (
            <span className="meta-chip">
              <ColorDot color={project.color} size="sm" />
              {project.name}
            </span>
          )}
          {labelsForTask.map((l) => l && (
            <span key={l.id} className="meta-chip">
              <ColorDot color={l.color} size="sm" /> {l.name}
            </span>
          ))}
          {task.subtasks.length > 0 && (
            <span className="meta-chip">
              <svg
                width="11"
                height="11"
                viewBox="0 0 16 16"
                aria-hidden
              >
                <rect
                  x="2"
                  y="2"
                  width="12"
                  height="12"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M4.5 8 L7 10.5 L11.5 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              {completedSubtasks(task)}/{task.subtasks.length}
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                "meta-chip",
                "meta-date",
                dueToday && "is-today",
                overdue && "is-overdue"
              )}
              title={task.dueDate}
            >
              {formatRelativeDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function completedSubtasks(t: Task): number {
  return t.subtasks.filter((s) => s.completed).length;
}

export const TaskRow = memo(TaskRowImpl);
