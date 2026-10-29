"use client";

import React, { useEffect, useState } from "react";
import { TrendingUp, AlertTriangle, CheckCircle, ShieldAlert, Calendar } from "lucide-react";
import { formatINR, cn } from "@/lib/utils";
import { getWorkspaceCreditForecastAction } from "@/app/actions/ai-credit";
import { WorkspaceCreditForecast } from "@/lib/services/credit-forecast";
import { AIOutputContainer } from "@/components/ui/AIOutputContainer";

export interface WorkspaceCreditForecastWidgetProps {
  workspaceId: string;
  onRequestLimitChange?: () => void;
}

export function WorkspaceCreditForecastWidget({
  workspaceId,
  onRequestLimitChange,
}: WorkspaceCreditForecastWidgetProps) {
  const [forecast, setForecast] = useState<WorkspaceCreditForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getWorkspaceCreditForecastAction(workspaceId).then((res) => {
      if (mounted && res.success && res.forecast) {
        setForecast(res.forecast);
      }
      if (mounted) setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  if (isLoading || !forecast) {
    return null;
  }

  // Only display for postpaid accounts
  if (forecast.billingModel !== "postpaid") {
    return null;
  }

  const isHighRisk = forecast.projectedUtilizationEomPct >= 90;
  const isMediumRisk = forecast.projectedUtilizationEomPct >= 80;

  return (
    <AIOutputContainer
      featureTitle="Deterministic Credit Exhaustion Forecast (14-Day EWMA)"
      runId={`forecast_${forecast.workspaceId}`}
      isFallback={false}
      asOf={new Date().toISOString()}
      confidence={forecast.confidence}
      inputsSummary={{
        currentUtilization: `${forecast.currentUtilizationPct}%`,
        creditLimit: formatINR(forecast.creditLimit),
        ewmaBurnPerDay: formatINR(forecast.ewmaDailyBurn),
        burnVarianceRange: `${formatINR(forecast.burnVarianceLow)} - ${formatINR(forecast.burnVarianceHigh)}`,
        daysRemainingInMonth: forecast.daysRemainingInMonth,
      }}
      actionSlot={
        onRequestLimitChange && (
          <button
            type="button"
            onClick={onRequestLimitChange}
            className="rounded border border-accent bg-accent/15 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/25 transition-colors"
          >
            Request Credit Limit Change
          </button>
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
        {/* Metric 1 */}
        <div className="rounded border border-border bg-surface-2 p-3 space-y-1">
          <span className="text-[11px] text-text-muted font-sans uppercase">Current Used</span>
          <div className="text-base font-bold text-text">
            {formatINR(forecast.usedCredit)}
          </div>
          <span className="text-[10px] text-text-muted block font-sans">
            {forecast.currentUtilizationPct}% of {formatINR(forecast.creditLimit)}
          </span>
        </div>

        {/* Metric 2 */}
        <div className="rounded border border-border bg-surface-2 p-3 space-y-1">
          <span className="text-[11px] text-text-muted font-sans uppercase">14-Day EWMA Burn</span>
          <div className="text-base font-bold text-accent">
            {formatINR(forecast.ewmaDailyBurn)}/day
          </div>
          <span className="text-[10px] text-text-muted block font-sans">
            ±{formatINR(forecast.burnVarianceHigh - forecast.ewmaDailyBurn)}/d (95% CI)
          </span>
        </div>

        {/* Metric 3 */}
        <div className="rounded border border-border bg-surface-2 p-3 space-y-1">
          <span className="text-[11px] text-text-muted font-sans uppercase">Projected Month-End</span>
          <div
            className={cn(
              "text-base font-bold",
              isHighRisk ? "text-danger" : isMediumRisk ? "text-warning" : "text-success"
            )}
          >
            {forecast.projectedUtilizationEomPct}%
          </div>
          <span className="text-[10px] text-text-muted block font-sans">
            in {forecast.daysRemainingInMonth} days left in billing cycle
          </span>
        </div>

        {/* Metric 4 */}
        <div className="rounded border border-border bg-surface-2 p-3 space-y-1">
          <span className="text-[11px] text-text-muted font-sans uppercase">Projected 80% Breach</span>
          <div
            className={cn(
              "text-sm font-bold truncate",
              forecast.projectedBreach80Date ? "text-warning" : "text-text-muted"
            )}
          >
            {forecast.projectedBreach80Date || "Safe this cycle"}
          </div>
          <span className="text-[10px] text-text-muted block font-sans">
            100% cap: {forecast.projectedBreach100Date || "Not projected"}
          </span>
        </div>
      </div>
    </AIOutputContainer>
  );
}
