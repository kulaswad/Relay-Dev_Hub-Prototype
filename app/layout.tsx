import type { Metadata } from "next";
import "./globals.css";
import { DevHubProvider } from "@/components/providers/DevHubContext";
import { CommandPalette } from "@/components/devhub/CommandPalette";
import { HelpDrawer } from "@/components/devhub/HelpDrawer";

export const metadata: Metadata = {
  title: "Relay Developer Hub — Communication & Customer Data Platform",
  description:
    "Official developer portal and sandbox for Relay APIs: SMS, RCS, WhatsApp messaging, and unified customer profile event ingestion.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-text font-sans antialiased selection:bg-accent/30 selection:text-white min-h-screen">
        <DevHubProvider>
          {children}
          <CommandPalette />
          <HelpDrawer />
        </DevHubProvider>
      </body>
    </html>
  );
}
