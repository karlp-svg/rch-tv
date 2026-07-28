import { generateSessionToken, getOrCreatePublicSession } from '@/lib/session';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export default async function QRCodePage() {
  const session = await getOrCreatePublicSession();
  const origin = process.env.NEXT_PUBLIC_PUBLIC_APP_URL || 'https://rch-tv.vercel.app';
  const url = `${origin}/?session=${encodeURIComponent(session)}`;

  const qrDataUrl = await QRCode.toDataURL(url, {
    margin: 1,
    width: 600,
    color: { dark: '#ffffff', light: '#00000000' },
  });

  return (
    <html>
      <body style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#000' }}>
        <img src={qrDataUrl} alt="QR Code" style={{ width: '90vw', maxWidth: '500px', height: 'auto' }} />
      </body>
    </html>
  );
}
