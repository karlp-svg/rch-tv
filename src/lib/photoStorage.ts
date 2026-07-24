/**
 * Photo Storage — Cloudflare R2
 *
 * Strategy:
 *   Photos are uploaded directly to Cloudflare R2 (S3-compatible API).
 *   The DB stores only the public URL string (~50 bytes per photo).
 *   Image delivery comes from Cloudflare's CDN → zero egress.
 *
 * Environment variables needed (set in .env and Cloudflare dashboard):
 *   R2_ACCOUNT_ID        – Your Cloudflare account ID (from dashboard)
 *   R2_ACCESS_KEY_ID     – R2 API token access key
 *   R2_SECRET_ACCESS_KEY – R2 API token secret
 *   R2_BUCKET            – Bucket name (e.g. "rch-tv-photos")
 *   R2_PUBLIC_URL        – Public bucket URL (e.g. "https://pub-xxxxx.r2.dev")
 *                         OR your custom domain mapped to the bucket
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function getClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env'
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(): string {
  return process.env.R2_BUCKET || 'rch-tv-photos';
}

function getPublicUrl(): string {
  return process.env.R2_PUBLIC_URL || `https://${getBucket()}.r2.dev`;
}

/**
 * Save a base64 data URL to Cloudflare R2 and return its public URL.
 *
 * @param base64Data  e.g. "data:image/jpeg;base64,/9j/4AAQ..."
 * @param prefix      e.g. "fame" or "polaroid" or "social-songs"
 * @returns           e.g. "https://pub-xxxxx.r2.dev/fame-1712345678-ab12.jpg"
 */
export async function saveBase64AsFile(
  base64Data: string,
  prefix: string = 'fame'
): Promise<string> {
  const match = base64Data.match(/^data:(image\/([a-zA-Z0-9.+-]+));base64,(.+)$/);
  if (!match) throw new Error('Invalid base64 image data');

  const mime = match[1];
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const rawBase64 = match[3];

  const buffer = Buffer.from(rawBase64, 'base64');

  // Unique filename
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const key = `${prefix}-${timestamp}-${random}.${ext}`;

  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: buffer,
    ContentType: mime,
    CacheControl: 'public, max-age=86400, immutable',
  }));

  return `${getPublicUrl()}/${key}`;
}
