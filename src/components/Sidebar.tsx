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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254" width="16" height="16">
              <g fill="#4a69d3">
                <path d="M708.44 1011.53 c-7.59 -3.06 -10.78 -12.86 -6 -19.10 1.35 -1.84 10.53 -7.35 21.92 -13.23 43.72 -22.53 71.39 -42.25 101.77 -72.37 18.49 -18.25 31.84 -34.66 43.84 -53.88 9.31 -14.82 27.19 -50.45 25.96 -51.80 -0.86 -0.73 -27.55 12.37 -38.09 18.74 -2.69 1.59 -7.59 4.41 -11.02 6.12 -3.31 1.84 -6.98 4.04 -8.08 5.02 -0.98 0.98 -2.33 1.71 -2.94 1.71 -0.98 0 -37.11 23.88 -53.27 35.39 -96.87 68.58 -153.69 96.99 -220.18 110.34 -27.06 5.39 -40.17 6.49 -68.58 5.76 -34.53 -0.73 -59.15 -5.63 -84.87 -16.65 -13.10 -5.63 -16.78 -8.82 -17.88 -15.19 -0.61 -3.92 -0.12 -5.02 3.55 -8.69 3.92 -3.92 4.65 -4.16 15.06 -4.90 44.45 -2.94 67.48 -6.98 99.81 -17.76 37.47 -12.61 69.93 -28.66 106.54 -52.90 48 -31.72 79.11 -58.05 186.14 -157.85 91.85 -85.60 123.56 -112.66 172.06 -146.34 37.23 -25.84 103.97 -60.25 121.36 -62.70 6 -0.73 11.27 1.84 14.45 6.98 5.51 9.43 -1.96 81.19 -14.08 134.71 -29.88 131.40 -92.83 235.86 -182.22 302.36 -19.23 14.33 -28.66 20.21 -50.94 31.59 -35.64 18.25 -71.03 29.51 -106.91 33.92 -16.04 2.08 -43.23 2.45 -47.39 0.73z" />
                <path d="M380.61 930.58 c-15.19 -1.35 -37.11 -5.76 -43.47 -8.69 -6.98 -3.31 -27.55 -21.80 -42.13 -37.96 -57.43 -63.80 -91.85 -143.89 -100.30 -233.04 -2.82 -31.11 -0.98 -79.11 4.41 -110.83 12 -70.29 45.92 -142.54 92.46 -196.55 13.35 -15.68 42.37 -43.72 57.07 -55.35 66.01 -52.41 141.69 -83.27 227.53 -92.83 35.39 -4.04 87.07 -2.33 122.46 3.80 159.69 27.92 285.46 138.75 328.81 289.87 7.47 25.96 6.74 29.39 -7.72 37.72 -49.23 28.17 -74.33 45.56 -109.72 75.68 -24 20.57 -24.49 20.94 -29.02 20.94 -2.20 0 -5.39 -0.61 -7.10 -1.47 -5.88 -2.57 -6.98 -6.25 -8.20 -24.25 -1.96 -32.70 -6.61 -52.54 -18.98 -81.56 -11.76 -27.68 -28.17 -51.56 -51.31 -74.58 -53.64 -53.39 -130.05 -77.89 -206.59 -66.13 -61.35 9.31 -118.30 42.49 -155.89 90.62 -55.60 71.27 -65.88 167.77 -26.45 248.47 18.49 37.84 45.43 68.95 81.56 94.05 24.74 17.27 62.09 33.19 92.21 39.55 5.76 1.22 12.25 7.23 13.23 12.25 1.84 9.80 -5.63 16.53 -33.19 30.37 -65.03 32.57 -121.60 45.19 -179.65 39.92z" />
              </g>
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
