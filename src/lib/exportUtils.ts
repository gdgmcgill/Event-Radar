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
    if (err instanceof Error) {
      console.warn(`Failed to export file: ${err.message}`);
    }
    throw err;
  }
}

export async function exportEventCsv(
  eventId: string,
  eventTitle: string,
): Promise<void> {
  const url = `/api/events/export?format=csv&eventId=${encodeURIComponent(eventId)}`;
  const filename = `${eventTitle.replace(/\s+/g, "-")}.csv`;
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
