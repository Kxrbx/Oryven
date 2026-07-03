import { useEffect, useRef } from "react";

/**
 * Window-level Escape listener that calls onClose. Uses
 * `stopImmediatePropagation()` so other window-level listeners (in
 * particular App.tsx's `useKeyboardShortcuts({ escape: ... })`) do NOT
 * also fire — otherwise pressing Esc in a modal would also unexpectedly
 * close the command palette.
 *
 * `stopPropagation()` would NOT suffice: both listeners are attached to
 * `window`, and stopPropagation only affects bubbling — not other handlers
 * on the same target.
 *
 * The latest onClose is captured via a ref so the effect deps stay at
 * just `[active]`. This is functionally equivalent today (zustand-stable
 * action refs) but matters if any future caller passes an inline arrow,
 * which would otherwise re-register the listener on every render.
 */
export function useEscapeToClose(active: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active]);
}
