"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDevHub } from "@/components/providers/DevHubContext";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { VersionSelector } from "./VersionSelector";
import { Search, Zap, ArrowRight, ExternalLink, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function PublicNavbar() {
  const pathname = usePathname();
  const { toggleCommandPalette, toggleHelpDrawer, environment } = useDevHub();

  const navLinks = [
    { label: "Docs", href: "/docs" },
    { label: "API Reference", href: "/docs/endpoints" },
    { label: "Playground", href: "/playground" },
    { label: "Changelog", href: "/changelog" },
    { label: "Status", href: "/status" },
    { label: "Support", href: "/support" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-[#09090B]/90 backdrop-blur-md">
      {pathname.startsWith("/docs") && environment === "test" && (
        <div className="bg-[#E0A93B]/10 border-b border-[#E0A93B]/25 py-1 px-4 text-center text-[11px] font-mono text-[#E0A93B] flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E0A93B] animate-pulse" />
          <span>Documentation is in <strong>Test Sandbox Mode</strong> (rk_test_...). Zero KYC required to send test traffic.</span>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand & Main Nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-md bg-accent/20 border border-accent/40 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-colors">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-text">
                Relay
              </span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-surface-2 border border-border text-text-muted">
                DevHub
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-xs">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-2.5 py-1.5 rounded-md transition-colors",
                    isActive
                      ? "text-text font-medium bg-surface-2"
                      : "text-text-muted hover:text-text hover:bg-surface-2/50"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Action Tools: Search, Environment Switcher, Version, Console CTA */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Search Trigger */}
          <button
            onClick={toggleCommandPalette}
            className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface border border-border text-xs text-text-muted hover:text-text hover:border-text-muted/50 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search docs & APIs...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 font-mono text-[10px] bg-surface-2 px-1 rounded border border-border/80 text-text-muted">
              ⌘K
            </kbd>
          </button>

          {/* Persistent Environment Switcher */}
          <EnvironmentSwitcher />

          {/* Global Help Drawer Trigger */}
          <button
            onClick={toggleHelpDrawer}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border text-xs text-text hover:border-accent hover:text-accent transition-colors"
            title="Open Developer Help Panel"
          >
            <HelpCircle className="w-3.5 h-3.5 text-accent" />
            <span className="hidden md:inline font-medium">Help</span>
          </button>

          {/* Fixed Version Selector */}
          <div className="hidden lg:block">
            <VersionSelector />
          </div>

          <Link
            href="/sign-in"
            className="hidden sm:inline-flex px-2.5 py-1 text-xs text-text-muted hover:text-text transition-colors"
          >
            Sign in
          </Link>

          {/* Console / Get API Keys Button */}
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-all shadow-sm"
          >
            <span>Get API Keys</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
