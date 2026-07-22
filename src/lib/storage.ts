import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'rch-tv-photos';

let client: SupabaseClient | null = null;

export function isStorageConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

function getClient(): SupabaseClient | null {
  if (!isStorageConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return client;
}

/**
 * Convert a data URL (data:image/jpeg;base64,....) to a Buffer + mime.
 */
function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string; ext: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  return { buffer: Buffer.from(match[2], 'base64'), mime, ext };
}

/**
 * Uploads a base64 data URL to Supabase Storage.
 * Returns the public URL, or null if storage is not configured
 * (caller should then fall back to storing base64 in the DB).
 */
export async function uploadImage(
  dataUrl: string,
  prefix: string
): Promise<string | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${parsed.ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, parsed.buffer, {
      contentType: parsed.mime,
      upsert: false,
    });

  if (error) {
    console.error('Supabase upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Deletes an image from Supabase Storage given its public URL.
 * No-op if storage is not configured or URL is not a Supabase URL.
 */
export async function deleteImage(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) return;
  const supabase = getClient();
  if (!supabase) return;

  // Extract the path after the bucket name
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;

  const path = publicUrl.slice(idx + marker.length);
  await supabase.storage.from(BUCKET).remove([path]);
}
