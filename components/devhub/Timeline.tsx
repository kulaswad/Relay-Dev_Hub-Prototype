"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string | number;
  time: string;
  title: string;
  description?: string;
  status?: "success" | "warning" | "danger" | "info" | "neutral";
  badge?: string;
  payload?: any;
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  const dotColors = {
    success: "bg-[#3FB68B]",
    warning: "bg-[#E0A93B]",
    danger: "bg-[#E5534B]",
    info: "bg-[#5B9DFF]",
    neutral: "bg-border",
  };

  return (
    <div className={cn("relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border", className)}>
      {items.map((item) => {
        const dotColor = dotColors[item.status || "neutral"];

        return (
          <div key={item.id} className="relative group">
            {/* Timeline node dot */}
            <div
              className={cn(
                "absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center",
                dotColor
              )}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text">{item.title}</span>
                {item.badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 text-text-muted border border-border">
                    {item.badge}
                  </span>
                )}
              </div>
              <time className="text-[11px] font-mono text-text-muted">{item.time}</time>
            </div>

            {item.description && (
              <p className="text-xs text-text-muted leading-relaxed">
                {item.description}
              </p>
            )}

            {item.payload && (
              <div className="mt-2 p-2 rounded bg-[#0C0C0F] border border-border/80 font-mono text-[11px] text-text-muted overflow-x-auto">
                <pre>{typeof item.payload === "string" ? item.payload : JSON.stringify(item.payload, null, 2)}</pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
