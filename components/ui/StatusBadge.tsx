"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type StatusType =
  | "active"
  | "healthy"
  | "verified"
  | "approved"
  | "paid"
  | "at_risk"
  | "warning"
  | "pending"
  | "pending_review"
  | "onboarding"
  | "overdue"
  | "suspended"
  | "rejected"
  | "neutral"
  | "draft"
  | string;

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusType;
  label?: string;
  size?: "sm" | "md";
  showDot?: boolean;
}

export function StatusBadge({
  status,
  label,
  size = "md",
  showDot = true,
  className,
  ...props
}: StatusBadgeProps) {
  const norm = status?.toLowerCase() || "neutral";

  let dotColor = "bg-text-muted";
  let textColor = "text-text-muted";
  let borderColor = "border-border";
  let displayLabel = label || status;

  if (["active", "healthy", "verified", "approved", "paid"].includes(norm)) {
    dotColor = "bg-success";
    textColor = "text-text";
    borderColor = "border-success/20";
    if (!label) displayLabel = norm === "active" ? "Active" : norm === "verified" ? "Verified" : norm === "paid" ? "Paid" : "Approved";
  } else if (["at_risk", "warning", "pending", "pending_review", "onboarding"].includes(norm)) {
    dotColor = "bg-warning";
    textColor = "text-text";
    borderColor = "border-warning/20";
    if (!label) {
      displayLabel = norm === "at_risk" ? "At Risk" : norm === "pending_review" ? "Under Review" : norm === "onboarding" ? "Onboarding" : "Pending";
    }
  } else if (["suspended", "rejected", "overdue"].includes(norm)) {
    dotColor = "bg-danger";
    textColor = "text-danger";
    borderColor = "border-danger/30";
    if (!label) {
      displayLabel = norm === "suspended" ? "Suspended" : norm === "overdue" ? "Overdue" : "Rejected";
    }
  } else if (["info", "growth", "enterprise", "postpaid"].includes(norm)) {
    dotColor = "bg-accent";
    textColor = "text-text";
    borderColor = "border-accent/20";
    if (!label) displayLabel = norm.charAt(0).toUpperCase() + norm.slice(1);
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-surface-2 font-mono tracking-tight transition-colors",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        borderColor,
        textColor,
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)}
          aria-hidden="true"
        />
      )}
      <span className="font-sans font-medium">{displayLabel}</span>
    </div>
  );
}
