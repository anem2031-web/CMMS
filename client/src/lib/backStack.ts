/**
 * Small browser-history helpers used by ticket and purchase-order screens.
 *
 * List UI state is stored on the current history entry (history.state), not in
 * localStorage/sessionStorage. That makes browser/app Back restore the exact
 * list state while a fresh navigation to the list starts clean.
 */
export function readHistoryEntryState<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  const state = window.history.state;
  if (!state || typeof state !== "object") return undefined;
  return (state as Record<string, unknown>)[key] as T | undefined;
}

export function writeHistoryEntryState<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  const currentState = window.history.state;
  const safeState = currentState && typeof currentState === "object"
    ? currentState
    : {};

  window.history.replaceState(
    { ...safeState, [key]: value },
    "",
    window.location.href,
  );
}

/**
 * Use the browser Back Stack when one exists; otherwise stay inside the app by
 * navigating to a known safe fallback route.
 */
export function goBackOrFallback(navigate: (path: string) => void, fallback: string): void {
  if (typeof window !== "undefined" && window.history.length > 1) {
    window.history.back();
    return;
  }

  navigate(fallback);
}
