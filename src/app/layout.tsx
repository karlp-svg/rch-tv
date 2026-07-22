import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jakarl DJ - Live TV Requests",
  description: "Follow @jakarl_dj on Instagram and request TV shoutouts, songs, or fame moments.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0f",
};

import SandboxSwitcher from "@/components/SandboxSwitcher";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white antialiased overscroll-none">
        <SandboxSwitcher />
        {children}
      </body>
    </html>
  );
}
