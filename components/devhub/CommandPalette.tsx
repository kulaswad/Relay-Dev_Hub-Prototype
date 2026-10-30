"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDevHub } from "@/components/providers/DevHubContext";
import {
  Search,
  BookOpen,
  Send,
  Terminal,
  Key,
  Webhook,
  Activity,
  Layers,
  AlertTriangle,
  ArrowRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchItem {
  id: string;
  category: "docs" | "endpoints" | "errors" | "console" | "actions";
  title: string;
  subtitle: string;
  badge?: string;
  href?: string;
  action?: () => void;
  icon: any;
}

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    setEnvironment,
  } = useDevHub();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items: SearchItem[] = [
    // Endpoints
    {
      id: "ep-post-messages",
      category: "endpoints",
      title: "POST /v1/messages",
      subtitle: "Send SMS, RCS or WhatsApp message",
      badge: "POST",
      href: "/docs/endpoints/messages-send",
      icon: Send,
    },
    {
      id: "ep-get-messages",
      category: "endpoints",
      title: "GET /v1/messages/:id",
      subtitle: "Check message delivery status & carrier ack",
      badge: "GET",
      href: "/docs/endpoints/messages-status",
      icon: Send,
    },
    {
      id: "ep-post-events",
      category: "endpoints",
      title: "POST /v1/events",
      subtitle: "Ingest web/app/CRM events into CDP",
      badge: "POST",
      href: "/docs/endpoints/events-ingest",
      icon: Activity,
    },
    {
      id: "ep-get-profiles",
      category: "endpoints",
      title: "GET /v1/profiles/:id",
      subtitle: "Read unified customer profile traits and timeline",
      badge: "GET",
      href: "/docs/endpoints/customer-profile",
      icon: Layers,
    },

    // Docs
    {
      id: "doc-quickstart",
      category: "docs",
      title: "15-Minute Quickstart",
      subtitle: "Go from sign-up to your first API call",
      href: "/docs/quickstart",
      icon: BookOpen,
    },
    {
      id: "doc-auth",
      category: "docs",
      title: "Authentication & Scopes",
      subtitle: "Bearer token authentication with test/live keys",
      href: "/docs/authentication",
      icon: Key,
    },
    {
      id: "doc-kyc",
      category: "docs",
      title: "KYC & TRAI DLT Compliance",
      subtitle: "Entity registration, sender IDs, and template approvals",
      href: "/docs/compliance-guide",
      icon: AlertTriangle,
    },
    {
      id: "doc-webhooks",
      category: "docs",
      title: "Webhooks & Signature Verification",
      subtitle: "HMAC SHA-256 signatures, failure retries, and replay",
      href: "/docs/webhooks",
      icon: Webhook,
    },

    // Error Codes
    {
      id: "err-kyc-blocked",
      category: "errors",
      title: "ERR_KYC_REQUIRED (403)",
      subtitle: "Workspace cannot send LIVE messages until KYC is approved",
      badge: "403",
      href: "/docs/errors#kyc-required",
      icon: AlertTriangle,
    },
    {
      id: "err-dlt-template",
      category: "errors",
      title: "ERR_DLT_TEMPLATE_MISMATCH (422)",
      subtitle: "Message body does not match registered TRAI DLT template",
      badge: "422",
      href: "/docs/errors#dlt-mismatch",
      icon: AlertTriangle,
    },
    {
      id: "err-quota-exceeded",
      category: "errors",
      title: "ERR_QUOTA_EXCEEDED (429)",
      subtitle: "Prepaid wallet exhausted or TPS rate limit reached",
      badge: "429",
      href: "/docs/errors#quota-exceeded",
      icon: AlertTriangle,
    },

    // Console Navigation
    {
      id: "nav-console-overview",
      category: "console",
      title: "Console: Overview",
      subtitle: "Workspace dashboard, quick metrics, onboarding progress",
      href: "/console",
      icon: Terminal,
    },
    {
      id: "nav-console-keys",
      category: "console",
      title: "Console: API Keys",
      subtitle: "Generate and rotate rk_test_ and rk_live_ keys",
      href: "/console/api-keys",
      icon: Key,
    },
    {
      id: "nav-console-webhooks",
      category: "console",
      title: "Console: Webhooks",
      subtitle: "Register endpoints, view failure logs, replay events",
      href: "/console/webhooks",
      icon: Webhook,
    },
    {
      id: "nav-console-playground",
      category: "console",
      title: "Console: API Playground",
      subtitle: "Interactive request runner connected to the sandbox",
      href: "/console/playground",
      icon: Terminal,
    },

    // Quick Actions
    {
      id: "act-switch-test",
      category: "actions",
      title: "Switch Environment to Test Sandbox",
      subtitle: "Use rk_test_ keys with mock delivery",
      badge: "Test",
      action: () => setEnvironment("test"),
      icon: Terminal,
    },
    {
      id: "act-switch-live",
      category: "actions",
      title: "Switch Environment to Live Production",
      subtitle: "Use rk_live_ keys for real carrier dispatch",
      badge: "Live",
      action: () => setEnvironment("live"),
      icon: Terminal,
    },
  ];

  const filtered = query.trim()
    ? items.filter((item) =>
        `${item.title} ${item.subtitle} ${item.category}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : items;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (item: SearchItem) => {
    setCommandPaletteOpen(false);
    setQuery("");
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      setCommandPaletteOpen(false);
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={() => setCommandPaletteOpen(false)}
      />

      {/* Palette Modal */}
      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Search input header */}
        <div className="flex items-center px-4 py-3 border-b border-border bg-[#0C0C0F]">
          <Search className="w-4 h-4 text-text-muted mr-3 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search docs, endpoints, error codes, or console pages..."
            className="w-full bg-transparent text-sm text-text placeholder:text-text-muted/60 focus:outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-text-muted hover:text-text rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border ml-2">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-border/30">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              No matching documentation, endpoints or error codes found for "{query}".
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors",
                    isSelected ? "bg-surface-2 text-text" : "text-text-muted hover:bg-surface-2/50"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "p-1.5 rounded-md border",
                        isSelected
                          ? "bg-accent/15 border-accent/30 text-accent"
                          : "bg-[#141418] border-border text-text-muted"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#0C0C0F] border border-border text-text-muted">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted/80 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <ArrowRight
                    className={cn(
                      "w-3.5 h-3.5 shrink-0 transition-opacity",
                      isSelected ? "opacity-100 text-accent" : "opacity-0"
                    )}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Palette Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-[#09090B] text-[11px] font-mono text-text-muted">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-[10px] text-text-muted/60">Relay Developer Hub</span>
        </div>
      </div>
    </div>
  );
}
