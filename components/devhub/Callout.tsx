"use client";

import React from "react";
import { Info, AlertTriangle, AlertCircle, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalloutType = "note" | "warn" | "warning" | "deprecated" | "info" | "tip";

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Callout({
  type = "note",
  title,
  children,
  className,
}: CalloutProps) {
  const configs: Record<
    CalloutType,
    { icon: React.ReactNode; border: string; bg: string; titleColor: string }
  > = {
    note: {
      icon: <Info className="w-4 h-4 text-[#5B9DFF] shrink-0" />,
      border: "border-[#5B9DFF]/30",
      bg: "bg-[#5B9DFF]/5",
      titleColor: "text-[#5B9DFF]",
    },
    info: {
      icon: <Info className="w-4 h-4 text-[#5B9DFF] shrink-0" />,
      border: "border-[#5B9DFF]/30",
      bg: "bg-[#5B9DFF]/5",
      titleColor: "text-[#5B9DFF]",
    },
    tip: {
      icon: <Info className="w-4 h-4 text-[#3FB68B] shrink-0" />,
      border: "border-[#3FB68B]/30",
      bg: "bg-[#3FB68B]/5",
      titleColor: "text-[#3FB68B]",
    },
    warn: {
      icon: <AlertTriangle className="w-4 h-4 text-[#E0A93B] shrink-0" />,
      border: "border-[#E0A93B]/30",
      bg: "bg-[#E0A93B]/5",
      titleColor: "text-[#E0A93B]",
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-[#E0A93B] shrink-0" />,
      border: "border-[#E0A93B]/30",
      bg: "bg-[#E0A93B]/5",
      titleColor: "text-[#E0A93B]",
    },
    deprecated: {
      icon: <Ban className="w-4 h-4 text-[#E5534B] shrink-0" />,
      border: "border-[#E5534B]/30",
      bg: "bg-[#E5534B]/5",
      titleColor: "text-[#E5534B]",
    },
  };

  const config = configs[type] || configs.note;

  return (
    <div
      className={cn(
        "my-4 p-3.5 rounded-lg border text-xs leading-relaxed flex gap-3",
        config.border,
        config.bg,
        className
      )}
    >
      <div className="mt-0.5">{config.icon}</div>
      <div className="flex-1 space-y-1">
        {title && (
          <h4 className={cn("font-semibold font-mono uppercase tracking-wide text-[11px]", config.titleColor)}>
            {title}
          </h4>
        )}
        <div className="text-text/90 [&>p]:mb-1 last:[&>p]:mb-0">{children}</div>
      </div>
    </div>
  );
}
