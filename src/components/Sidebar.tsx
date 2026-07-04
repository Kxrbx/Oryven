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
import { addDays, todayYMD } from "@/utils/dates";
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
    const today = todayYMD();
    const sevenDays = addDays(today, 7);
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="-260.98 -226.92 1061.78 1061.78"
              preserveAspectRatio="xMidYMid meet"
              width="16"
              height="16"
            >
              <g fill="#4a69d3">
                <path d="M324.66 820.69 c-7.59 -3.87 -10.78 -16.24 -6.00 -24.11 c1.35 -2.33 10.53 -9.28 21.92 -16.71 c43.72 -28.45 71.39 -53.34 101.77 -91.38 c18.49 -23.05 31.84 -43.77 43.84 -68.03 c9.31 -18.71 27.19 -63.70 25.96 -65.41 c-0.86 -0.92 -27.55 15.62 -38.09 23.66 c-2.69 2.01 -7.59 5.57 -11.02 7.73 c-3.31 2.33 -6.98 5.10 -8.08 6.34 c-0.98 1.24 -2.33 2.16 -2.94 2.16 c-0.98 0.00 -37.11 30.15 -53.27 44.69 c-96.87 86.59 -153.69 122.46 -220.18 139.31 c-27.06 6.81 -40.17 8.19 -68.58 7.27 c-34.53 -0.92 -59.15 -7.11 -84.87 -21.02 c-13.10 -7.11 -16.78 -11.14 -17.88 -19.18 c-0.61 -4.94 -0.12 -6.34 3.55 -10.97 c3.92 -4.94 4.65 -5.25 15.06 -6.19 c44.45 -3.71 67.48 -8.81 99.81 -22.43 c37.47 -15.92 69.93 -36.18 106.54 -66.79 c48.00 -40.05 79.11 -73.30 186.14 -199.30 c91.85 -108.07 123.56 -142.24 172.06 -184.77 c37.23 -32.63 103.97 -76.07 121.36 -79.16 c6.00 -0.92 11.27 2.33 14.45 8.81 c5.51 11.91 -1.96 102.51 -14.08 170.09 c-29.88 165.91 -92.83 297.80 -182.22 381.76 c-19.23 18.09 -28.66 25.52 -50.94 39.89 c-35.64 23.05 -71.03 37.26 -106.91 42.82 c-16.04 2.63 -43.23 3.09 -47.39 0.92"/>
                <path d="M-3.17 718.49 c-15.19 -1.71 -37.11 -7.27 -43.47 -10.97 c-6.98 -4.18 -27.55 -27.53 -42.13 -47.92 c-57.43 -80.55 -91.85 -181.67 -100.30 -294.24 c-2.82 -39.28 -0.98 -99.88 4.41 -139.93 c12.00 -88.75 45.92 -179.98 92.46 -248.16 c13.35 -19.80 42.37 -55.21 57.07 -69.88 c66.01 -66.17 141.69 -105.14 227.53 -117.21 c35.39 -5.10 87.07 -2.94 122.46 4.80 c159.69 35.25 285.46 175.19 328.81 365.99 c7.47 32.78 6.74 37.10 -7.72 47.62 c-49.23 35.56 -74.33 57.52 -109.72 95.56 c-24.00 25.97 -24.49 26.44 -29.02 26.44 c-2.20 0.00 -5.39 -0.78 -7.10 -1.85 c-5.88 -3.25 -6.98 -7.89 -8.20 -30.62 c-1.96 -41.28 -6.61 -66.34 -18.98 -102.98 c-11.76 -34.95 -28.17 -65.10 -51.31 -94.16 c-53.64 -67.41 -130.05 -98.34 -206.59 -83.50 c-61.35 11.75 -118.30 53.64 -155.89 114.42 c-55.60 89.98 -65.88 211.83 -26.45 313.71 c18.49 47.78 45.43 87.06 81.56 118.75 c24.74 21.81 62.09 41.90 92.21 49.94 c5.76 1.54 12.25 9.12 13.23 15.46 c1.84 12.37 -5.63 20.87 -33.19 38.35 c-65.03 41.13 -121.60 57.06 -179.65 50.41"/>
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
