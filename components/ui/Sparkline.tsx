import React from "react";
import { cn } from "@/lib/utils";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  trend?: "up" | "down" | "neutral";
}

export function Sparkline({
  data,
  width = 96,
  height = 28,
  color,
  trend,
  className,
}: SparklineProps) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="bg-surface-2/50 rounded" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const usableHeight = height - padding * 2;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - padding - ((val - min) / range) * usableHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  let strokeColor = color;
  if (!strokeColor) {
    if (trend === "up") strokeColor = "#3FB68B"; // success
    else if (trend === "down") strokeColor = "#E5534B"; // danger
    else strokeColor = "#7C7CFF"; // accent
  }

  return (
    <div className={cn("inline-flex items-center", className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}
