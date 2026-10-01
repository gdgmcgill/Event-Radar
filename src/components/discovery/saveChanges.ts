/** Same-tab invalidation across mounted screens. This carries no authority:
 * subscribers refetch their authenticated API and ignore another account. */
export type SaveChange = {
  userId: string;
  kind: "event" | "opportunity";
  id: string;
  saved: boolean;
};
const SAVE_CHANGED = "universe:save-changed";
export function publishSaveChange(change: SaveChange) {
  window.dispatchEvent(new CustomEvent<SaveChange>(SAVE_CHANGED, { detail: change }));
}
export function subscribeSaveChanges(userId: string, receive: (change: SaveChange) => void) {
  const listener = (event: Event) => {
    const change = (event as CustomEvent<SaveChange>).detail;
    if (change?.userId === userId) receive(change);
  };
  window.addEventListener(SAVE_CHANGED, listener);
  return () => window.removeEventListener(SAVE_CHANGED, listener);
}
