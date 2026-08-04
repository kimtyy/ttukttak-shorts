import type { createClientForServer } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClientForServer>>;

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mp3": "mp3",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/**
 * Uploads a base64 `data:` URL to the public `media` storage bucket and
 * returns its public URL, so generated assets aren't stored inline as
 * base64 in DB rows / API responses.
 */
export async function uploadDataUrlToMediaBucket(
  supabase: SupabaseServerClient,
  path: string,
  dataUrl: string
): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL for media upload");
  }
  const [, mimeType, base64Data] = match;
  const buffer = Buffer.from(base64Data, "base64");
  const extension = EXTENSION_BY_MIME_TYPE[mimeType] || "bin";
  const objectPath = `${path}.${extension}`;

  const { error } = await supabase.storage
    .from("media")
    .upload(objectPath, buffer, { contentType: mimeType, upsert: true });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from("media").getPublicUrl(objectPath);
  return data.publicUrl;
}
