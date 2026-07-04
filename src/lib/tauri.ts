// Tiny wrapper around Tauri's IPC for state persistence.
// Falls back to localStorage when running outside Tauri (development convenience).

import { PersistedAppState, VIEW_MODES } from "@/types";

interface PersistedState {
  schema_version: number;
  json: string;
}

const SCHEMA_VERSION = 2;
const LS_KEY = "oryven.appstate";

function hasTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Coerce unknown `viewMode` values to `undefined` so the store's
 * `?? DEFAULT_VIEW_MODE` fallback kicks in. This handles state files
 * written by earlier builds (e.g. 0.5.0 with the now-removed
 * `"timeline"` / `"mindmap"` values) — otherwise the active button
 * in the switcher would silently fail to highlight and the dispatcher
 * would fall through to the default branch.
 */
function normalizePersistedState(raw: unknown): PersistedAppState | null {
  if (!raw || typeof raw !== "object") return null;
  const state = raw as PersistedAppState;
  if (state.viewMode !== undefined && !VIEW_MODES.includes(state.viewMode)) {
    state.viewMode = undefined;
  }
  return state;
}

export async function loadState(): Promise<PersistedAppState | null> {
  if (hasTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const persisted = (await invoke("load_state")) as PersistedState;
      if (persisted.json) {
        return normalizePersistedState(JSON.parse(persisted.json));
      }
      return null;
    } catch (e) {
      console.error("[tauri] load_state failed, falling back", e);
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return normalizePersistedState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveState(state: PersistedAppState): Promise<string | null> {
  if (hasTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_state", {
        state: {
          schema_version: SCHEMA_VERSION,
          json: JSON.stringify(state),
        },
      });
      return null;
    } catch (e) {
      console.error("[tauri] save_state failed", e);
      return "save failed";
    }
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    return null;
  } catch {
    return "save failed";
  }
}

export async function stateLocation(): Promise<string> {
  if (hasTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return (await invoke("state_location")) as string;
    } catch {
      // ignore
    }
  }
  return "localStorage";
}
