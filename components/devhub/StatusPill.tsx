"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "test"
  | "live"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

interface StatusPillProps {
  variant?: StatusVariant;
  label?: string;
  showDot?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  title?: string;
}

export function StatusPill({
  variant = "neutral",
  label,
  showDot = true,
  size = "md",
  className,
  onClick,
  title,
}: StatusPillProps) {
  const defaultLabels: Record<StatusVariant, string> = {
    test: "Test Sandbox",
    live: "Live Production",
    success: "Active",
    warning: "Pending KYC",
    danger: "Blocked / Failed",
    info: "Info",
    neutral: "Draft",
  };

  const text = label || defaultLabels[variant];

  // Specific color tokens from design specification:
  // Test: amber (#E0A93B)
  // Live: green (#3FB68B)
  // Success: #3FB68B
  // Warning: #E0A93B
  // Danger: #E5534B
  // Info: #5B9DFF
  const variantStyles: Record<StatusVariant, { badge: string; dot: string; pulse?: boolean }> = {
    test: {
      badge: "border-[#E0A93B]/30 bg-[#E0A93B]/10 text-[#E0A93B]",
      dot: "bg-[#E0A93B]",
      pulse: false,
    },
    live: {
      badge: "border-[#3FB68B]/30 bg-[#3FB68B]/10 text-[#3FB68B]",
      dot: "bg-[#3FB68B]",
      pulse: true,
    },
    success: {
      badge: "border-[#3FB68B]/30 bg-[#3FB68B]/10 text-[#3FB68B]",
      dot: "bg-[#3FB68B]",
      pulse: false,
    },
    warning: {
      badge: "border-[#E0A93B]/30 bg-[#E0A93B]/10 text-[#E0A93B]",
      dot: "bg-[#E0A93B]",
      pulse: false,
    },
    danger: {
      badge: "border-[#E5534B]/30 bg-[#E5534B]/10 text-[#E5534B]",
      dot: "bg-[#E5534B]",
      pulse: false,
    },
    info: {
      badge: "border-[#5B9DFF]/30 bg-[#5B9DFF]/10 text-[#5B9DFF]",
      dot: "bg-[#5B9DFF]",
      pulse: false,
    },
    neutral: {
      badge: "border-[#222228] bg-[#16161A] text-[#8A8A94]",
      dot: "bg-[#8A8A94]",
      pulse: false,
    },
  };

  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5 gap-1.5 h-5",
    md: "text-xs px-2.5 py-1 gap-1.5 h-6",
    lg: "text-sm px-3 py-1.5 gap-2 h-8",
  };

  const current = variantStyles[variant];

  return (
    <span
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center font-medium rounded-full border transition-colors select-none",
        current.badge,
        sizeStyles[size],
        onClick && "cursor-pointer hover:brightness-110",
        className
      )}
    >
      {showDot && (
        <span className="relative flex h-2 w-2 shrink-0">
          {current.pulse && (
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                current.dot
              )}
            />
          )}
          <span className={cn("relative inline-flex rounded-full h-2 w-2", current.dot)} />
        </span>
      )}
      <span className="truncate">{text}</span>
    </span>
  );
}
