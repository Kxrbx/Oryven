// Format a KeyboardEvent-like key into a display string (e.g. "Ctrl+K").
// Used by shortcut rows in the UI.

export interface KeyCombo {
  key: string;
  mod?: "ctrl" | "cmd" | "alt" | "shift";
  shift?: boolean;
  alt?: boolean;
}

export function formatCombo(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.mod === "ctrl") parts.push("Ctrl");
  else if (combo.mod === "cmd") parts.push("Cmd");
  if (combo.shift) parts.push("Shift");
  if (combo.alt) parts.push("Alt");
  parts.push(displayKey(combo.key));
  return parts.join("+");
}

function displayKey(k: string): string {
  if (k === " ") return "Space";
  if (k.length === 1) return k.toUpperCase();
  return k.charAt(0).toUpperCase() + k.slice(1);
}

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

export function modKey(): "ctrl" | "cmd" {
  return isMac() ? "cmd" : "ctrl";
}
