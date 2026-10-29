import React from "react";
import { cn } from "@/lib/utils";

export interface KeyValueItem {
  key: string;
  value: React.ReactNode;
  isMono?: boolean;
  copyable?: boolean;
}

export interface KeyValueListProps {
  items: KeyValueItem[];
  columns?: 1 | 2;
  className?: string;
}

export function KeyValueList({
  items,
  columns = 1,
  className,
}: KeyValueListProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface divide-y divide-border",
        columns === 2 && "grid grid-cols-1 md:grid-cols-2 divide-y-0 md:gap-px md:bg-border",
        className
      )}
    >
      {items.map((item, idx) => (
        <div
          key={idx}
          className={cn(
            "flex items-center justify-between px-4 py-2.5 text-xs bg-surface hover:bg-surface-2/40 transition-colors",
            columns === 2 && "bg-surface"
          )}
        >
          <span className="text-text-muted font-normal tracking-tight">
            {item.key}
          </span>
          <span
            className={cn(
              "font-medium text-text text-right truncate max-w-[60%]",
              item.isMono && "font-mono tabular-nums text-[12px]"
            )}
          >
            {item.value ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
