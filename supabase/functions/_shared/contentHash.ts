/**
 * Compute SHA-256 content hash for event deduplication.
 * Hash = SHA-256(normalized_title | date | normalized_organizer)
 */
export async function computeEventContentHash(
  title: string,
  startDate: string,
  organizer: string
): Promise<string> {
  const normalizedTitle = title.toLowerCase().trim();
  const dateOnly = new Date(startDate).toISOString().split("T")[0];
  const normalizedOrganizer = (organizer || "").toLowerCase().trim();

  const input = `${normalizedTitle}|${dateOnly}|${normalizedOrganizer}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
