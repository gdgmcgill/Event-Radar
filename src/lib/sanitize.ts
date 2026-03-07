import sanitizeHtml from "sanitize-html";

/**
 * Strip all HTML tags and return plain text only.
 * Used to prevent XSS in user-submitted event fields.
 */
export function sanitizeText(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}
