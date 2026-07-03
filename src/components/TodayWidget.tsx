import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ListChecks } from "lucide-react";
import { useStore } from "@/store";
import { Task, ID } from "@/types";
import { todayYMD, addDays, formatLongDate, formatRelativeDate, formatRelativeFrom } from "@/utils/dates";
import { cn } from "@/utils/cn";
import "./TodayWidget.css";

/**
 * The "Today" widget: a compact, always-visible sidebar card that shows
 * (a) how many tasks are due today and how many of them I've already done,
 * (b) my completion-rate bar chart for the last seven days.
 *
 * Click anywhere on the card → toggles a popover anchored to the right
 * of the widget. The popover reveals the underlying task list partitioned
 * into three buckets: Overdue / Due today / Completed today. Clicking a
 * task opens that task's detail view. There's also a footer that jumps
 * straight to the /today list (preserves the previous "click widget =
 * navigate" affordance in case the user just wants the list view).
 */
export function TodayWidget() {
  const tasks = useStore((s) => s.tasks);
  const setView = useStore((s) => s.setView);
  const openDetail = useStore((s) => s.openDetail);

  const [open, setOpen] = useState(false);

  // `today` is stable for the session — only flips when the user crosses
  // midnight, which is rare enough that we can pay the once-per-session
  // filter cost. Hoisting it via useState (not useMemo) means the filter
  // results below stay referentially stable across renders, so consumers
  // downstream of the memoised arrays don't re-key on every keystroke.
  // We watch `visibilitychange` so a user who leaves the app open past
  // midnight gets a re-filtered popover the moment the window regains
  // focus — same UX as if they reloaded.
  const [today, setToday] = useState(todayYMD);
  useEffect(() => {
    const onVis = () => {
      const next = todayYMD();
      setToday((prev) => (prev === next ? prev : next));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Last 7 days, oldest leftmost. `[i]` is today when `i === 6`.
  const days = useMemo(() => {
    const today = todayYMD();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  }, []);

  // Count of completed tasks per day (today is `counts[6]`).
  // The sparkline measures *completion activity* per day, regardless of
  // when each task was due. That's a different story from the big-numeral
  // pair — see `dueTodayTasks` below for the constrained-scope math.
  const counts = useMemo(
    () =>
      days.map((d) =>
        tasks.filter(
          (t) => t.completed && (t.completedAt ?? "").slice(0, 10) === d
        ).length
      ),
    [days, tasks]
  );

  // Both the numerator (done) and the denominator (due) reference the
  // same "today plan" scope: open OR closed tasks with `dueDate <= today`
  // (overdue + today). That matches Sidebar's Today count and the
  // TaskList today view so the three counters tell one consistent story.
  const dueTodayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate !== null && t.dueDate <= today),
    [tasks, today]
  );
  const dueToday = dueTodayTasks.length;
  const doneToday = dueTodayTasks.filter((t) => t.completed).length;
  // `open` = scope total − done. Always ≥ 0 — the same scope guarantees it.
  const openToday = dueToday - doneToday;

  // Three buckets for the popover body. Each is independently sorted so
  // the most actionable row surfaces first:
  //   overdue        — oldest first (most-neglected tasks win attention)
  //   due today      — by manual order then id so the same input order is
  //                     preserved across reorders
  //   completed today — most recent completion first ("fresh wins" feel)
  const overdueTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.completed && t.dueDate !== null && t.dueDate < today)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  }, [tasks, today]);

  const dueTodayOpenTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.completed && t.dueDate === today)
      .sort(sortByManualOrder);
  }, [tasks, today]);

  const completedTodayTasks = useMemo(() => {
    return tasks
      .filter((t) => t.completed && (t.completedAt ?? "").slice(0, 10) === today)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  }, [tasks, today]);

  // Sparkline scaling: tallest bar = max(counts, 1) so an all-zero week
  // still shows visible bars (not invisible).
  const maxCount = Math.max(1, ...counts);

  // Hover tooltip previewing the breakdown so users get "X of Y today"
  // *and* the underlying "due / done / open" decomposition in one glance
  // without waiting for the popover to open.
  const breakdown =
    dueToday === 0
      ? "No tasks due today"
      : `${dueToday} due · ${doneToday} done · ${openToday} open`;

  const label = `${doneToday} of ${dueToday} done today — click for breakdown`;

  return (
    <>
      <button
        type="button"
        className={cn("today-widget", open && "is-open")}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        title={breakdown}
        data-tw-trigger
        onClick={() => setOpen((v) => !v)}
      >
        <div className="tw-nums">
          <span className="tw-done">{doneToday}</span>
          <span className="tw-sep">/</span>
          <span className="tw-total">{dueToday}</span>
          <span className="tw-cap">today</span>
        </div>

        <Sparkline counts={counts} max={maxCount} />
      </button>

      {open && (
        <TodayPopover
          today={today}
          overdueTasks={overdueTasks}
          dueTodayOpenTasks={dueTodayOpenTasks}
          completedTodayTasks={completedTodayTasks}
          onOpenTask={(id) => {
            openDetail(id);
            setOpen(false);
          }}
          onViewAll={() => {
            setView({ kind: "today" });
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* ─── Inline sparkline ──────────────────────────────────────────── */

interface SparklineProps {
  counts: number[];
  max: number;
}

function Sparkline({ counts, max }: SparklineProps) {
  return (
    <div className="tw-spark" aria-hidden>
      {counts.map((c, i) => {
        const isToday = i === counts.length - 1;
        const heightPct = c === 0 ? 14 : Math.max(20, 100 * Math.sqrt(c / max));
        return (
          <span
            key={i}
            className={cn("tw-bar", isToday && "is-today")}
            style={{
              height: `${heightPct}%`,
              opacity: c === 0 ? 0.3 : isToday ? 1 : Math.max(0.45, 0.8 * Math.sqrt(c / max)),
            }}
            data-day-count={c}
          />
        );
      })}
    </div>
  );
}

/* ─── Popover ────────────────────────────────────────────────────── *
 * Renders via React Portal so it escapes any stacking context inside
 * .area-sidebar and follows the same fixed-position-with-anchor pattern
 * used by SortPopover. Anchored to the right of the widget (sidebar is
 * the leftmost column, so the popover extends right into the main pane).
 */

interface TodayPopoverProps {
  today: string;
  overdueTasks: Task[];
  dueTodayOpenTasks: Task[];
  completedTodayTasks: Task[];
  onOpenTask: (id: ID) => void;
  onViewAll: () => void;
  onClose: () => void;
}

function TodayPopover({
  today,
  overdueTasks,
  dueTodayOpenTasks,
  completedTodayTasks,
  onOpenTask,
  onViewAll,
  onClose,
}: TodayPopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // The widget button is the implicit anchor — we don't have a ref to
  // it because React doesn't expose siblings' refs, but we can read its
  // bounding rect via querySelector. We use [data-tw-trigger] as a stable
  // hook. (See the JSX below — we attach that attr to the button.)
  useEffect(() => {
    const place = () => {
      const anchor = document.querySelector<HTMLElement>("[data-tw-trigger]");
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      // Anchor to the right edge of the widget, vertically aligned with
      // the widget's top. 8px gap matches the 6-8px used elsewhere in
      // SortPopover / DatePicker; on narrow viewports the panel falls
      // back to its CSS-level clamp via min/max width.
      setPos({
        left: Math.min(window.innerWidth - 360, r.right + 8),
        top: r.top,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, []);

  // Outside click + Escape close. focus-trap is intentionally light:
  // we restore focus to the widget on close so keyboard users land back
  // where they triggered the popover from. Inside the panel, Tab cycles
  // naturally through the action buttons / task rows — no manual
  // jailhouse. We're not a modal; we're a *menu*.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      // Don't close if the click was on the trigger itself (the button
      // already toggles open, so it'd just re-open).
      if ((e.target as HTMLElement)?.closest?.("[data-tw-trigger]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Restore focus to the widget button on unmount so keyboard users
  // don't get stranded. We capture the trigger element via the data attr
  // before tear-down in case the node is gone.
  useEffect(() => {
    return () => {
      // Run on unmount of the popover itself.
      const anchor = document.querySelector<HTMLElement>("[data-tw-trigger]");
      anchor?.focus({ preventScroll: true });
    };
  }, []);

  const totalCount =
    overdueTasks.length + dueTodayOpenTasks.length + completedTodayTasks.length;
  const popoverLabel = `Today's tasks: ${overdueTasks.length} overdue, ${dueTodayOpenTasks.length} due today, ${completedTodayTasks.length} completed today`;

  return createPortal(
    <div
      ref={panelRef}
      className="tw-popover pop-in"
      style={pos ? { left: pos.left, top: pos.top } : undefined}
      role="menu"
      aria-label={popoverLabel}
      // tabIndex=-1 so the panel can receive programmatic focus on open
      // without being part of the natural Tab order — the focus order
      // inside the panel is the row buttons / view-all button.
      tabIndex={-1}
    >
      <header className="tw-popover-head">
        <span className="tw-popover-title">Today</span>
        <span className="tw-popover-date">{formatLongDate(today)}</span>
        <span className="tw-popover-count">
          {dueTodayOpenTasks.length + completedTodayTasks.length} of {dueTodayOpenTasks.length + overdueTasks.length + completedTodayTasks.length}
        </span>
      </header>

      {totalCount === 0 ? (
        <div className="tw-popover-empty">
          <ListChecks size={20} strokeWidth={1.6} />
          <p>Nothing scheduled today.</p>
          <span>Open day — use it deliberately or just breathe.</span>
        </div>
      ) : (
        <>
          <Bucket
            label="Overdue"
            accent="overdue"
            tasks={overdueTasks}
            renderRight={(t) => (
              <span className="tw-row-date" title={formatLongDate(t.dueDate!)}>
                {formatRelativeDate(t.dueDate!)}
              </span>
            )}
            onOpenTask={onOpenTask}
          />
          <Bucket
            label="Due today"
            accent="today"
            tasks={dueTodayOpenTasks}
            renderRight={() => <span className="tw-row-date tw-row-date-today">today</span>}
            onOpenTask={onOpenTask}
          />
          <Bucket
            label="Completed today"
            accent="done"
            tasks={completedTodayTasks}
            renderRight={(t) =>
              t.completedAt ? (
                <span
                  className="tw-row-date tw-row-date-done"
                  title={new Date(t.completedAt).toLocaleString()}
                >
                  {formatRelativeFrom(t.completedAt)}
                </span>
              ) : null
            }
            onOpenTask={onOpenTask}
            done
          />
        </>
      )}

      <footer className="tw-popover-foot">
        <button
          type="button"
          className="tw-popover-viewall"
          onClick={onViewAll}
          disabled={
            overdueTasks.length === 0 &&
            dueTodayOpenTasks.length === 0 &&
            completedTodayTasks.length === 0
          }
        >
          Open Today view
          <ArrowUpRight size={13} strokeWidth={2.2} />
        </button>
      </footer>
    </div>,
    document.body
  );
}

/* ─── Bucket ─────────────────────────────────────────────────────── */

interface BucketProps {
  label: string;
  accent: "overdue" | "today" | "done";
  tasks: Task[];
  renderRight: (t: Task) => React.ReactNode;
  onOpenTask: (id: ID) => void;
  done?: boolean;
}

function Bucket({ label, accent, tasks, renderRight, onOpenTask, done }: BucketProps) {
  return (
    <section className={cn("tw-bucket", `tw-bucket-${accent}`)}>
      <header className="tw-bucket-head">
        <span className="tw-bucket-label">{label}</span>
        <span className="tw-bucket-count">{tasks.length}</span>
      </header>
      {tasks.length === 0 ? (
        <p className="tw-bucket-empty">—</p>
      ) : (
        <ul className="tw-bucket-list">
          {tasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={cn("tw-row", done && "is-done")}
                role="menuitem"
                onClick={() => onOpenTask(t.id)}
              >
                <span className="tw-row-title">{t.title}</span>
                {renderRight(t)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function sortByManualOrder(a: Task, b: Task): number {
  // Within the same scope (`today`-only), preserve the user's relative
  // ordering. We don't have an `order` field exposed on Task here, so
  // fall back to id comparison — stable, idempotent, deterministic across
  // renders.
  return a.id.localeCompare(b.id);
}
