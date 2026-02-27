/**
 * Utility function to upload an event image to the backend.
 * Proxies the file through /api/events/upload-image to avoid client-side Supabase timeout issues.
 */
export async function uploadEventImage(file: File): Promise<string | null> {
    try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/events/upload-image", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Failed to upload image");
        }

        const data = await res.json();
        return data.url;
    } catch (err) {
        console.error("Event image upload failed:", err);
        return null;
    }
}
