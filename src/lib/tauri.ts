// Tiny wrapper around Tauri's IPC for state persistence.
// Falls back to localStorage when running outside Tauri (development convenience).

import { PersistedAppState } from "@/types";

interface PersistedState {
  schema_version: number;
  json: string;
}

const SCHEMA_VERSION = 2;
const LS_KEY = "stride.appstate";

function hasTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function loadState(): Promise<PersistedAppState | null> {
  if (hasTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const persisted = (await invoke("load_state")) as PersistedState;
      if (persisted.json) {
        return JSON.parse(persisted.json) as PersistedAppState;
      }
      return null;
    } catch (e) {
      console.error("[tauri] load_state failed, falling back", e);
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAppState;
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
      console.error("[tauri] save_state failed, falling back", e);
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
