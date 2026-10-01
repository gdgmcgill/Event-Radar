/** Chromium can leave fetches from a streamed-away document without terminal
 * events. Retire only requests positively attributed to that replaced document;
 * missing/other referrers still have to settle within the normal deadline. */
export function belongsToReplacedDocument(
  referer: string | undefined,
  initialDocument: string,
  currentDocument: string,
): boolean {
  if (!referer) return false;
  try {
    const initial = new URL(initialDocument);
    const current = new URL(currentDocument);
    const source = new URL(referer);
    return initial.origin === current.origin && initial.href !== current.href && source.href === initial.href;
  } catch {
    return false;
  }
}
