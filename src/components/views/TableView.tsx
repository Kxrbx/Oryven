// Table view: compact, spreadsheet-like grid. Columns: title,
// project, labels, due date, priority, status. Click a header to
// toggle the sort. We re-use the same `filterTasksForView` for
// "what tasks are visible" but ignore the user's chosen sortMode —
// the table owns its own column sort, with title as the default.

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
} from "lucide-react";
import { useStore } from "@/store";
import { Task, Project, Label } from "@/types";
import { filterTasksForView } from "@/utils/viewFilter";
import { Checkbox } from "@/components/Checkbox";
import { ColorDot } from "@/components/ColorDot";
import { cn } from "@/utils/cn";
import { formatRelativeDate, isOverdue, isToday } from "@/utils/dates";
import { QuickAdd } from "@/components/QuickAdd";
import "./views.css";

type SortKey = "title" | "project" | "due" | "priority" | "status";
type SortDir = "asc" | "desc";

const PRIORITY_COLOR: Record<1 | 2 | 3 | 4, "rose" | "orange" | "sky" | null> = {
  1: "rose",
  2: "orange",
  3: "sky",
  4: null,
};

const PRIORITY_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "—",
};

interface TableViewProps {
  onOpenDetail: (id: string) => void;
}

export function TableView({ onOpenDetail }: TableViewProps) {
  const view = useStore((s) => s.view);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const labels = useStore((s) => s.labels);
  const sortMode = useStore((s) => s.settings.sortMode);
  const toggle = useStore((s) => s.toggleTask);

  const filtered = useMemo(
    () => filterTasksForView(view, tasks, projects, labels, sortMode),
    [view, tasks, projects, labels, sortMode]
  );

  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const projectsMap = useMemo(() => {
    const m = new Map<string, Project>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);
  const labelsMap = useMemo(() => {
    const m = new Map<string, Label>();
    for (const l of labels) m.set(l.id, l);
    return m;
  }, [labels]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const va = cellValue(a, sortKey, projectsMap);
      const vb = cellValue(b, sortKey, projectsMap);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls last
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir, projectsMap]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  if (filtered.length === 0) {
    return (
      <div className="view-empty-wrap">
        <div className="view-empty-msg">
          <h3>No rows.</h3>
          <p>The current filter has no tasks to show.</p>
        </div>
        <QuickAdd />
      </div>
    );
  }

  return (
    <div className="view-wrap tbl-wrap">
      <div className="tbl-scroll">
        <table className="tbl" role="grid">
          <thead>
            <tr>
              <th className="tbl-th-check" />
              <Th
                label="Title"
                active={sortKey === "title"}
                dir={sortDir}
                onClick={() => onSort("title")}
              />
              <Th
                label="Project"
                active={sortKey === "project"}
                dir={sortDir}
                onClick={() => onSort("project")}
              />
              <th className="tbl-th">Labels</th>
              <Th
                label="Due"
                active={sortKey === "due"}
                dir={sortDir}
                onClick={() => onSort("due")}
              />
              <Th
                label="Priority"
                active={sortKey === "priority"}
                dir={sortDir}
                onClick={() => onSort("priority")}
              />
              <Th
                label="Status"
                active={sortKey === "status"}
                dir={sortDir}
                onClick={() => onSort("status")}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const p = t.projectId ? projectsMap.get(t.projectId) : null;
              const ls = t.labelIds
                .map((id) => labelsMap.get(id))
                .filter((x): x is Label => !!x);
              return (
                <tr
                  key={t.id}
                  className={cn("tbl-row", t.completed && "is-done")}
                  onClick={() => onOpenDetail(t.id)}
                >
                  <td
                    className="tbl-td-check"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      size="sm"
                      checked={t.completed}
                      onToggle={() => toggle(t.id)}
                    />
                  </td>
                  <td className="tbl-td-title">
                    <span
                      className={cn(
                        "tbl-title",
                        t.completed && "is-done"
                      )}
                    >
                      {t.title}
                    </span>
                  </td>
                  <td className="tbl-td">
                    {p ? (
                      <span className="tbl-project">
                        <ColorDot color={p.color} size="sm" />
                        {p.name}
                      </span>
                    ) : (
                      <span className="tbl-muted">Inbox</span>
                    )}
                  </td>
                  <td className="tbl-td">
                    {ls.length === 0 ? (
                      <span className="tbl-muted">—</span>
                    ) : (
                      <span className="tbl-labels">
                        {ls.slice(0, 3).map((l) => (
                          <span key={l.id} className="tbl-label">
                            <ColorDot color={l.color} size="sm" />
                            {l.name}
                          </span>
                        ))}
                        {ls.length > 3 && (
                          <span className="tbl-label-more">
                            +{ls.length - 3}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="tbl-td">
                    {t.dueDate ? (
                      <span
                        className={cn(
                          "tbl-date",
                          isToday(t.dueDate) && "is-today",
                          isOverdue(t.dueDate) && "is-overdue"
                        )}
                      >
                        {formatRelativeDate(t.dueDate)}
                      </span>
                    ) : (
                      <span className="tbl-muted">—</span>
                    )}
                  </td>
                  <td className="tbl-td">
                    {PRIORITY_COLOR[t.priority] ? (
                      <span
                        className={cn(
                          "tbl-prio",
                          `dot-${PRIORITY_COLOR[t.priority]}`
                        )}
                      >
                        {PRIORITY_LABEL[t.priority]}
                      </span>
                    ) : (
                      <span className="tbl-muted">—</span>
                    )}
                  </td>
                  <td className="tbl-td">
                    {t.completed ? (
                      <span className="tbl-status tbl-status-done">
                        <Check size={11} strokeWidth={2.6} /> Done
                      </span>
                    ) : (
                      <span className="tbl-status tbl-status-open">
                        Open
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <QuickAdd />
    </div>
  );
}

function Th({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="tbl-th tbl-th-sortable" onClick={onClick}>
      <span className="tbl-th-label">{label}</span>
      {active ? (
        dir === "asc" ? (
          <ArrowUp size={11} strokeWidth={2.2} className="tbl-sort-ic" />
        ) : (
          <ArrowDown size={11} strokeWidth={2.2} className="tbl-sort-ic" />
        )
      ) : (
        <ArrowUpDown
          size={11}
          strokeWidth={1.6}
          className="tbl-sort-ic tbl-sort-ic-inactive"
        />
      )}
    </th>
  );
}

function cellValue(
  t: Task,
  key: SortKey,
  projectsMap: Map<string, Project>
): string | number | null {
  switch (key) {
    case "title":
      return t.title.toLowerCase();
    case "project":
      return t.projectId
        ? (projectsMap.get(t.projectId)?.name ?? "").toLowerCase()
        : "zzz"; // sort inbox at the end of the project column
    case "due":
      // No-date rows sort to the end regardless of direction by
      // returning a far-future string. Within "asc" or "desc" we
      // keep that as the largest value so it stays at the bottom.
      return t.dueDate ?? "9999-99-99";
    case "priority":
      return t.priority; // 1..4 — lower number is more urgent
    case "status":
      return t.completed ? "done" : "open";
  }
}
