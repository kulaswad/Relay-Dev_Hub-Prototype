"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDevHub } from "@/components/providers/DevHubContext";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { VersionSelector } from "./VersionSelector";
import { Search, BookOpen, LogOut, User as UserIcon, HelpCircle } from "lucide-react";

export function ConsoleHeader({
  title,
  breadcrumbs,
}: {
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  const { toggleCommandPalette, toggleHelpDrawer, workspace, environment } = useDevHub();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAnon, setIsAnon] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.authenticated) {
          setCurrentUser(data.user);
          setIsAnon(data.isAnonymous);
        }
      } catch {}
    }
    loadUser();
  }, []);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      router.push("/sign-in");
      router.refresh();
    } catch {}
  };

  return (
    <header className="h-14 border-b border-border bg-[#09090B]/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-2 text-xs">
        {breadcrumbs ? (
          <nav className="flex items-center gap-1.5 text-text-muted">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-border">/</span>}
                {b.href ? (
                  <Link href={b.href} className="hover:text-text transition-colors">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-text font-medium">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : (
          <h1 className="text-sm font-semibold text-text">{title || "Console"}</h1>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {environment === "test" && (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[11px] text-[#E0A93B] bg-[#E0A93B]/10 px-2.5 py-0.5 rounded-full border border-[#E0A93B]/30"
            title="All operations in Test environment are simulated. Carrier links and billing are not touched."
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#E0A93B] animate-pulse" />
            Sandbox, no real messages are sent
          </span>
        )}

        {isAnon && (
          <span className="font-mono text-[10px] text-accent bg-accent/15 px-2 py-0.5 rounded border border-accent/25">
            24h Evaluation Mode
          </span>
        )}

        {/* Search */}
        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface border border-border text-xs text-text-muted hover:text-text hover:border-text-muted/50 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 font-mono text-[10px] bg-surface-2 px-1 rounded border border-border/80 text-text-muted">
            ⌘K
          </kbd>
        </button>

        {/* Environment Switcher */}
        <EnvironmentSwitcher />

        {/* Help Button */}
        <button
          onClick={toggleHelpDrawer}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border text-xs text-text hover:border-accent hover:text-accent transition-colors"
          title="Open Developer Help Panel"
        >
          <HelpCircle className="w-3.5 h-3.5 text-accent" />
          <span className="hidden md:inline font-medium">Help</span>
        </button>

        {/* Docs Link */}
        <Link
          href="/docs"
          className="p-1.5 rounded-md hover:bg-surface-2 text-text-muted hover:text-text transition-colors border border-transparent hover:border-border"
          title="Open Documentation"
        >
          <BookOpen className="w-4 h-4" />
        </Link>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="p-1.5 rounded-md hover:bg-surface-2 text-text-muted hover:text-text transition-colors border border-transparent hover:border-border"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
