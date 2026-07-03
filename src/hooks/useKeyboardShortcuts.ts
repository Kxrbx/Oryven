import { useEffect, useRef } from "react";
import { modKey, isMac } from "@/utils/keyboard";

export type ShortcutHandler = (e: KeyboardEvent) => void;
export type ShortcutMap = Record<string, ShortcutHandler>;

// Time window in which a 2-key chord (e.g. "g i") may complete.
const CHORD_TIMEOUT_MS = 800;

export function useKeyboardShortcuts(map: ShortcutMap, enabled = true) {
  const ref = useRef(map);
  ref.current = map;
  const pending = useRef<{ prefix: string; at: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inForm =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // These keys/combos get through even when typing in a form.
      const allowInForm =
        e.key === "Escape" ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.key === "/" && e.shiftKey) ||
        e.key === "?";

      if (inForm && !allowInForm) return;

      const m = ref.current;
      const now = Date.now();

      // Modifier-bearing chords always match by their full combo (e.g. "ctrl+k").
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
        const combo = toCombo(e);
        const direct = m[combo];
        if (direct) direct(e);
        return;
      }

      // Plain-key path: resolve via direct / chord-completion / chord-start.
      const key = toCombo(e); // "g", "i", "j", etc.

      // 1) Direct single-key match takes priority over chord.
      const direct = m[key];
      if (direct) {
        direct(e);
        pending.current = null;
        return;
      }

      // 2) Complete a pending chord prefix.
      if (
        pending.current &&
        now - pending.current.at < CHORD_TIMEOUT_MS
      ) {
        const fullKey = pending.current.prefix + " " + key;
        const fn = m[fullKey];
        if (fn) {
          fn(e);
          pending.current = null;
          return;
        }
        pending.current = null;
      }

      // 3) Start a new chord prefix if any chord begins with this key.
      const isChordPrefix = Object.keys(m).some(
        (k) => k.length > key.length && k.startsWith(key + " ")
      );
      if (isChordPrefix) {
        pending.current = { prefix: key, at: now };
      } else {
        pending.current = null;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}

export function toCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push(isMac() ? "cmd" : "ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  let k = e.key;
  if (k === " ") k = "space";
  parts.push(k.toLowerCase());
  return parts.join("+");
}

export const MOD = modKey();
