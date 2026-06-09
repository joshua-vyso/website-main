// One-shot scroll gate used before the portal fires.
// `once(fn)` registers fn to run on the next wheel event, then removes itself.
// `clear()` cancels the pending subscription.
// Completely separate from the word roller's persistent wheel handler.

export function createScrollGate() {
  let sub: (() => void) | null = null;

  function clear() {
    if (sub) { window.removeEventListener("wheel", sub); sub = null; }
  }

  function once(fn: () => void) {
    clear();
    sub = () => { sub = null; fn(); };
    window.addEventListener("wheel", sub, { once: true, passive: true });
  }

  function cleanup() { clear(); }

  return { once, clear, cleanup };
}
