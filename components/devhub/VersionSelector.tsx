"use client";

import React, { useState } from "react";
import { useDevHub } from "@/components/providers/DevHubContext";
import { ChevronDown, Check, GitCommit } from "lucide-react";
import { cn } from "@/lib/utils";

const versions = [
  { id: "v2025-10-01", label: "v2025-10-01", status: "Current GA", date: "Oct 2025" },
  { id: "v2025-01-15", label: "v2025-01-15", status: "Supported", date: "Jan 2025" },
  { id: "v2024-06-01", label: "v2024-06-01", status: "Deprecated", date: "Jun 2024" },
];

export function VersionSelector({ className }: { className?: string }) {
  const { apiVersion, setApiVersion } = useDevHub();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-border hover:border-text-muted text-xs font-mono text-text transition-colors"
      >
        <GitCommit className="w-3 h-3 text-accent" />
        <span>{apiVersion}</span>
        <ChevronDown className="w-3 h-3 text-text-muted" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-surface shadow-2xl p-1.5 z-50">
            <div className="px-2 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider font-mono">
              API Versions
            </div>

            {versions.map((ver) => {
              const isSelected = ver.id === apiVersion;
              return (
                <button
                  key={ver.id}
                  onClick={() => {
                    setApiVersion(ver.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left p-2 rounded text-xs font-mono transition-colors flex items-center justify-between",
                    isSelected
                      ? "bg-surface-2 text-text"
                      : "hover:bg-surface-2/60 text-text-muted"
                  )}
                >
                  <div>
                    <div className="font-bold text-text">{ver.label}</div>
                    <div className="text-[10px] text-text-muted">
                      {ver.status} • {ver.date}
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
