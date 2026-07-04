import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  ArrowDownUp,
  Settings as SettingsIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useStore } from "@/store";
import { View, Task, SortMode } from "@/types";
import { cn } from "@/utils/cn";
import { modKey } from "@/utils/keyboard";
import { addDays, todayYMD } from "@/utils/dates";
import { ViewModeSwitcher } from "./ViewModeSwitcher";
import "./Header.css";

interface HeaderProps {
  onOpenCommand: () => void;
}

const SORT_DESCRIPTIONS: Record<SortMode, { label: string; hint: string }> = {
  smart: { label: "Smart", hint: "Priority \u2192 due \u2192 manual" },
  due: { label: "Due date", hint: "Soonest first" },
  alpha: { label: "Alphabetical", hint: "A \u2192 Z" },
  manual: { label: "Manual", hint: "Drag to order" },
};

export function Header(_: HeaderProps) {
  const view = useStore((s) => s.view);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const labels = useStore((s) => s.labels);
  const sortMode = useStore((s) => s.settings.sortMode);
  const setSettings = useStore((s) => s.setSettings);
  const openModal = useStore((s) => s.openModal);

  const { title, subtitle, counter, accent } = useMemo(
    () => describeView(view, tasks, projects, labels),
    [view, tasks, projects, labels]
  );

  const mk = modKey() === "cmd" ? "\u2318" : "Ctrl";

  return (
    <header className="area-header header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
        {subtitle && <span className="header-subtitle">{subtitle}</span>}
        <span className="header-counter" data-accent={accent}>
          {counter}
        </span>
      </div>

      <div className="header-right">
        <ViewModeSwitcher />
        <button
          className="icon-btn"
          onClick={() => {
            const el = document.querySelector<HTMLInputElement>("[data-quickadd-input]");
            el?.focus();
          }}
          title={`New task (${mk}+N)`}
        >
          <Sparkles size={15} strokeWidth={1.8} />
          <span>New task</span>
          <kbd className="kbd kbd-inline">{mk} N</kbd>
        </button>
        <SortPopover
          current={sortMode}
          onChange={(m) => setSettings({ sortMode: m })}
        />
        <button
          className="icon-btn subtle"
          title={`Settings (${mk}+,)`}
          aria-label="Settings"
          onClick={() => openModal("settings")}
        >
          <SettingsIcon size={15} strokeWidth={1.8} />
          <kbd className="kbd kbd-inline">{mk} ,</kbd>
        </button>
      </div>
    </header>
  );
}

/* ─── Sort popover ────────────────────────────────────────────────── *
 * Opens a small menu under the Sort button and lets the user pick one of
 * four sort modes. Active mode is highlighted. Closes on Esc, outside
 * click, or selection.
 */
function SortPopover({
  current,
  onChange,
}: {
  current: SortMode;
  onChange: (m: SortMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Reposition on open so the popover lands right under the button.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ left: r.left, top: r.bottom + 6 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Outside click + Escape close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Use stopImmediatePropagation (not just stopPropagation) so the
        // ModalRoot's useEscapeToClose listener on the same target doesn't
        // also fire — otherwise hitting Esc while a modal is open and the
        // sort popover is also open closes both.
        e.stopImmediatePropagation();
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        className={cn("icon-btn", "subtle", "sort-trigger")}
        title={`Sort: ${SORT_DESCRIPTIONS[current].label} \u2014 click to change`}
        aria-label={`Sort by ${SORT_DESCRIPTIONS[current].label}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ArrowDownUp size={15} strokeWidth={1.8} />
        <span className="sort-trigger-label">{SORT_DESCRIPTIONS[current].label}</span>
      </button>
      {open && pos &&
        createPortal(
          <div
            ref={menuRef}
            className="sort-popover pop-in"
            style={{ left: pos.left, top: pos.top }}
            role="menu"
          >
            {(Object.keys(SORT_DESCRIPTIONS) as SortMode[]).map((m) => (
              <button
                key={m}
                role="menuitemradio"
                aria-checked={current === m}
                className={cn("sort-menu-item", current === m && "active")}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
              >
                <span className="sort-menu-label">{SORT_DESCRIPTIONS[m].label}</span>
                <span className="sort-menu-hint">{SORT_DESCRIPTIONS[m].hint}</span>
                {current === m && <span className="sort-menu-check" aria-hidden />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

interface HeaderInfo {
  title: string;
  subtitle?: string;
  counter: string;
  accent?: "today" | "overdue";
}

// Single source of truth for the "today" / "in7Days" / "open" predicates
// used by every view-derived counter. Sidebar.tsx and TaskList.tsx use
// inline copies of the same expressions; keeping the Header's copy
// identical here is what makes the badge, the pane counter, and the
// keyboard-route counters agree.
function describeView(
  view: View,
  tasks: Task[],
  projects: { id: string; name: string }[],
  labels: { id: string; name: string }[]
): HeaderInfo {
  const todayISO = todayYMD();
  const in7DaysISO = addDays(todayISO, 7);
  const open = (t: Task) => !t.completed;

  switch (view.kind) {
    case "inbox":
      return {
        title: "Inbox",
        subtitle: "Everything without a home yet.",
        counter: `${tasks.filter((t) => open(t) && !t.projectId).length} tasks`,
      };
    case "today": {
      const todays = tasks.filter((t) => open(t) && t.dueDate === todayISO);
      const overdue = tasks.filter(
        (t) => open(t) && t.dueDate !== null && t.dueDate < todayISO
      ).length;
      const accent = overdue ? "overdue" : "today";
      // The split "X today · Y overdue" is intentional — the Header
      // counter is the only surface that surfaces both halves
      // distinctly. The sum equals the unified `dueDate <= today`
      // count used by Sidebar's today badge and TaskList's today pane,
      // so the badge and pane still match. Adding `!== null` on the
      // overdue filter closes a window where a task with a non-null
      // but truthy `dueDate` could be miscounted.
      const counter = `${todays.length} today${overdue ? ` \u00b7 ${overdue} overdue` : ""}`;
      return { title: "Today", subtitle: dayHeader(), counter, accent };
    }
    case "upcoming":
      // "Upcoming" = open tasks scheduled strictly after today and
      // within the next 7 calendar days (i.e. `today < dueDate <= today+7`).
      // Today itself belongs to the Today view, not Upcoming. Tasks past
      // the 7-day window belong to All-tasks but not Upcoming. This
      // filter is bit-identical to Sidebar.tsx and TaskList.tsx so the
      // Header's "X scheduled" copy stays in lockstep with the badge
      // and the Upcoming pane count.
      return {
        title: "Upcoming",
        subtitle: "The next 7 days.",
        counter: `${tasks.filter(
          (t) =>
            open(t) && t.dueDate !== null && t.dueDate > todayISO && t.dueDate <= in7DaysISO
        ).length} scheduled`,
      };
    case "all":
      return {
        title: "All tasks",
        subtitle: "Everything that's open, anywhere.",
        counter: `${tasks.filter(open).length} tasks`,
      };
    case "completed":
      return {
        title: "Completed",
        subtitle: "Done is good.",
        counter: `${tasks.filter((t) => t.completed).length} tasks`,
      };
    case "project": {
      const p = projects.find((x) => x.id === view.id);
      return {
        title: p?.name ?? "Project",
        counter: `${tasks.filter((t) => open(t) && t.projectId === view.id).length} tasks`,
      };
    }
    case "label": {
      const l = labels.find((x) => x.id === view.id);
      return {
        title: `#${l?.name ?? "label"}`,
        counter: `${tasks.filter((t) => open(t) && t.labelIds.includes(view.id)).length} tasks`,
      };
    }
    case "search":
      return {
        title: "Search",
        subtitle: "Press Ctrl+K anywhere.",
        counter: `${tasks.filter((t) => searchable(t, view.query)).length} matches`,
      };
  }
}

function dayHeader(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function searchable(t: Task, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    t.title.toLowerCase().includes(s) ||
    t.description.toLowerCase().includes(s)
  );
}
