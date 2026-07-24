import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import DJAuthGuard from './auth-guard';

export const metadata: Metadata = {
  title: "RCH TV — DJ Console",
  description: "DJ management panel for RCH TV.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export default function DJLayout({ children }: { children: ReactNode }) {
  return <DJAuthGuard>{children}</DJAuthGuard>;
}
