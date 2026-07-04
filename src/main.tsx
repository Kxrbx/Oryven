import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { useStore } from "@/store";
import { loadState } from "@/lib/tauri";
import { makeInitialState } from "@/data/defaults";
import {
  AppState,
  DEFAULT_SETTINGS,
  DEFAULT_VIEW_MODE,
  PersistedAppState,
  Task,
} from "@/types";
import { normalizeRecurrenceRule } from "@/utils/recurrence";

import "@/styles/globals.css";

function migrateTask(task: Task): Task {
  const recurrence = normalizeRecurrenceRule(task.recurrence, task.dueDate);
  return {
    ...task,
    labelIds: task.labelIds ?? [],
    subtasks: task.subtasks ?? [],
    comments: task.comments ?? [],
    recurrence,
    recurrenceId: recurrence
      ? task.recurrenceId ?? task.parentRecurrenceId ?? task.id
      : null,
    parentRecurrenceId: task.parentRecurrenceId ?? null,
  };
}

async function bootstrap() {
  try {
    const persisted = (await loadState()) as PersistedAppState | null;
    if (
      persisted &&
      Array.isArray(persisted.tasks) &&
      Array.isArray(persisted.projects) &&
      Array.isArray(persisted.labels)
    ) {
      // v1 → v2: settings didn't exist before; backfill defaults defensively.
      const migrated: AppState = {
        ...persisted,
        tasks: persisted.tasks.map(migrateTask),
        modal: null,
        viewMode: persisted.viewMode ?? DEFAULT_VIEW_MODE,
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
