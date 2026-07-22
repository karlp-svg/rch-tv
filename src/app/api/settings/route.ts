import { db } from '@/db';
import { appSettings } from '@/db/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const DEFAULTS: Record<string, string> = {
  display_duration: '60',
  fame_photo_size: '42',
  fame_completed_scale: '70',
  fame_rotation: '15',
  fame_spread: '600',
  fame_spread_y: '200',
  fame_title_offset: '22',
  fame_display_offset: '0',
  fame_completed_fade: '70',
  tv_hide_background: 'false',
};

export async function GET() {
  try {
    const rows = await db.select().from(appSettings);
    const settings: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(DEFAULTS);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        await db.insert(appSettings)
          .values({ key, value: String(value) })
          .onConflictDoUpdate({
            target: appSettings.key,
            set: { value: String(value) },
          });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
