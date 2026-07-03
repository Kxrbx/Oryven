import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { useStore } from "@/store";
import { loadState } from "@/lib/tauri";
import { makeInitialState } from "@/data/defaults";
import { AppState, DEFAULT_SETTINGS, PersistedAppState } from "@/types";

import "@/styles/globals.css";

async function bootstrap() {
  try {
    const persisted = (await loadState()) as PersistedAppState | null;
    if (persisted && persisted.tasks && persisted.tasks.length > 0) {
      // v1 → v2: settings didn't exist before; backfill defaults defensively.
      const migrated: AppState = {
        ...persisted,
        modal: null,
        settings: persisted.settings ?? { ...DEFAULT_SETTINGS },
      };
      useStore.setState(migrated);
    } else {
      // First launch — seed defaults so the app never feels empty.
      useStore.setState(makeInitialState());
    }
  } catch (err) {
    console.error("[bootstrap] load failed", err);
    useStore.setState(makeInitialState());
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
