"use client";

import React from "react";
import Link from "next/link";
import { useDevHub } from "@/components/providers/DevHubContext";
import { AlertTriangle, Info, ArrowRight, RotateCw } from "lucide-react";

export function DocVersionBanner() {
  const { apiVersion, setApiVersion } = useDevHub();

  if (apiVersion === "v2024-06-01") {
    return (
      <div className="p-4 rounded-xl border border-[#E5534B]/40 bg-[#E5534B]/10 text-xs text-text space-y-2 mb-6">
        <div className="flex items-center gap-2 font-bold text-[#E5534B]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Viewing Deprecated API Version: v2024-06-01</span>
        </div>
        <p className="text-text-muted leading-relaxed">
          Version <code className="text-accent font-mono">v2024-06-01</code> has been deprecated and will be sunset on <strong>June 1, 2027</strong>. In this legacy version, messages use <code className="text-accent font-mono">phone</code> instead of <code className="text-accent font-mono">to</code>, status lifecycle differed, and CDP customer profile traits were not supported.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={() => setApiVersion("v2025-10-01")}
            className="px-2.5 py-1 rounded bg-accent text-white font-medium flex items-center gap-1 hover:bg-accent/90 transition-colors"
          >
            <RotateCw className="w-3 h-3" />
            <span>Switch to Latest (v2025-10-01)</span>
          </button>
          <Link
            href="/docs/migrating-between-versions"
            className="text-accent hover:underline flex items-center gap-1 font-mono"
          >
            <span>Read Migration Guide</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
          <Link
            href="/docs/compare-versions"
            className="text-text-muted hover:text-text flex items-center gap-1 font-mono"
          >
            <span>Compare Versions</span>
          </Link>
        </div>
      </div>
    );
  }

  if (apiVersion === "v2025-01-15") {
    return (
      <div className="p-3.5 rounded-xl border border-accent/30 bg-surface text-xs text-text flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-accent shrink-0" />
          <span className="text-text-muted">
            Viewing version <strong className="text-text font-mono">v2025-01-15 (Supported)</strong>. Switch to current GA for WhatsApp Business and latest CDP traits.
          </span>
        </div>
        <button
          onClick={() => setApiVersion("v2025-10-01")}
          className="px-2.5 py-1 rounded bg-surface-2 hover:bg-surface border border-border text-accent text-xs font-mono font-medium shrink-0 flex items-center gap-1"
        >
          <span>Switch to v2025-10-01</span>
        </button>
      </div>
    );
  }

  return null;
}
