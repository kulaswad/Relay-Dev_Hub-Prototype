"use client";

import React from "react";
import { Plus, RefreshCw, Minus, AlertCircle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DiffType = "added" | "changed" | "removed" | "deprecated" | "fixed" | "security";

interface DiffBadgeProps {
  type: DiffType;
  label?: string;
  className?: string;
}

export function DiffBadge({ type, label, className }: DiffBadgeProps) {
  const configs: Record<
    DiffType,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    added: {
      label: "Added",
      bg: "bg-[#3FB68B]/10",
      text: "text-[#3FB68B]",
      border: "border-[#3FB68B]/30",
      icon: <Plus className="w-3 h-3" />,
    },
    changed: {
      label: "Changed",
      bg: "bg-[#5B9DFF]/10",
      text: "text-[#5B9DFF]",
      border: "border-[#5B9DFF]/30",
      icon: <RefreshCw className="w-2.5 h-2.5" />,
    },
    fixed: {
      label: "Fixed",
      bg: "bg-[#7C7CFF]/10",
      text: "text-[#7C7CFF]",
      border: "border-[#7C7CFF]/30",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    removed: {
      label: "Removed",
      bg: "bg-[#E5534B]/10",
      text: "text-[#E5534B]",
      border: "border-[#E5534B]/30",
      icon: <Minus className="w-3 h-3" />,
    },
    deprecated: {
      label: "Deprecated",
      bg: "bg-[#E0A93B]/10",
      text: "text-[#E0A93B]",
      border: "border-[#E0A93B]/30",
      icon: <AlertCircle className="w-3 h-3" />,
    },
    security: {
      label: "Security",
      bg: "bg-[#E5534B]/15",
      text: "text-[#E5534B]",
      border: "border-[#E5534B]/40",
      icon: <ShieldAlert className="w-3 h-3" />,
    },
  };

  const current = configs[type] || configs.added;
  const textLabel = label || current.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium border select-none",
        current.bg,
        current.text,
        current.border,
        className
      )}
    >
      {current.icon}
      <span>{textLabel}</span>
    </span>
  );
}
