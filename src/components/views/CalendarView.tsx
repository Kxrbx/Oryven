// Calendar view: month grid. Each day cell shows up to three task
// chips; click a chip to open the task detail. Tasks without a due
// date appear in a strip at the top of the calendar. Navigation
// arrows jump months; the "Today" button snaps back.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import { useStore } from "@/store";
import { Task } from "@/types";
import { filterTasksForView } from "@/utils/viewFilter";
import { Checkbox } from "@/components/Checkbox";
import { ColorDot } from "@/components/ColorDot";
import { cn } from "@/utils/cn";
import { todayYMD, toYMD, fromYMD, addDays, isToday, formatLongDate } from "@/utils/dates";
import { QuickAdd } from "@/components/QuickAdd";
import "./views.css";

const PRIORITY_COLOR: Record<1 | 2 | 3 | 4, "rose" | "orange" | "sky" | null> = {
  1: "rose",
  2: "orange",
  3: "sky",
  4: null,
};

interface CalendarViewProps {
  onOpenDetail: (id: string) => void;
}

export function CalendarView({ onOpenDetail }: CalendarViewProps) {
  const view = useStore((s) => s.view);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const labels = useStore((s) => s.labels);
  const sortMode = useStore((s) => s.settings.sortMode);
  const toggle = useStore((s) => s.toggleTask);
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocusCell = useRef(false);

  const filtered = useMemo(
    () => filterTasksForView(view, tasks, projects, labels, sortMode),
    [view, tasks, projects, labels, sortMode]
  );

  // Anchor month. Kept in local state (not in the store) because it's
  // a transient navigation parameter, not a piece of the user's data.
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // The currently-focused day cell. Used for keyboard nav and the
  // "today" highlight. Resets whenever the anchor month changes.
  const [focused, setFocused] = useState<string>(todayYMD());
  useEffect(() => {
    // If the user is sitting in a month that doesn't contain
    // `focused`, snap focus to the first of the anchor month.
    const d = fromYMD(focused);
    if (
      d.getFullYear() !== anchor.getFullYear() ||
      d.getMonth() !== anchor.getMonth()
    ) {
      setFocused(toYMD(anchor));
    }
  }, [anchor, focused]);

  const today = todayYMD();
  const cells = useMemo(() => buildMonthCells(anchor), [anchor]);

  useEffect(() => {
    if (!shouldFocusCell.current) return;
    shouldFocusCell.current = false;
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-date="${focused}"]`)
      ?.focus();
  }, [focused, anchor]);

  // Bucket tasks by YMD. Tasks without a date are kept separate and
  // shown in a strip above the grid so they aren't forgotten.
  const { byDay, noDate } = useMemo(() => {
    const m = new Map<string, Task[]>();
    const noDate: Task[] = [];
    for (const t of filtered) {
      if (!t.dueDate) {
        noDate.push(t);
        continue;
      }
      if (!m.has(t.dueDate)) m.set(t.dueDate, []);
      m.get(t.dueDate)!.push(t);
    }
    return { byDay: m, noDate };
  }, [filtered]);

  const monthLabel = anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const moveMonth = (delta: number) => {
    const d = new Date(anchor);
    d.setMonth(d.getMonth() + delta);
    d.setDate(1);
    setAnchor(d);
  };

  const focusDay = (ymd: string) => {
    const d = fromYMD(ymd);
    shouldFocusCell.current = true;
    setFocused(ymd);
    if (
      d.getFullYear() !== anchor.getFullYear() ||
      d.getMonth() !== anchor.getMonth()
    ) {
      const nextAnchor = new Date(d);
      nextAnchor.setDate(1);
      setAnchor(nextAnchor);
    }
  };

  const onCalendarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const deltaByKey: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in deltaByKey) {
      e.preventDefault();
      focusDay(addDays(focused, deltaByKey[e.key]));
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const current = fromYMD(focused);
      const weekday = (current.getDay() + 6) % 7;
      focusDay(addDays(focused, e.key === "Home" ? -weekday : 6 - weekday));
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const next = fromYMD(focused);
      next.setMonth(next.getMonth() + (e.key === "PageUp" ? -1 : 1));
      focusDay(toYMD(next));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      const firstTask = byDay.get(focused)?.[0];
      if (firstTask) {
        e.preventDefault();
        onOpenDetail(firstTask.id);
      }
    }
  };

  return (
    <div className="view-wrap cal-wrap">
      <div className="cal-toolbar">
        <button
          className="cal-nav"
          onClick={() => moveMonth(-1)}
          aria-label="Previous month"
          title="Previous month"
        >
          <ChevronLeft size={15} strokeWidth={1.8} />
        </button>
        <div className="cal-title">{monthLabel}</div>
        <button
          className="cal-nav"
          onClick={() => moveMonth(1)}
          aria-label="Next month"
          title="Next month"
        >
          <ChevronRight size={15} strokeWidth={1.8} />
        </button>
        <button
          className="cal-today-btn"
          onClick={() => {
            const d = new Date();
            d.setDate(1);
            setAnchor(d);
            setFocused(todayYMD());
          }}
        >
          <CalIcon size={13} strokeWidth={1.8} />
          Today
        </button>
      </div>

      {noDate.length > 0 && (
        <div className="cal-nodate">
          <span className="cal-nodate-label">No date</span>
          <div className="cal-nodate-list">
            {noDate.slice(0, 8).map((t) => (
              <div
                key={t.id}
                className={cn(
                  "cal-nodate-chip",
                  t.completed && "is-done"
                )}
                title={t.title}
              >
                <Checkbox
                  size="sm"
                  checked={t.completed}
                  onToggle={() => toggle(t.id)}
                  ariaLabel={t.completed ? `Mark ${t.title} as not done` : `Mark ${t.title} as done`}
                />
                {PRIORITY_COLOR[t.priority] && (
                  <ColorDot color={PRIORITY_COLOR[t.priority]!} size="sm" />
                )}
                <button
                  type="button"
                  className="cal-nodate-title"
                  onClick={() => onOpenDetail(t.id)}
                >
                  {t.title}
                </button>
              </div>
            ))}
            {noDate.length > 8 && (
              <span className="cal-nodate-more">
                +{noDate.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="cal-scroll">
        <div
          ref={gridRef}
          className="cal-grid"
          role="grid"
          aria-label={monthLabel}
          onKeyDown={onCalendarKeyDown}
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="cal-dow" role="columnheader">
              {d}
            </div>
          ))}
          {cells.map((c) => {
            const cellTasks = byDay.get(c.ymd) ?? [];
            return (
              <div
                key={c.ymd}
                className={cn(
                  "cal-cell",
                  !c.inMonth && "is-other",
                  c.ymd === today && "is-today",
                  c.ymd === focused && "is-focused"
                )}
                role="gridcell"
                data-date={c.ymd}
                tabIndex={c.ymd === focused ? 0 : -1}
                aria-selected={c.ymd === focused}
                aria-label={`${formatLongDate(c.ymd)}, ${cellTasks.length} ${cellTasks.length === 1 ? "task" : "tasks"}`}
                onClick={() => setFocused(c.ymd)}
                onFocus={() => setFocused(c.ymd)}
              >
                <div className="cal-cell-head">
                  <span
                    className={cn(
                      "cal-cell-num",
                      c.ymd === today && "is-today-num"
                    )}
                  >
                    {c.day}
                  </span>
                  {cellTasks.length > 0 && (
                    <span className="cal-cell-count">{cellTasks.length}</span>
                  )}
                </div>
                <div className="cal-cell-list">
                  {cellTasks.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      className={cn("cal-chip", t.completed && "is-done")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail(t.id);
                      }}
                      title={`${t.title}, ${formatLongDate(t.dueDate!)}`}
                      aria-label={`Open task: ${t.title}, ${formatLongDate(t.dueDate!)}`}
                    >
                      {PRIORITY_COLOR[t.priority] && (
                        <ColorDot
                          color={PRIORITY_COLOR[t.priority]!}
                          size="sm"
                        />
                      )}
                      <span className="cal-chip-title">{t.title}</span>
                    </button>
                  ))}
                  {cellTasks.length > 3 && (
                    <div className="cal-chip-more">
                      +{cellTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <QuickAdd />
    </div>
  );
}

interface Cell {
  ymd: string;
  day: number;
  inMonth: boolean;
}

/**
 * Returns 42 cells (6 weeks × 7 days) starting from the Monday on or
 * before the 1st of the anchor month. Six weeks is enough to cover
 * any month layout without an off-by-one in Feb / leap years.
 */
function buildMonthCells(anchor: Date): Cell[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  // 0 = Sunday, 1 = Monday, ... Shift so Monday is column 0.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      ymd: toYMD(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }
  return cells;
}
