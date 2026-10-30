"use client";

import React, { useState } from "react";
import { Copy, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface EndpointHeaderProps {
  method: HttpMethod;
  path: string;
  description?: string;
  auth?: string;
  className?: string;
}

export function EndpointHeader({
  method,
  path,
  description,
  auth = "Bearer API Key",
  className,
}: EndpointHeaderProps) {
  const [copied, setCopied] = useState(false);

  // Method badges as specified:
  // GET green (#3FB68B)
  // POST accent (#7C7CFF)
  // PUT amber (#E0A93B)
  // DELETE red (#E5534B)
  // PATCH amber/cyan
  const methodStyles: Record<HttpMethod, string> = {
    GET: "bg-[#3FB68B]/15 text-[#3FB68B] border-[#3FB68B]/30",
    POST: "bg-[#7C7CFF]/15 text-[#7C7CFF] border-[#7C7CFF]/30",
    PUT: "bg-[#E0A93B]/15 text-[#E0A93B] border-[#E0A93B]/30",
    DELETE: "bg-[#E5534B]/15 text-[#E5534B] border-[#E5534B]/30",
    PATCH: "bg-[#E0A93B]/15 text-[#E0A93B] border-[#E0A93B]/30",
  };

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className={cn("space-y-2 mb-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-surface">
        <div className="flex items-center gap-3 font-mono text-sm flex-wrap">
          <span
            className={cn(
              "px-2.5 py-1 text-xs font-bold rounded border tracking-wider",
              methodStyles[method] || methodStyles.GET
            )}
          >
            {method}
          </span>
          <span className="text-text font-semibold tracking-tight">{path}</span>
        </div>

        <div className="flex items-center gap-2">
          {auth && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-text-muted bg-surface-2 border border-border">
              <Lock className="w-3 h-3 text-text-muted" />
              {auth}
            </span>
          )}

          <button
            onClick={copyPath}
            aria-label="Copy endpoint path"
            className="p-1.5 rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors border border-transparent hover:border-border"
            title="Copy path"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {description && (
        <p className="text-sm text-text-muted leading-relaxed px-1">
          {description}
        </p>
      )}
    </div>
  );
}
