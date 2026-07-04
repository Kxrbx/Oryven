// Compact segmented control for switching between view layouts.
// One icon-only button per view mode; the active button lights up
// with the accent. Tooltip on hover + an aria-label per button so
// screen readers announce the layout name and "current" state.
//
// We keep the icons-only treatment here (no labels) because the
// Header is already crowded with the new-task button, sort popover
// and settings button. The Command Palette (Ctrl+K) is the
// keyboard- and text-friendly alternative for users who prefer
// words over glyphs.

import {
  List,
  LayoutGrid,
  CalendarDays,
  Table2,
} from "lucide-react";
import { useStore } from "@/store";
import { ViewMode } from "@/types";
import { cn } from "@/utils/cn";
import { modKey } from "@/utils/keyboard";

interface ViewModeDef {
  id: ViewMode;
  label: string;
  Icon: React.ElementType;
  // Keyboard shortcut suffix when pressed after Ctrl/Cmd+Alt. We use
  // Alt+<digit> to avoid colliding with Ctrl+1..5 (browser tab
  // switching) and Ctrl+Shift+1 (some extensions).
  hotkey: string;
}

export const VIEW_MODE_DEFS: ViewModeDef[] = [
  { id: "list", label: "List", Icon: List, hotkey: "1" },
  { id: "kanban", label: "Kanban", Icon: LayoutGrid, hotkey: "2" },
  { id: "calendar", label: "Calendar", Icon: CalendarDays, hotkey: "3" },
  { id: "table", label: "Table", Icon: Table2, hotkey: "4" },
];

export function ViewModeSwitcher() {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const mk = modKey() === "cmd" ? "\u2318" : "Ctrl";

  return (
    <div
      className="view-mode-switcher"
      role="radiogroup"
      aria-label="View layout"
    >
      {VIEW_MODE_DEFS.map(({ id, label, Icon, hotkey }) => {
        const active = viewMode === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={`${label} (${mk}+Alt+${hotkey})`}
            className={cn("vms-btn", active && "active")}
            onClick={() => setViewMode(id)}
          >
            <Icon size={15} strokeWidth={active ? 2.2 : 1.7} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Map a number key (1..4) to its view mode. Returns null if `n` is out
 * of range. Used by App.tsx to wire up Ctrl/Cmd+Alt+<digit> shortcuts.
 */
export function viewModeForHotkey(n: number): ViewMode | null {
  const def = VIEW_MODE_DEFS.find((d) => d.hotkey === String(n));
  return def ? def.id : null;
}
