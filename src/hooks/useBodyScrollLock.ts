import { useEffect } from "react";

/**
 * Lock document.body scroll while `active` is true. Ref-counted across all
 * call sites so multiple overlapping modals (e.g. TaskDetail + ModalRoot)
 * correctly stack their locks and only the first captures the previous
 * overflow value, and only the last restores it.
 *
 * Without ref-counting, opening Modaltask first (saving prev="") and then
 * opening ModalRoot (saving prev="hidden") means ModalRoot's later cleanup
 * would "restore" prev="hidden" and leave the body locked forever.
 */

let lockCount = 0;
let savedOverflow: string | null = null;

function lockBody() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount++;
}

function unlockBody() {
  if (lockCount === 0) return;
  lockCount--;
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow ?? "";
    savedOverflow = null;
  }
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBody();
    // Cleanup is gated on the closure-captured active — so a no-op effect
    // (active=false at effect-run time, e.g. after an active toggle to false)
    // doesn't decrement a count it didn't lock.
    return () => {
      if (active) unlockBody();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
