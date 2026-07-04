import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { saveState } from "@/lib/tauri";
import { ViewMode, DEFAULT_VIEW_MODE } from "@/types";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ModalRoot } from "@/components/ModalRoot";
import { TaskList } from "@/components/TaskList";
import { TaskDetail } from "@/components/TaskDetail";
import { CommandPalette } from "@/components/CommandPalette";
import { KanbanView } from "@/components/views/KanbanView";
import { CalendarView } from "@/components/views/CalendarView";
import { TableView } from "@/components/views/TableView";
import { viewModeForHotkey } from "@/components/ViewModeSwitcher";
import { useTheme } from "@/hooks/useTheme";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { modKey } from "@/utils/keyboard";
import "./App.css";

export default function App() {
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const setView = useStore((s) => s.setView);
  const setViewMode = useStore((s) => s.setViewMode);
  const viewMode = useStore((s) => s.viewMode) ?? DEFAULT_VIEW_MODE;
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const openDetail = useStore((s) => s.openDetail);
  const closeDetail = useStore((s) => s.closeDetail);
  const theme = useStore((s) => s.theme);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [, toggleTheme] = useTheme();
  const openSettings = () => useStore.getState().openModal("settings");

  // Persist on change (debounced)
  useEffect(() => {
    let timer: number | undefined;
    const unsub = useStore.subscribe(() => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const s = useStore.getState();
        saveState({
          projects: s.projects,
          labels: s.labels,
          tasks: s.tasks,
          view: s.view,
          viewMode: s.viewMode,
          theme: s.theme,
          sidebarCollapsed: s.sidebarCollapsed,
          selectedTaskId: s.selectedTaskId,
          detailOpen: s.detailOpen,
          settings: s.settings,
        })
          .then((err) => {
            if (err) console.error("[persist] save failed", err);
          })
          .catch((e) => console.error("[persist] save failed", e));
      }, 220);
    });
    return () => {
      unsub();
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    [`${modKey()}+k`]: () => setPaletteOpen(true),
    [`${modKey()}+b`]: () => toggleSidebar(),
    [`${modKey()}+,`]: () => openSettings(),
    [`${modKey()}+shift+l`]: () => toggleTheme(),
    [`${modKey()}+n`]: () => {
      const el = document.querySelector<HTMLInputElement>("[data-quickadd-input]");
      el?.focus();
    },
    // View-mode shortcuts: Ctrl/Cmd + Alt + <digit 1..4>.
    // We register them explicitly (rather than via a loop) so each
    // combo is statically visible to the shortcut engine. The
    // `viewModeForHotkey` helper is statically exhaustive for 1..4
    // (the lookup is by the same hotkey string in VIEW_MODE_DEFS),
    // so the non-null assertion is safe — any out-of-range digit
    // would simply not match any handler in the shortcut engine.
    [`${modKey()}+alt+1`]: () => setViewMode(viewModeForHotkey(1)!),
    [`${modKey()}+alt+2`]: () => setViewMode(viewModeForHotkey(2)!),
    [`${modKey()}+alt+3`]: () => setViewMode(viewModeForHotkey(3)!),
    [`${modKey()}+alt+4`]: () => setViewMode(viewModeForHotkey(4)!),
    "g i": () => setView({ kind: "inbox" }),
    "g t": () => setView({ kind: "today" }),
    "g u": () => setView({ kind: "upcoming" }),
    "g a": () => setView({ kind: "all" }),
    "g c": () => setView({ kind: "completed" }),
    "/": () => setPaletteOpen(true),
    escape: () => {
      // ModalRoot and DatePicker own their own Esc handlers. Don't fight them here.
      if (useStore.getState().modal) return;
      closeDetail();
      setPaletteOpen(false);
    },
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app" data-collapsed={sidebarCollapsed}>
      <Sidebar onOpenCommand={() => setPaletteOpen(true)} />
      <Header onOpenCommand={() => setPaletteOpen(true)} />
      <main className="area-main">
        <ViewDispatcher viewMode={viewMode} onOpenDetail={openDetail} />
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ModalRoot />
      {/* TaskDetail renders via React Portal — overlay modal, no grid allocation. */}
      <TaskDetail onClose={closeDetail} />
    </div>
  );
}

/**
 * Renders one of the four view components based on `viewMode`. Lives in
 * App.tsx so the ViewModeSwitcher in the Header can be the single
 * source of truth for which layout is active.
 */
function ViewDispatcher({
  viewMode,
  onOpenDetail,
}: {
  viewMode: ViewMode;
  onOpenDetail: (id: string) => void;
}) {
  switch (viewMode) {
    case "list":
      return <TaskList onOpenDetail={onOpenDetail} />;
    case "kanban":
      return <KanbanView onOpenDetail={onOpenDetail} />;
    case "calendar":
      return <CalendarView onOpenDetail={onOpenDetail} />;
    case "table":
      return <TableView onOpenDetail={onOpenDetail} />;
    default:
      return <TaskList onOpenDetail={onOpenDetail} />;
  }
}
