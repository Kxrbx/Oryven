import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  CalendarDays,
  Flag,
  Folder,
  Tag as TagIcon,
  RotateCw,
  Plus,
  Trash2,
  ChevronDown,
  Check,
  Activity as ActivityIcon,
  MessageSquare,
  Clock,
  Pencil,
} from "lucide-react";
import { useStore } from "@/store";
import { Task, Priority, RecurrenceRule, ColorKey, Project, Label } from "@/types";
import { Checkbox } from "./Checkbox";
import { ColorDot } from "./ColorDot";
import { DatePicker } from "./DatePicker";
import { describeRecurrence } from "@/utils/recurrence";
import {
  formatRelativeDate,
  formatLongDate,
  formatRelativeFrom,
} from "@/utils/dates";
import { cn } from "@/utils/cn";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import "./TaskDetail.css";

interface TaskDetailProps {
  onClose: () => void;
}

export function TaskDetail({ onClose }: TaskDetailProps) {
  const taskId = useStore((s) => s.selectedTaskId);
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId) ?? null);
  const projects = useStore((s) => s.projects);
  const labels = useStore((s) => s.labels);
  const update = useStore((s) => s.updateTask);
  const toggle = useStore((s) => s.toggleTask);
  const remove = useStore((s) => s.deleteTask);
  const addSub = useStore((s) => s.addSubTask);
  const toggleSub = useStore((s) => s.toggleSubTask);
  const updateSub = useStore((s) => s.updateSubTask);
  const deleteSub = useStore((s) => s.deleteSubTask);
  const addComment = useStore((s) => s.addComment);
  const updateComment = useStore((s) => s.updateComment);
  const deleteComment = useStore((s) => s.deleteComment);
  const openModal = useStore((s) => s.openModal);

  const [subInput, setSubInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const titleRef = useRef<HTMLDivElement | null>(null);

  const active = task != null;
  useBodyScrollLock(active);
  useEscapeToClose(active, onClose);

  // Sync the contentEditable title with the task's title and pull focus
  // into it so the user can start typing immediately.
  useEffect(() => {
    if (titleRef.current && task) {
      titleRef.current.textContent = task.title;
      titleRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      if (sel) {
        range.selectNodeContents(titleRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, [task?.id]);

  if (!task) return null;

  const commitTitle = () => {
    const t = titleRef.current?.textContent?.trim() ?? "";
    if (t && t !== task.title) update(task.id, { title: t });
  };

  // Render via React Portal so the modal escapes any local stacking context
  // inside .app / .area-main (true overlay, not a sibling side-panel).
  // z-index 9998: below ModalRoot's 9999 so project/label editors can stack on top.
  return createPortal(
    <div className="detail-page" role="dialog" aria-modal="true">
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail pop-in">
        <header className="detail-head">
          <span className="detail-kind">Task</span>
          <button className="detail-close" onClick={onClose} aria-label="Close">
            <X size={15} strokeWidth={2} />
          </button>
        </header>

        <section className="detail-body">
          {/* ── Main column: title, description, meta rows ──────── */}
          <div className="detail-main">
            <div className="detail-row-title">
              <Checkbox
                checked={task.completed}
                onToggle={() => toggle(task.id)}
                ariaLabel="Task complete"
                size="md"
              />
              <h1
                ref={titleRef}
                className={cn("detail-title", task.completed && "is-done")}
                contentEditable
                suppressContentEditableWarning
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.currentTarget as any).blur();
                  }
                }}
              />
            </div>

            <textarea
              className="detail-desc"
              placeholder="Add a description…"
              defaultValue={task.description}
              onBlur={(e) => {
                if (e.currentTarget.value !== task.description) {
                  update(task.id, { description: e.currentTarget.value });
                }
              }}
              rows={4}
            />

            <section className="detail-meta">
              <PriorityPicker
                value={task.priority}
                onChange={(p) => update(task.id, { priority: p })}
              />
              <DatePickerRow task={task} />
              <ProjectRow task={task} projects={projects} onUpdate={update} />
              <LabelsRow task={task} labels={labels} onUpdate={update} />
              <RecurrenceRow
                task={task}
                open={recurrenceOpen}
                onToggle={() => setRecurrenceOpen((o) => !o)}
                onChange={(recurrence) => update(task.id, { recurrence })}
              />
            </section>
          </div>

          {/* ── Right rail: Subtasks / Activity / Comments ───────── */}
          <aside className="detail-rail" aria-label="Task details">
            <section className="rail-section">
              <h3 className="rail-section-title">
                Sub-tasks
                {task.subtasks.length > 0 && (
                  <span className="rail-section-meta">
                    {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                  </span>
                )}
              </h3>
              <ul className="subtask-list">
                {task.subtasks.map((st) => (
                  <li key={st.id} className={cn("subtask", st.completed && "is-done")}>
                    <Checkbox
                      size="sm"
                      checked={st.completed}
                      onToggle={() => toggleSub(task.id, st.id)}
                    />
                    <input
                      className="subtask-input"
                      defaultValue={st.title}
                      onBlur={(e) => {
                        const v = e.currentTarget.value.trim();
                        if (!v) deleteSub(task.id, st.id);
                        else if (v !== st.title) updateSub(task.id, st.id, { title: v });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.currentTarget as any).blur();
                      }}
                    />
                    <button
                      className="subtask-del"
                      onClick={() => deleteSub(task.id, st.id)}
                      aria-label="Delete sub-task"
                    >
                      <Trash2 size={12} strokeWidth={1.6} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="subtask-add">
                <Plus size={14} strokeWidth={2.2} />
                <input
                  className="subtask-add-input"
                  placeholder="Add a sub-task"
                  value={subInput}
                  onChange={(e) => setSubInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && subInput.trim()) {
                      addSub(task.id, subInput.trim());
                      setSubInput("");
                    }
                  }}
                />
              </div>
            </section>

            <section className="rail-section">
              <h3 className="rail-section-title">
                <ActivityIcon size={12} strokeWidth={2} /> Activity
              </h3>
              <ul className="activity-list">
                <li className="activity-row">
                  <Clock size={11} strokeWidth={2} className="activity-icon" />
                  <span className="activity-label">Created</span>
                  <span className="activity-time" title={formatLongDate(task.createdAt.slice(0, 10))}>
                    {formatRelativeFrom(task.createdAt)}
                  </span>
                </li>
                {task.completedAt && (
                  <li className="activity-row">
                    <Check size={11} strokeWidth={2.6} className="activity-icon" />
                    <span className="activity-label">Completed</span>
                    <span className="activity-time" title={new Date(task.completedAt).toLocaleString()}>
                      {formatRelativeFrom(task.completedAt)}
                    </span>
                  </li>
                )}
                <li className="activity-row">
                  <span className="activity-dot" />
                  <span className="activity-label">Updated</span>
                  <span className="activity-time">now</span>
                </li>
              </ul>
            </section>

            <section className="rail-section">
              <h3 className="rail-section-title">
                <MessageSquare size={12} strokeWidth={2} /> Comments
                {(task.comments?.length ?? 0) > 0 && (
                  <span className="rail-section-meta">
                    {task.comments?.length}
                  </span>
                )}
              </h3>

              {(task.comments?.length ?? 0) > 0 && (
                <ul className="comment-list">
                  {(task.comments ?? []).map((c) => {
                    const isEditing = editingCommentId === c.id;
                    return (
                      <li key={c.id} className="comment-item">
                        <div className="comment-meta">
                          <span className="comment-time" title={new Date(c.createdAt).toLocaleString()}>
                            {formatRelativeFrom(c.createdAt)}
                          </span>
                          <div className="comment-actions">
                            {!isEditing && (
                              <button
                                className="comment-action"
                                title="Edit"
                                aria-label="Edit comment"
                                onClick={() => {
                                  setEditingCommentId(c.id);
                                  setCommentInput(c.body);
                                }}
                              >
                                <Pencil size={11} strokeWidth={2} />
                              </button>
                            )}
                            <button
                              className="comment-action comment-action-danger"
                              title="Delete"
                              aria-label="Delete comment"
                              onClick={() => {
                                deleteComment(task.id, c.id);
                                if (editingCommentId === c.id) {
                                  setEditingCommentId(null);
                                  setCommentInput("");
                                }
                              }}
                            >
                              <Trash2 size={11} strokeWidth={2} />
                            </button>
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="comment-edit">
                            <textarea
                              className="comment-textarea"
                              autoFocus
                              defaultValue={c.body}
                              onChange={(e) => setCommentInput(e.currentTarget.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  setEditingCommentId(null);
                                  setCommentInput("");
                                }
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                  e.preventDefault();
                                  const next = commentInput.trim();
                                  if (!next) return;
                                  updateComment(task.id, c.id, { body: next });
                                  setEditingCommentId(null);
                                  setCommentInput("");
                                }
                              }}
                              rows={3}
                            />
                            <div className="comment-edit-foot">
                              <button
                                className="comment-cancel"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setCommentInput("");
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                className="comment-save"
                                onClick={() => {
                                  const next = commentInput.trim();
                                  if (!next) return;
                                  updateComment(task.id, c.id, { body: next });
                                  setEditingCommentId(null);
                                  setCommentInput("");
                                }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="comment-body">{c.body}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <form
                className="comment-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const next = commentInput.trim();
                  if (!next) return;
                  addComment(task.id, next);
                  setCommentInput("");
                }}
              >
                <textarea
                  className="comment-textarea"
                  placeholder={
                    (task.comments?.length ?? 0) === 0
                      ? "Add a comment…"
                      : "Reply…"
                  }
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      const next = commentInput.trim();
                      if (!next) return;
                      addComment(task.id, next);
                      setCommentInput("");
                    }
                  }}
                  rows={2}
                />
                <div className="comment-form-foot">
                  <span className="comment-hint">
                    <kbd className="kbd">Ctrl</kbd>
                    <span>+</span>
                    <kbd className="kbd">Enter</kbd>
                  </span>
                  <button
                    type="submit"
                    className="comment-save"
                    disabled={!commentInput.trim()}
                  >
                    Comment
                  </button>
                </div>
              </form>
            </section>
          </aside>
        </section>

        <footer className="detail-foot">
          <span className="detail-time">
            {task.dueDate ? `Due ${formatRelativeDate(task.dueDate)}` : "No due date"}
          </span>
          <div className="detail-foot-actions">
            <button
              className="detail-del"
              onClick={() => {
                remove(task.id);
                onClose();
              }}
            >
              <Trash2 size={13} strokeWidth={1.8} /> Delete
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}

const PRIORITY_COLOR: Record<Priority, ColorKey | null> = {
  1: "rose",
  2: "orange",
  3: "sky",
  4: null,
};

function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="meta-row">
      <Flag size={14} strokeWidth={1.8} className="meta-row-icon" />
      <span className="meta-row-label">Priority</span>
      <div className="priority-picker" role="radiogroup" aria-label="Priority">
        {[1, 2, 3, 4].map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={value === p}
            className={cn(
              "pp-bullet",
              value === p && "selected",
              PRIORITY_COLOR[p as Priority] && `dot-${PRIORITY_COLOR[p as Priority]}`
            )}
            onClick={() => onChange(p as Priority)}
            title={p === 4 ? "None" : `P${p}`}
          >
            <span className="dot dot-sm dot-fallback" />
          </button>
        ))}
      </div>
      <span className="meta-row-hint">
        {value === 1 ? "Today or before" : value === 2 ? "Soon" : value === 3 ? "Whenever" : "No rush"}
      </span>
    </div>
  );
}

function DatePickerRow({ task }: { task: Task }) {
  const update = useStore((s) => s.updateTask);
  return (
    <div className="meta-row">
      <CalendarDays size={14} strokeWidth={1.8} className="meta-row-icon" />
      <span className="meta-row-label">Due</span>
      <DatePicker
        value={task.dueDate}
        onChange={(d) => update(task.id, { dueDate: d })}
        align="left"
      />
      {task.dueDate && (
        <span className="meta-row-hint">{formatRelativeDate(task.dueDate)}</span>
      )}
    </div>
  );
}

function ProjectRow({
  task,
  projects,
  onUpdate,
}: {
  task: Task;
  projects: Project[];
  onUpdate: (id: string, patch: Partial<Task>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="meta-row meta-row-selectable" tabIndex={0} onClick={() => setOpen((o) => !o)}>
      <Folder size={14} strokeWidth={1.8} className="meta-row-icon" />
      <span className="meta-row-label">Project</span>
      {task.projectId ? (
        (() => {
          const p = projects.find((x) => x.id === task.projectId);
          if (!p) return <span className="meta-row-value muted">Lost</span>;
          return (
            <span className="meta-row-value">
              <ColorDot color={p.color} size="sm" />
              {p.name}
            </span>
          );
        })()
      ) : (
        <span className="meta-row-value muted">Inbox</span>
      )}
      <ChevronDown size={12} strokeWidth={2} className="meta-row-caret" />
      {open && (
        <div
          className="meta-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={cn("meta-pop-item", task.projectId == null && "active")}
            onClick={() => {
              onUpdate(task.id, { projectId: null });
              setOpen(false);
            }}
          >
            <span className="dot dot-sm dot-slate" />
            Inbox
            {task.projectId == null && <Check size={12} strokeWidth={2.4} />}
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              className={cn("meta-pop-item", p.id === task.projectId && "active")}
              onClick={() => {
                onUpdate(task.id, { projectId: p.id });
                setOpen(false);
              }}
            >
              <ColorDot color={p.color} size="sm" />
              {p.name}
              {p.id === task.projectId && <Check size={12} strokeWidth={2.4} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LabelsRow({
  task,
  labels,
  onUpdate,
}: {
  task: Task;
  labels: Label[];
  onUpdate: (id: string, patch: Partial<Task>) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (lid: string) => {
    const has = task.labelIds.includes(lid);
    onUpdate(task.id, {
      labelIds: has
        ? task.labelIds.filter((x) => x !== lid)
        : [...task.labelIds, lid],
    });
  };
  return (
    <div className="meta-row" onClick={() => setOpen((o) => !o)}>
      <TagIcon size={14} strokeWidth={1.8} className="meta-row-icon" />
      <span className="meta-row-label">Labels</span>
      {task.labelIds.length === 0 && <span className="meta-row-value muted">None</span>}
      <div className="label-value-list">
        {task.labelIds.map((id) => {
          const l = labels.find((x) => x.id === id);
          if (!l) return null;
          return (
            <span key={id} className="label-chip-inline">
              <ColorDot color={l.color} size="sm" />
              {l.name}
              <button
                className="remove-label"
                title={`Remove ${l.name}`}
                aria-label={`Remove label ${l.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  useStore
                    .getState()
                    .updateTask(task.id, {
                      labelIds: task.labelIds.filter((x) => x !== id),
                    });
                }}
              >
                <X size={10} strokeWidth={2.6} />
              </button>
            </span>
          );
        })}
      </div>
      <ChevronDown size={12} strokeWidth={2} className="meta-row-caret" />
      {open && (
        <div className="meta-pop" onClick={(e) => e.stopPropagation()}>
          {labels.length === 0 && (
            <div className="meta-pop-empty">No labels yet</div>
          )}
          {labels.map((l) => (
            <button
              key={l.id}
              className={cn(
                "meta-pop-item",
                task.labelIds.includes(l.id) && "active"
              )}
              onClick={() => toggle(l.id)}
            >
              <ColorDot color={l.color} size="sm" />
              {l.name}
              {task.labelIds.includes(l.id) && <Check size={12} strokeWidth={2.4} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RecurrenceRow({
  task,
  open,
  onToggle,
  onChange,
}: {
  task: Task;
  open: boolean;
  onToggle: () => void;
  onChange: (r: RecurrenceRule | null) => void;
}) {
  return (
    <div className="meta-row" onClick={onToggle}>
      <RotateCw size={14} strokeWidth={1.8} className="meta-row-icon" />
      <span className="meta-row-label">Repeat</span>
      <span className="meta-row-value">{describeRecurrence(task.recurrence)}</span>
      <ChevronDown size={12} strokeWidth={2} className="meta-row-caret" />
      {open && (
        <div className="meta-pop" onClick={(e) => e.stopPropagation()}>
          {[
            { label: "Never", v: null },
            { label: "Every day", v: { kind: "daily" } as RecurrenceRule },
            { label: "Every week", v: { kind: "weekly", weekdays: [] } as RecurrenceRule },
            { label: "Every month", v: { kind: "monthly", dayOfMonth: 1 } as RecurrenceRule },
            { label: "Every year", v: { kind: "yearly" } as RecurrenceRule },
          ].map((opt) => (
            <button
              key={opt.label}
              className="meta-pop-item"
              onClick={() => onChange(opt.v)}
            >
              {opt.label}
              {JSON.stringify(opt.v) === JSON.stringify(task.recurrence) ? (
                <Check size={12} strokeWidth={2.4} />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
