/**
 * Utility functions for exporting events to files
 */

export async function downloadExportFile(
  url: string,
  filename: string,
): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(objectUrl);
    document.body.removeChild(link);
  } catch (err) {
    throw err;
  }
}

export async function exportEventsCsv(
  eventIds: string[],
  filename = "my-events.csv",
): Promise<void> {
  const uniqueEventIds = Array.from(new Set(eventIds)).filter(Boolean);
  if (uniqueEventIds.length === 0) {
    throw new Error("No event IDs provided for CSV export");
  }

  const eventIdsParam = uniqueEventIds.join(",");
  const url = `/api/events/export?format=csv&eventIds=${encodeURIComponent(eventIdsParam)}`;
  await downloadExportFile(url, filename);
}

export async function exportEventIcal(
  eventId: string,
  eventTitle: string,
): Promise<void> {
  const url = `/api/events/export?format=ical&eventId=${encodeURIComponent(eventId)}`;
  const filename = `${eventTitle.replace(/\s+/g, "-")}.ics`;
  await downloadExportFile(url, filename);
}
