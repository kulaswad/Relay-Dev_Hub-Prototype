import React from "react";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/50 p-10 text-center",
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-muted mb-3">
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-sm font-semibold tracking-tight text-text">
        {title}
      </h3>
      <p className="mt-1 text-xs text-text-muted max-w-sm leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
