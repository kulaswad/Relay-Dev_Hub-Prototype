"use client";

import React from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-surface/50 my-6",
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-text-muted mb-3 border border-border">
        <Icon className="w-6 h-6 text-accent" />
      </div>

      <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
      <p className="text-xs text-text-muted max-w-sm mb-4 leading-relaxed">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors shadow-sm"
        >
          {action.icon && React.createElement(action.icon, { className: "w-3.5 h-3.5" })}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
}
