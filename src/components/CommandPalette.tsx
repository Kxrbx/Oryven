import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ArrowRight,
  Inbox,
  Sun,
  CalendarDays,
  ListTodo,
  CheckCheck,
  SunMoon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  FolderPlus,
  Tag,
  Settings as SettingsIcon,
  Moon,
} from "lucide-react";
import { useStore } from "@/store";
import { ColorDot } from "./ColorDot";
import { cn } from "@/utils/cn";
import "./CommandPalette.css";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  type: "task" | "project" | "label" | "command" | "view";
  title: string;
  hint?: string;
  action: () => void;
  score: number;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const labels = useStore((s) => s.labels);
  const setView = useStore((s) => s.setView);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const setTheme = useStore((s) => s.setTheme);
  const theme = useStore((s) => s.theme);
  const openDetail = useStore((s) => s.openDetail);
  const openModal = useStore((s) => s.openModal);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const settings = useStore((s) => s.settings);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.toLowerCase().trim();
    const score = (s: string) => {
      if (!q) return 1;
      const idx = s.toLowerCase().indexOf(q);
      if (idx < 0) return 0;
      // Earlier is better, exact start is best.
      return 100 - idx;
    };

    const out: PaletteItem[] = [];

    // Tasks
    for (const t of tasks) {
      if (t.completed) continue;
      const s = score(t.title);
      if (s > 0) {
        out.push({
          id: "t-" + t.id,
          type: "task",
          title: t.title,
          hint: t.dueDate ? new Date(t.dueDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : undefined,
          action: () => {
            openDetail(t.id);
            onClose();
          },
          score: s,
        });
      }
    }

    // Projects
    for (const p of projects) {
      const s = score(p.name);
      if (s > 0) {
        out.push({
          id: "p-" + p.id,
          type: "project",
          title: p.name,
          action: () => {
            setView({ kind: "project", id: p.id });
            onClose();
          },
          score: s,
        });
      }
    }

    // Labels
    for (const l of labels) {
      const s = score(l.name);
      if (s > 0) {
        out.push({
          id: "l-" + l.id,
          type: "label",
          title: "#" + l.name,
          action: () => {
            setView({ kind: "label", id: l.id });
            onClose();
          },
          score: s,
        });
      }
    }

    // Views
    const views: Array<{ name: string; icon: any; target: any }> = [
      { name: "Inbox", icon: Inbox, target: { kind: "inbox" } },
      { name: "Today", icon: Sun, target: { kind: "today" } },
      { name: "Upcoming", icon: CalendarDays, target: { kind: "upcoming" } },
      { name: "All tasks", icon: ListTodo, target: { kind: "all" } },
      { name: "Completed", icon: CheckCheck, target: { kind: "completed" } },
    ];
    for (const v of views) {
      const s = score(v.name);
      if (s > 0) {
        out.push({
          id: "v-" + v.name,
          type: "view",
          title: v.name,
          action: () => {
            setView(v.target);
            onClose();
          },
          score: s,
        });
      }
    }

    // Commands (always present)
    if (!q || score("settings") > 0 || score("preferences") > 0) {
      out.push({
        id: "c-settings",
        type: "command",
        title: "Open settings…",
        action: () => {
          openModal("settings");
          onClose();
        },
        score: q ? score("settings") : 1,
      });
    }
    if (!q || score("sort") > 0 || score("smart") > 0 || score("alphabetical") > 0 || score("due date") > 0) {
      const modes: Array<["smart" | "due" | "alpha" | "manual", string]> = [
        ["smart", "Sort: Smart"],
        ["due", "Sort: Due date"],
        ["alpha", "Sort: Alphabetical"],
        ["manual", "Sort: Manual (drag)"],
      ];
      for (const [m, label] of modes) {
        if (settings.sortMode === m) continue; // hide the one already active
        const s = q ? score(label) : 1;
        if (s > 0) {
          out.push({
            id: "c-sort-" + m,
            type: "command",
            title: label,
            action: () => {
              useStore.getState().setSettings({ sortMode: m });
              onClose();
            },
            score: s,
          });
        }
      }
    }
    if (!q || score("toggle theme") > 0 || score("light") > 0 || score("dark") > 0 || score("theme") > 0) {
      out.push({
        id: "c-theme",
        type: "command",
        title: `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
        action: () => {
          setTheme(theme === "dark" ? "light" : "dark");
          onClose();
        },
        score: q ? score("theme") : 1,
      });
    }
    if (!q || score("sidebar") > 0 || score("collapse") > 0) {
      out.push({
        id: "c-sidebar",
        type: "command",
        title: sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar",
        action: () => {
          toggleSidebar();
          onClose();
        },
        score: q ? score("sidebar") : 1,
      });
    }
    if (!q || score("new project") > 0) {
      out.push({
        id: "c-nproj",
        type: "command",
        title: "New project…",
        action: () => {
          openModal("project-new");
          onClose();
        },
        score: q ? score("new project") : 1,
      });
    }
    if (!q || score("new label") > 0) {
      out.push({
        id: "c-nlabel",
        type: "command",
        title: "New label…",
        action: () => {
          openModal("label-new");
          onClose();
        },
        score: q ? score("new label") : 1,
      });
    }

    return out.sort((a, b) => b.score - a.score).slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tasks, projects, labels, theme, sidebarCollapsed]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  const closeIfNeeded = () => onClose();

  return (
    <div className="cp-root" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) closeIfNeeded(); }}>
      <div className="cp-backdrop" />
      <div className="cp-card fade-in">
        <div className="cp-search">
          <Search size={15} strokeWidth={1.8} className="cp-search-icon" />
          <input
            ref={inputRef}
            value={query}
            placeholder="Type a command, task, or project…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                items[selectedIndex]?.action();
              }
            }}
          />
        </div>
        <ul className="cp-list" role="listbox">
          {items.length === 0 && (
            <li className="cp-empty">
              <span>No matches</span>
              <span className="cp-hint">Try a different word, like a project name.</span>
            </li>
          )}
          {items.map((it, i) => (
            <li
              key={it.id}
              role="option"
              aria-selected={i === selectedIndex}
              className={cn("cp-item", i === selectedIndex && "active")}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => it.action()}
            >
              <span className="cp-item-prefix">
                {it.type === "task" && (
                  <span className="cp-bullet cp-bullet-task" />
                )}
                {it.type === "project" &&
                  (() => {
                    const p = projects.find((x) => x.id === it.id.slice(2));
                    return p ? <ColorDot color={p.color} size="sm" /> : null;
                  })()}
                {it.type === "label" &&
                  (() => {
                    const l = labels.find((x) => x.id === it.id.slice(2));
                    return l ? <ColorDot color={l.color} size="sm" /> : null;
                  })()}
                {it.type === "view" && <span className="cp-pill">View</span>}
                {it.type === "command" && <span className="cp-pill">Action</span>}
              </span>
              <span className="cp-item-title">{it.title}</span>
              {it.hint && <span className="cp-item-hint">{it.hint}</span>}
              <ArrowRight
                size={12}
                strokeWidth={2}
                className="cp-arrow"
              />
            </li>
          ))}
        </ul>
        <div className="cp-foot">
          <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> navigate</span>
          <span><kbd className="kbd">↵</kbd> select</span>
          <span><kbd className="kbd">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
