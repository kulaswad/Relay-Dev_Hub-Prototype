import React from "react";
import { cn, formatDateTimeIST } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  title: string;
  actorName: string;
  actorRole?: string;
  timestamp: Date | string | number;
  reason?: string | null;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  if (!items || items.length === 0) {
    return (
      <div className="text-xs text-text-muted py-4 text-center">
        No timeline events recorded.
      </div>
    );
  }

  return (
    <div className={cn("relative pl-4 space-y-6 before:absolute before:bottom-0 before:top-2 before:left-[19px] before:w-px before:bg-border", className)}>
      {items.map((item) => (
        <div key={item.id} className="relative flex items-start gap-3.5 group">
          {/* Node marker */}
          <div className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2 border-surface bg-accent ring-2 ring-border/60 mt-1 transition-transform group-hover:scale-110" />

          {/* Content card */}
          <div className="flex-1 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text tracking-tight">
                  {item.title}
                </span>
                {item.badge}
              </div>
              <time className="text-[11px] font-mono text-text-muted tabular-nums">
                {formatDateTimeIST(item.timestamp)}
              </time>
            </div>

            <div className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
              <span>by</span>
              <span className="font-medium text-text">{item.actorName}</span>
              {item.actorRole && (
                <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[10px] text-text-muted border border-border">
                  {item.actorRole}
                </span>
              )}
            </div>

            {item.reason && (
              <p className="mt-2 text-xs text-text-muted/90 bg-surface-2/60 rounded p-2 border border-border/50 italic leading-relaxed">
                "{item.reason}"
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
