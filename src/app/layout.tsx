import type { Metadata } from "next";
import "./globals.css";
import SandboxSwitcher from "@/components/SandboxSwitcher";

export const metadata: Metadata = {
  title: "RCH TV — Interactive DJ Experience",
  description: "Send shoutouts, request songs, and get your photo on the big screen — powered by @jakarl_dj",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-zinc-950 text-white overflow-x-hidden">
        <SandboxSwitcher />
        {children}
      </body>
    </html>
  );
}
