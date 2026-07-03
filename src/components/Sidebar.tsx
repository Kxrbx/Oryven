import { useMemo } from "react";
import {
  Inbox,
  Sun,
  CalendarDays,
  ListTodo,
  CheckCheck,
  Plus,
  PanelLeftClose,
  Moon,
  Search,
} from "lucide-react";
import { useStore } from "@/store";
import { View } from "@/types";
import { ColorDot } from "./ColorDot";
import { ProjectMarker } from "./ProjectMarker";
import { TodayWidget } from "./TodayWidget";
import { cn } from "@/utils/cn";
import "./Sidebar.css";

interface SidebarProps {
  onOpenCommand: () => void;
}

interface ViewDef {
  kind: View["kind"];
  label: string;
  Icon: React.ElementType;
  match: (v: View) => boolean;
  countable: boolean;
}

const VIEWS: ViewDef[] = [
  { kind: "inbox", label: "Inbox", Icon: Inbox, match: (v) => v.kind === "inbox", countable: true },
  { kind: "today", label: "Today", Icon: Sun, match: (v) => v.kind === "today", countable: true },
  {
    kind: "upcoming",
    label: "Upcoming",
    Icon: CalendarDays,
    match: (v) => v.kind === "upcoming",
    countable: true,
  },
  { kind: "all", label: "All tasks", Icon: ListTodo, match: (v) => v.kind === "all", countable: true },
  { kind: "completed", label: "Completed", Icon: CheckCheck, match: (v) => v.kind === "completed", countable: true },
];

export function Sidebar({ onOpenCommand }: SidebarProps) {
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggle = useStore((s) => s.toggleSidebar);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const projects = useStore((s) => s.projects);
  const labels = useStore((s) => s.labels);
  const tasks = useStore((s) => s.tasks);
  const openModal = useStore((s) => s.openModal);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  // Counters share one definition of "today": `dueDate <= today && open`
  // (overdue + today, open). This matches the Today list view in
  // TaskList and the Today widget math, so the same value appears on
  // sidebar badges, the main pane, and the widget.
  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const open = (t: typeof tasks[number]) => !t.completed;
    return {
      inbox: tasks.filter((t) => open(t) && !t.projectId).length,
      today: tasks.filter(
        (t) => open(t) && t.dueDate !== null && t.dueDate <= today
      ).length,
      upcoming: tasks.filter(
        (t) => open(t) && t.dueDate && t.dueDate > today && t.dueDate <= sevenDays
      ).length,
      all: tasks.filter(open).length,
      completed: tasks.filter((t) => t.completed).length,
    } as Record<"inbox" | "today" | "upcoming" | "all" | "completed", number>;
  }, [tasks]);

  const projectCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of tasks) {
      if (!t.completed && t.projectId) {
        c.set(t.projectId, (c.get(t.projectId) ?? 0) + 1);
      }
    }
    return c;
  }, [tasks]);

  const labelCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of tasks) {
      if (!t.completed) {
        for (const lid of t.labelIds) c.set(lid, (c.get(lid) ?? 0) + 1);
      }
    }
    return c;
  }, [tasks]);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.order - b.order),
    [projects]
  );
  const sortedLabels = useMemo(
    () => [...labels].sort((a, b) => a.order - b.order),
    [labels]
  );

  return (
    <aside className={cn("area-sidebar", "sidebar", collapsed && "collapsed")}>
      <div className="sidebar-top">
        <button
          className="sidebar-brand"
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="brand-mark" aria-hidden>
            <svg viewBox="0 0 16 16" width="16" height="16">
              <circle cx="8" cy="8" r="6" fill="var(--accent)" />
              <circle cx="8" cy="8" r="2.5" fill="var(--bg)" />
            </svg>
          </span>
          {!collapsed && <span className="brand-label">Oryven</span>}
        </button>

        <button className="sidebar-search" onClick={onOpenCommand} title="Search (Ctrl+K)">
          <Search size={14} strokeWidth={2.2} />
          {!collapsed && (
            <>
              <span className="search-placeholder">Search</span>
              <kbd className="kbd">Ctrl K</kbd>
            </>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="sidebar-today-slot">
          <TodayWidget />
        </div>
      )}

      <nav className="sidebar-views">
        {VIEWS.map(({ kind, label, Icon, match, countable }) => {
          const active = match(view);
          return (
            <button
              key={kind}
              className={cn("nav-item", active && "active")}
              data-kind={kind}
              onClick={() => setView({ kind } as View)}
              title={collapsed ? label : undefined}
            >
              <Icon size={16} strokeWidth={active ? 2.4 : 1.8} />
              {!collapsed && <span className="nav-label">{label}</span>}
              {!collapsed && countable && (
                <span className="nav-count">{counts[kind as keyof typeof counts] ?? 0}</span>
              )}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <>
          <section className="sidebar-section">
            <header className="section-header">
              <span>Projects</span>
              <button
                className="section-add"
                onClick={() => openModal("project-new")}
                title="New project"
              >
                <Plus size={14} strokeWidth={2.4} />
              </button>
            </header>
            <ul className="section-list">
              {sortedProjects.length === 0 && (
                <li className="section-empty">No projects yet</li>
              )}
              {sortedProjects.map((p) => {
                const active = view.kind === "project" && view.id === p.id;
                const count = projectCounts.get(p.id) ?? 0;
                return (
                  <li key={p.id}>
                    <button
                      className={cn("nav-item", "nav-item-project", active && "active")}
                      onClick={() => setView({ kind: "project", id: p.id })}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openModal("project-edit", { projectId: p.id });
                      }}
                    >
                      <ProjectMarker color={p.color} emoji={p.emoji} size="sm" />
                      <span className="nav-label">{p.name}</span>
                      <span className="nav-count">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="sidebar-section">
            <header className="section-header">
              <span>Labels</span>
              <button
                className="section-add"
                onClick={() => openModal("label-new")}
                title="New label"
              >
                <Plus size={14} strokeWidth={2.4} />
              </button>
            </header>
            <ul className="section-list">
              {sortedLabels.length === 0 && (
                <li className="section-empty">No labels yet</li>
              )}
              {sortedLabels.map((l) => {
                const active = view.kind === "label" && view.id === l.id;
                const count = labelCounts.get(l.id) ?? 0;
                return (
                  <li key={l.id}>
                    <button
                      className={cn("nav-item", "nav-item-label", active && "active")}
                      onClick={() => setView({ kind: "label", id: l.id })}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openModal("label-edit", { labelId: l.id });
                      }}
                    >
                      <ColorDot color={l.color} size="sm" />
                      <span className="nav-label">{l.name}</span>
                      <span className="nav-count">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <footer className="sidebar-foot">
        <button
          className={cn("nav-item", "sidebar-foot-btn")}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? (
            <Sun size={15} strokeWidth={1.8} />
          ) : (
            <Moon size={15} strokeWidth={1.8} />
          )}
          {!collapsed && <span className="nav-label">{theme === "dark" ? "Light" : "Dark"}</span>}
        </button>
        <button
          className="nav-item sidebar-foot-btn"
          onClick={toggle}
          title={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
        >
          <PanelLeftClose size={15} strokeWidth={1.8} />
          {!collapsed && <span className="nav-label">Collapse</span>}
        </button>
      </footer>
    </aside>
  );
}
