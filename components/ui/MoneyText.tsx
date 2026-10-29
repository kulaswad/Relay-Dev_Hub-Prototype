"use client";

import React from "react";
import { formatINR, cn } from "@/lib/utils";

export interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number | null | undefined;
  compact?: boolean;
  showDecimals?: boolean;
  highlightNegative?: boolean;
}

export function MoneyText({
  amount,
  compact = false,
  showDecimals = false,
  highlightNegative = true,
  className,
  ...props
}: MoneyTextProps) {
  const isNegative = typeof amount === "number" && amount < 0;
  const formatted = formatINR(amount, { compact, showDecimals });

  return (
    <span
      className={cn(
        "font-mono tabular-nums tracking-tight font-medium",
        isNegative && highlightNegative ? "text-danger" : "text-text",
        className
      )}
      {...props}
    >
      {formatted}
    </span>
  );
}
