import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_NAME = "event-images";

/**
 * Download an image from a URL and upload it to Supabase Storage.
 * Returns the permanent public URL, or null if anything fails.
 */
export async function downloadAndUploadImage(
  imageUrl: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`Failed to download image (${response.status}): ${imageUrl}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const buffer = Buffer.from(await response.arrayBuffer());

    const hash = crypto.createHash("md5").update(buffer).digest("hex").slice(0, 8);
    const filename = `${Date.now()}-${hash}.${ext}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.warn(`Failed to upload image to Supabase Storage: ${error.message}`);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (err) {
    console.warn(`Image download/upload error: ${err}`);
    return null;
  }
}
