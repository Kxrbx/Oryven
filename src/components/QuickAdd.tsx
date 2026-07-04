import { useEffect, useRef, useState } from "react";
import { Plus, CalendarDays, CornerDownLeft, Flag } from "lucide-react";
import { useStore } from "@/store";
import { parseQuickAdd } from "@/utils/parse";
import { addDays, todayYMD } from "@/utils/dates";
import { ColorDot } from "./ColorDot";
import { ColorKey, Priority } from "@/types";
import "./QuickAdd.css";

const PRIORITY_COLORS: Record<Priority, ColorKey | null> = {
  1: "rose",
  2: "orange",
  3: "sky",
  4: null,
};

export function QuickAdd() {
  const view = useStore((s) => s.view);
  const labels = useStore((s) => s.labels);
  const projects = useStore((s) => s.projects);
  const createTask = useStore((s) => s.createTask);

  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setText("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const parsed = text ? parseQuickAdd(text) : null;

  const projectMatch = parsed?.projectName
    ? projects.find(
        (p) => p.name.toLowerCase() === parsed.projectName!.toLowerCase()
      )
    : undefined;
  const inferredProjectId =
    projectMatch?.id ?? (view.kind === "project" ? view.id : null);

  const inferredLabelIds = (parsed?.labelNames ?? [])
    .map((n) =>
      labels.find((l) => l.name.toLowerCase() === n.toLowerCase())?.id
    )
    .filter((x): x is string => !!x);

  const submit = () => {
    if (!parsed || !parsed.title.trim()) return;
    createTask({
      title: parsed.title,
      dueDate: parsed.date ?? null,
      priority: parsed.priority ?? 4,
      projectId: inferredProjectId,
      labelIds: inferredLabelIds,
    });
    setText("");
  };

  const priorityColor = parsed?.priority ? PRIORITY_COLORS[parsed.priority] : null;
  const hasNoPriority = parsed?.priority === 4;

  return (
    <div className="quickadd">
      <div className="quickadd-row">
        <Plus size={15} strokeWidth={1.8} className="quickadd-icon" />
        <input
          ref={inputRef}
          className="quickadd-input"
          data-quickadd-input
          placeholder="Add a task — try 'Pay rent tomorrow @errands'"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <span className="quickadd-hint">
          <CornerDownLeft size={12} strokeWidth={2.2} /> to add
        </span>
      </div>
      {parsed && parsed.title && (
        <div className="quickadd-preview">
          {parsed.date && (
            <span className="qp-chip">
              <CalendarDays size={12} strokeWidth={2.2} />
              {prettyDate(parsed.date)}
            </span>
          )}
          {priorityColor && (
            <span className="qp-chip">
              <ColorDot color={priorityColor} size="sm" /> priority {parsed.priority}
            </span>
          )}
          {hasNoPriority && (
            <span className="qp-chip muted">
              <Flag size={12} strokeWidth={2.2} /> no priority
            </span>
          )}
          {inferredProjectId && (
            <span className="qp-chip">
              <ColorDot
                color={
                  (projects.find((p) => p.id === inferredProjectId)?.color ??
                    "slate") as ColorKey
                }
                size="sm"
              />
              {projects.find((p) => p.id === inferredProjectId)?.name}
            </span>
          )}
          {inferredLabelIds.length > 0 &&
            inferredLabelIds.map((id) => {
              const l = labels.find((x) => x.id === id)!;
              return (
                <span key={id} className="qp-chip">
                  <ColorDot color={l.color} size="sm" />
                  {l.name}
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}

function prettyDate(ymd: string): string {
  const today = todayYMD();
  if (ymd === today) return "Today";
  const tomorrow = addDays(today, 1);
  if (ymd === tomorrow) return "Tomorrow";
  return new Date(ymd + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
