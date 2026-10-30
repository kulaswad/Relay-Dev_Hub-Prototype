"use client";

import React, { useState } from "react";
import { CodeBlock } from "./CodeBlock";
import { cn } from "@/lib/utils";

export interface ResponseExample {
  status: number;
  label?: string;
  description?: string;
  body: string | Record<string, any>;
}

interface ResponseTabsProps {
  responses: ResponseExample[];
  className?: string;
}

export function ResponseTabs({ responses, className }: ResponseTabsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!responses || responses.length === 0) return null;

  const current = responses[selectedIndex] || responses[0];

  const getStatusBadge = (code: number) => {
    if (code >= 200 && code < 300) {
      return "text-[#3FB68B] bg-[#3FB68B]/10 border-[#3FB68B]/30";
    }
    if (code >= 400 && code < 500) {
      return "text-[#E0A93B] bg-[#E0A93B]/10 border-[#E0A93B]/30";
    }
    return "text-[#E5534B] bg-[#E5534B]/10 border-[#E5534B]/30";
  };

  const formattedBody =
    typeof current.body === "string"
      ? current.body
      : JSON.stringify(current.body, null, 2);

  return (
    <div className={cn("my-6 rounded-lg border border-border bg-surface overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border bg-[#0C0C0F] px-3 py-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider mr-2">
            Responses:
          </span>
          {responses.map((resp, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={`${resp.status}-${idx}`}
                onClick={() => setSelectedIndex(idx)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium transition-all",
                  isSelected
                    ? "bg-surface-2 text-text border border-border shadow-sm"
                    : "text-text-muted hover:text-text hover:bg-surface-2/40"
                )}
              >
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded text-[10px] font-bold border",
                    getStatusBadge(resp.status)
                  )}
                >
                  {resp.status}
                </span>
                <span>{resp.label || (resp.status === 200 ? "OK" : "Error")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {current.description && (
        <div className="px-4 py-2 text-xs text-text-muted bg-surface-2/20 border-b border-border/50">
          {current.description}
        </div>
      )}

      <div className="-mt-4">
        <CodeBlock
          code={formattedBody}
          language="json"
          className="border-0 rounded-none my-0"
        />
      </div>
    </div>
  );
}
