"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDevHub } from "@/components/providers/DevHubContext";
import {
  Zap,
  LayoutDashboard,
  Key,
  Webhook,
  Activity,
  BarChart3,
  Terminal,
  Settings,
  BookOpen,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ConsoleSidebar() {
  const pathname = usePathname();
  const { environment, workspace } = useDevHub();

  const navItems = [
    {
      label: "Overview / Quickstart",
      href: "/console",
      icon: LayoutDashboard,
      badge: "15 min",
    },
    {
      label: "API Keys",
      href: "/console/keys",
      icon: Key,
    },
    {
      label: "Webhooks",
      href: "/console/webhooks",
      icon: Webhook,
    },
    {
      label: "Event Logs",
      href: "/console/logs",
      icon: Activity,
    },
    {
      label: "Usage & Limits",
      href: "/console/usage",
      icon: BarChart3,
    },
    {
      label: "API Playground",
      href: "/console/playground",
      icon: Terminal,
      highlight: true,
    },
    {
      label: "Settings",
      href: "/console/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 border-r border-border bg-[#0C0C0F] flex flex-col justify-between shrink-0 select-none h-screen sticky top-0">
      {/* Top Section */}
      <div>
        {/* Brand & Workspace Header */}
        <div className="p-4 border-b border-border">
          <Link href="/" className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Zap className="w-3.5 h-3.5 fill-current" />
            </div>
            <span className="font-bold text-sm tracking-tight text-text">
              Relay Console
            </span>
          </Link>

          {/* Active Workspace Pill */}
          <div className="p-2 rounded-lg bg-surface border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text truncate">
                {workspace.name}
              </span>
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  environment === "test" ? "bg-[#E0A93B]" : "bg-[#3FB68B]"
                )}
                title={environment === "test" ? "Test Sandbox" : "Live Production"}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-muted mt-1">
              <span className="truncate">{workspace.orgName}</span>
              {workspace.kycStatus === "active" ? (
                <span className="text-[#3FB68B] font-mono text-[10px] flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3" /> KYC Done
                </span>
              ) : (
                <span className="text-[#E0A93B] font-mono text-[10px] flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> KYC Needed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-1">
          <div className="px-2 py-1 text-[10px] font-semibold font-mono uppercase tracking-wider text-text-muted/70">
            Developer Console
          </div>

          {navItems.map((item) => {
            const isActive =
              item.href === "/console"
                ? pathname === "/console"
                : item.href === "/console/keys"
                ? pathname.startsWith("/console/keys") || pathname.startsWith("/console/api-keys")
                : item.href === "/console/logs"
                ? pathname.startsWith("/console/logs") || pathname.startsWith("/console/events")
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors",
                  isActive
                    ? "bg-surface-2 text-text border border-border/80 shadow-sm"
                    : "text-text-muted hover:text-text hover:bg-surface-2/40"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      "w-4 h-4",
                      isActive
                        ? "text-accent"
                        : item.highlight
                        ? "text-[#7C7CFF]"
                        : "text-text-muted"
                    )}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent/15 text-accent border border-accent/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Section */}
      <div className="p-3 border-t border-border space-y-2 bg-[#09090B]">
        <Link
          href="/docs"
          className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-accent" />
            <span>Developer Docs</span>
          </div>
          <ArrowUpRight className="w-3 h-3 text-text-muted" />
        </Link>

        {/* Environment status indicator footer */}
        <div className="px-2.5 py-2 rounded-md bg-surface border border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                environment === "test" ? "bg-[#E0A93B]" : "bg-[#3FB68B]"
              )}
            />
            <span className="font-mono text-[11px] text-text">
              {environment === "test" ? "Sandbox Active" : "Live Carrier"}
            </span>
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            {environment === "test" ? "0 INR cost" : "Live tariff"}
          </span>
        </div>
      </div>
    </aside>
  );
}
