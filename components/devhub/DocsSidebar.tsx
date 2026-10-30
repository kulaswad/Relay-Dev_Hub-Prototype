"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Send,
  Activity,
  Layers,
  Webhook,
  AlertTriangle,
  Code2,
  Key,
  ShieldCheck,
  FileCode,
  Gauge,
  Sparkles,
  GitBranch,
  ArrowRightLeft,
  CheckCircle2,
  Download,
  Calendar,
  Zap,
  Repeat,
  Scale,
  ListOrdered,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocNavSection {
  title: string;
  items: {
    title: string;
    href: string;
    badge?: string;
    icon?: any;
    external?: boolean;
  }[];
}

const docsNavigation: DocNavSection[] = [
  {
    title: "Introduction",
    items: [
      { title: "Overview", href: "/docs", icon: BookOpen },
    ],
  },
  {
    title: "Getting Started",
    items: [
      { title: "15-Minute Quickstart", href: "/docs/quickstart", badge: "15 min", icon: Sparkles },
      { title: "Test vs Live Environments", href: "/docs/test-vs-live", icon: ArrowRightLeft },
      { title: "Authentication & Keys", href: "/docs/authentication", icon: Key },
      { title: "Your First Message", href: "/docs/first-message", badge: "Try", icon: Send },
    ],
  },
  {
    title: "Integration Guides",
    items: [
      { title: "Omnichannel Messaging (SMS/RCS/WA)", href: "/docs/guides/sending-messages", icon: Send },
      { title: "Templates & DLT Headers", href: "/docs/guides/templates-dlt", badge: "TRAI", icon: ShieldCheck },
      { title: "Ingesting Events & Profiles", href: "/docs/guides/ingesting-events", icon: Activity },
      { title: "Reading Customer Profiles", href: "/docs/guides/reading-profiles", icon: Layers },
      { title: "Handling Delivery Status (DLR)", href: "/docs/guides/delivery-status", icon: FileCode },
      { title: "Webhooks Architecture", href: "/docs/webhooks", icon: Webhook },
      { title: "Idempotency & Replays", href: "/docs/guides/idempotency", icon: Repeat },
      { title: "Pagination & Cursors", href: "/docs/guides/pagination", icon: ListOrdered },
      { title: "Rate Limits & Quotas", href: "/docs/limits", icon: Gauge },
      { title: "Testing in the Sandbox", href: "/docs/guides/sandbox-testing", badge: "Numbers", icon: FlaskConical },
      { title: "Going Live (KYC Checklist)", href: "/docs/compliance-guide", badge: "KYC", icon: CheckCircle2 },
      { title: "Migrating Between Versions", href: "/docs/migrating-between-versions", icon: GitBranch },
      { title: "Compare Versions", href: "/docs/compare-versions", icon: ArrowRightLeft },
    ],
  },
  {
    title: "API Reference",
    items: [
      { title: "All Endpoints Overview", href: "/docs/endpoints", icon: BookOpen },
      { title: "POST /messages", href: "/docs/endpoints/messages-send", badge: "POST", icon: Send },
      { title: "GET /messages/{id}", href: "/docs/endpoints/messages-get", badge: "GET", icon: Send },
      { title: "GET /messages", href: "/docs/endpoints/messages-list", badge: "GET", icon: Send },
      { title: "POST /events", href: "/docs/endpoints/events-ingest", badge: "POST", icon: Activity },
      { title: "GET /customers/{id}", href: "/docs/endpoints/customers-get", badge: "GET", icon: Layers },
      { title: "PUT /customers/{id}", href: "/docs/endpoints/customers-update", badge: "PUT", icon: Layers },
      { title: "GET /delivery-status/{id}", href: "/docs/endpoints/delivery-status-get", badge: "GET", icon: FileCode },
      { title: "GET /usage", href: "/docs/endpoints/usage-get", badge: "GET", icon: Gauge },
      { title: "Webhook Endpoints API", href: "/docs/endpoints/webhook-endpoints", icon: Webhook },
      { title: "Webhook Events Catalogue", href: "/docs/endpoints/webhook-events", icon: Zap },
      { title: "OpenAPI JSON Spec", href: "/api/openapi.json", badge: "JSON", icon: Download, external: true },
      { title: "Postman Collection", href: "/api/postman.json", badge: "JSON", icon: Download, external: true },
    ],
  },
  {
    title: "Developer Tools",
    items: [
      { title: "Error Codes Catalogue", href: "/docs/errors", icon: AlertTriangle },
      { title: "SDKs & Client Libraries", href: "/docs/sdks", icon: Code2 },
      { title: "AI Architecture & Privacy", href: "/docs/ai", badge: "AI", icon: Sparkles },
      { title: "Changelog", href: "/changelog", icon: Calendar },
      { title: "Deprecations & Sunsets", href: "/docs/deprecations", badge: "Notice", icon: AlertTriangle },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-[#0C0C0F] shrink-0 p-4 space-y-6 overflow-y-auto h-[calc(100vh-3.5rem)] sticky top-14 select-none">
      {docsNavigation.map((section) => (
        <div key={section.title} className="space-y-1.5">
          <h3 className="px-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-text-muted">
            {section.title}
          </h3>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              if (item.external) {
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-2/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-text-muted border border-border">
                          {item.badge}
                        </span>
                      )}
                    </a>
                  </li>
                );
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors",
                      isActive
                        ? "bg-surface-2 text-text font-semibold border border-border/80 shadow-sm"
                        : "text-text-muted hover:text-text hover:bg-surface-2/40"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Icon
                        className={cn(
                          "w-3.5 h-3.5 shrink-0",
                          isActive ? "text-accent" : "text-text-muted"
                        )}
                      />
                      <span className="truncate">{item.title}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={cn(
                          "text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border",
                          item.badge === "POST"
                            ? "bg-accent/15 border-accent/30 text-accent"
                            : item.badge === "GET"
                            ? "bg-[#3FB68B]/15 border-[#3FB68B]/30 text-[#3FB68B]"
                            : item.badge === "PUT"
                            ? "bg-[#E0A93B]/15 border-[#E0A93B]/30 text-[#E0A93B]"
                            : item.badge === "DELETE"
                            ? "bg-[#E5534B]/15 border-[#E5534B]/30 text-[#E5534B]"
                            : "bg-surface-2 text-text-muted border-border"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
