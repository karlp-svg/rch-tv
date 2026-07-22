import { randomBytes } from 'crypto';
import { db } from '@/db';
import { appSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

const SESSION_KEY = 'public_session';

export function generateSessionToken() {
  return randomBytes(12).toString('base64url');
}

export async function getPublicSession(): Promise<string | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, SESSION_KEY)).limit(1);
  return row?.value ?? null;
}

export async function setPublicSession(token: string) {
  await db.insert(appSettings)
    .values({ key: SESSION_KEY, value: token })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: token },
    });
  return token;
}

export async function getOrCreatePublicSession(): Promise<string> {
  const current = await getPublicSession();
  if (current) return current;
  const token = generateSessionToken();
  await setPublicSession(token);
  return token;
}

export async function validatePublicSession(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const current = await getPublicSession();
  if (!current) return false;
  return token === current;
}
