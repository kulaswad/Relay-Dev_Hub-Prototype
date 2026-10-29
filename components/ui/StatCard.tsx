import React from "react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  change?: {
    value: string;
    trend: "up" | "down" | "neutral";
  };
  sparklineData?: number[];
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  change,
  sparklineData,
  icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-4 flex flex-col justify-between transition-colors hover:border-border/80",
        className
      )}
    >
      <div className="flex items-center justify-between text-xs text-text-muted mb-2">
        <span className="font-medium tracking-tight">{title}</span>
        {icon && <div className="text-text-muted">{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1">
        <div className="text-2xl font-semibold tracking-tight text-text">
          {value}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline
            data={sparklineData}
            trend={change?.trend}
            className="opacity-80 hover:opacity-100 transition-opacity"
          />
        )}
      </div>

      {(subtitle || change) && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50 text-[11px] text-text-muted">
          {change && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                change.trend === "up" && "text-success",
                change.trend === "down" && "text-danger",
                change.trend === "neutral" && "text-text-muted"
              )}
            >
              {change.trend === "up" && <TrendingUp className="h-3 w-3" />}
              {change.trend === "down" && <TrendingDown className="h-3 w-3" />}
              {change.trend === "neutral" && <Minus className="h-3 w-3" />}
              {change.value}
            </span>
          )}
          {subtitle && <span className="truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
