import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { saveState } from "@/lib/tauri";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ModalRoot } from "@/components/ModalRoot";
import { TaskList } from "@/components/TaskList";
import { TaskDetail } from "@/components/TaskDetail";
import { CommandPalette } from "@/components/CommandPalette";
import { useTheme } from "@/hooks/useTheme";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { modKey } from "@/utils/keyboard";
import "./App.css";

export default function App() {
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const setView = useStore((s) => s.setView);
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
          theme: s.theme,
          sidebarCollapsed: s.sidebarCollapsed,
          selectedTaskId: s.selectedTaskId,
          detailOpen: s.detailOpen,
          settings: s.settings,
        }).catch((e) => console.error("[persist] save failed", e));
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
        <TaskList onOpenDetail={openDetail} />
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ModalRoot />
      {/* TaskDetail renders via React Portal — overlay modal, no grid allocation. */}
      <TaskDetail onClose={closeDetail} />
    </div>
  );
}
