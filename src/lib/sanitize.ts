import sanitizeHtml from "sanitize-html";

/**
 * Strip all HTML tags and return plain text only.
 * Used to prevent XSS in user-submitted event fields.
 */
export function sanitizeText(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}

/** The only schemes a stored link may carry (REVIEW-05 WR-09). */
const LINK_PROTOCOLS = ["http:", "https:"];

/**
 * Whether `value` is an absolute http(s) URL. `new URL()` alone accepts
 * `javascript:alert(1)`, which renders as a live `href`.
 */
export function isHttpUrl(value: string): boolean {
  try {
    return LINK_PROTOCOLS.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * Whether `value` parses as an absolute URL whose scheme is not http(s)
 * (`javascript:`, `data:`, `vbscript:` …). A value that does not parse at all
 * is not flagged: a browser can only resolve it as a relative link.
 */
export function hasUnsafeUrlScheme(value: string): boolean {
  try {
    return !LINK_PROTOCOLS.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
