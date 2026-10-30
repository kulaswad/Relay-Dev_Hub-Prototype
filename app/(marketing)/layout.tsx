import React from "react";
import Link from "next/link";
import { PublicNavbar } from "@/components/devhub/PublicNavbar";
import { Zap, ShieldCheck, Heart } from "lucide-react";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-text">
      <PublicNavbar />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-[#0C0C0F] text-xs py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                <Zap className="w-3 h-3 fill-current" />
              </div>
              <span className="font-bold text-sm text-text">Relay Developer Hub</span>
            </div>
            <p className="text-text-muted text-xs leading-relaxed max-w-xs">
              Next-generation messaging APIs and Customer Data Platform built for high-throughput Indian enterprises.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-[#3FB68B] font-mono">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>TRAI DLT & MCA Compliant</span>
            </div>
          </div>

          <div>
            <h4 className="font-mono text-xs font-semibold text-text uppercase tracking-wider mb-3">
              APIs & Docs
            </h4>
            <ul className="space-y-2 text-text-muted">
              <li>
                <Link href="/docs/quickstart" className="hover:text-text transition-colors">
                  15-Minute Quickstart
                </Link>
              </li>
              <li>
                <Link href="/docs/endpoints/messages-send" className="hover:text-text transition-colors">
                  SMS & RCS APIs
                </Link>
              </li>
              <li>
                <Link href="/docs/endpoints/channels" className="hover:text-text transition-colors">
                  WhatsApp Cloud API
                </Link>
              </li>
              <li>
                <Link href="/docs/endpoints/events-ingest" className="hover:text-text transition-colors">
                  Event Ingestion & CDP
                </Link>
              </li>
              <li>
                <Link href="/docs/webhooks" className="hover:text-text transition-colors">
                  Webhooks & Retries
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs font-semibold text-text uppercase tracking-wider mb-3">
              Developer Tools
            </h4>
            <ul className="space-y-2 text-text-muted">
              <li>
                <Link href="/console/playground" className="hover:text-text transition-colors">
                  API Request Playground
                </Link>
              </li>
              <li>
                <Link href="/console/api-keys" className="hover:text-text transition-colors">
                  API Key Management
                </Link>
              </li>
              <li>
                <Link href="/changelog" className="hover:text-text transition-colors">
                  Changelog (v2025-10-01)
                </Link>
              </li>
              <li>
                <Link href="/docs/errors" className="hover:text-text transition-colors">
                  Error Codes Catalogue
                </Link>
              </li>
              <li>
                <Link href="/status" className="hover:text-text transition-colors">
                  System Status (99.99%)
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs font-semibold text-text uppercase tracking-wider mb-3">
              Regulations & Support
            </h4>
            <ul className="space-y-2 text-text-muted">
              <li>
                <Link href="/docs/compliance-guide" className="hover:text-text transition-colors">
                  TRAI DLT Registration Guide
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-text transition-colors">
                  Developer Support & Slack
                </Link>
              </li>
              <li>
                <span className="text-text-muted/70">GSTIN Invoicing available</span>
              </li>
              <li>
                <span className="text-text-muted/70">Servers hosted in Mumbai (ap-south-1)</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-border/60 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-text-muted text-[11px]">
          <div>
            © {new Date().getFullYear()} Relay Technologies India Pvt Ltd. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] bg-surface-2 px-2 py-0.5 rounded border border-border">
              v2025-10-01
            </span>
            <span className="flex items-center gap-1">
              Built for Indian scale
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
