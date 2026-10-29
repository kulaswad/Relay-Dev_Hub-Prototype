import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relay BMP — Business Management Portal",
  description: "Internal operations portal for Relay B2B customer accounts, credits, KYC, and approvals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-text font-sans antialiased selection:bg-accent/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
