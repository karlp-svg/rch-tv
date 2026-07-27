import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RCH TV — Live Display',
  description: 'RCH TV on-screen display',
  other: {
    'cache-control': 'no-cache, no-store, must-revalidate',
    'pragma': 'no-cache',
    'expires': '0',
  },
};

export const dynamic = 'force-dynamic';

export { default } from './page.client';
