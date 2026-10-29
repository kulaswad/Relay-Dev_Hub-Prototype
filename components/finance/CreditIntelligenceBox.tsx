"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Search,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  UserPlus,
  Sliders,
  DollarSign,
  Calendar,
  CheckCircle2,
  Tag,
  Loader2,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { runCreditQueryAction, createAMTaskForBreachAction } from "@/app/actions/ai-credit";
import { AIOutputContainer } from "@/components/ui/AIOutputContainer";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";
import { WorkspaceCreditForecast, CreditQueryResult } from "@/lib/services/credit-forecast";

export interface CreditIntelligenceBoxProps {
  onOpenLimitModal?: (workspaceId: string) => void;
}

export function CreditIntelligenceBox({ onOpenLimitModal }: CreditIntelligenceBoxProps) {
  const [queryInput, setQueryInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [queryResponse, setQueryResponse] = useState<any | null>(null);
  const [taskCreatingId, setTaskCreatingId] = useState<string | null>(null);

  const defaultExampleQueries = [
    "which customers will cross 80% of their credit limit this month",
    "postpaid accounts with overdue invoices and high utilization",
    "accounts at risk of exhaustion within 7 days",
    "Fintech clients with burn rate over ₹50,000/day",
  ];

  const handleSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : queryInput).trim();
    if (!q) return;

    setQueryInput(q);
    setIsLoading(true);

    try {
      const res = await runCreditQueryAction(q);
      if (!res.success || !res.result) {
        throw new Error(res.error || "Failed to process query.");
      }
      setQueryResponse(res.result);
    } catch (err: any) {
      toast({
        title: "Query Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async (row: WorkspaceCreditForecast) => {
    setTaskCreatingId(row.workspaceId);
    try {
      const title = `Credit Risk Follow-up: ${row.workspaceName} projected to reach ${row.projectedUtilizationEomPct}% utilization by month-end.`;
      const res = await createAMTaskForBreachAction({
        orgId: row.orgId,
        title,
        assignedTo: row.assignedAmId,
      });

      if (res.success) {
        toast({
          title: "AM Task Created",
          description: `Assigned task to ${row.assignedAmName} (source: ai_recommendation).`,
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast({
        title: "Task Creation Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setTaskCreatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input Box */}
      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="h-4 w-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-text">
              Natural-Language Credit Query &amp; EWMA Forecast
            </h3>
          </div>
          <span className="text-[11px] text-text-muted">
            Gemini-assisted structured filter translation (SQL never generated)
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder='e.g. "which customers will cross 80% of their credit limit this month"'
              className="w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 py-2 text-xs text-text placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !queryInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Interpreting...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ask</span>
              </>
            )}
          </button>
        </form>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-text-muted font-medium">Examples:</span>
          {defaultExampleQueries.map((ex, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSearch(ex)}
              className="rounded border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted hover:border-accent/40 hover:text-accent transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Query Results wrapped in AI Container */}
      {queryResponse && (
        <AIOutputContainer
          featureTitle="Credit Exhaustion & Utilization Forecast"
          runId={queryResponse.runId}
          isFallback={queryResponse.isFallback}
          fallbackReason={queryResponse.fallbackReason}
          asOf={queryResponse.asOf}
          confidence={queryResponse.data?.results?.[0]?.confidence || "high"}
          inputsSummary={{
            ...queryResponse.inputsSummary,
            totalWorkspacesEvaluated: queryResponse.data?.results?.length,
            daysRemainingInMonth: queryResponse.data?.results?.[0]?.daysRemainingInMonth,
          }}
        >
          {/* Interpreted Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 bg-surface-2/60 p-2.5 rounded border border-border">
            <span className="text-[11px] font-semibold text-text-muted flex items-center gap-1">
              <Tag className="h-3 w-3 text-accent" />
              Interpreted Filter Chips:
            </span>
            {queryResponse.data.filterChips.map((chip: string, idx: number) => (
              <span
                key={idx}
                className="inline-flex items-center rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[11px] font-mono text-accent font-medium"
              >
                {chip}
              </span>
            ))}
            <span className="ml-auto text-[11px] font-mono text-text-muted">
              {queryResponse.data.totalMatches} match{queryResponse.data.totalMatches === 1 ? "" : "es"} found
            </span>
          </div>

          {/* Results Table */}
          {queryResponse.data.results.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              No workspaces matched the structured filter criteria. Try adjusting your query.
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="py-2.5 px-3">Organization &amp; Workspace</th>
                    <th className="py-2.5 px-3">Current Util</th>
                    <th className="py-2.5 px-3">14d EWMA Burn</th>
                    <th className="py-2.5 px-3">Projected EOM</th>
                    <th className="py-2.5 px-3">80% Breach Date</th>
                    <th className="py-2.5 px-3">100% Breach Date</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Overdue</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-[11px]">
                  {queryResponse.data.results.map((row: WorkspaceCreditForecast) => {
                    const isHighRisk = row.projectedUtilizationEomPct >= 90;
                    const isMediumRisk = row.projectedUtilizationEomPct >= 80;

                    return (
                      <tr key={row.workspaceId} className="hover:bg-surface-2/40 transition-colors">
                        <td className="py-2 px-3 font-sans">
                          <Link
                            href={`/accounts/${row.orgId}`}
                            className="font-semibold text-text hover:text-accent hover:underline block"
                          >
                            {row.orgName}
                          </Link>
                          <span className="text-[11px] text-text-muted">
                            {row.workspaceName} · {row.industry}
                          </span>
                        </td>

                        <td className="py-2 px-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span>{row.currentUtilizationPct}%</span>
                              <span className="text-text-muted">
                                {formatINR(row.usedCredit)} / {formatINR(row.creditLimit)}
                              </span>
                            </div>
                            <div className="h-1.5 w-24 rounded-full bg-surface-2 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  row.currentUtilizationPct >= 90
                                    ? "bg-danger"
                                    : row.currentUtilizationPct >= 80
                                    ? "bg-warning"
                                    : "bg-success"
                                )}
                                style={{ width: `${Math.min(100, row.currentUtilizationPct)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-2 px-3 text-text">
                          {formatINR(row.ewmaDailyBurn)}
                          <span className="text-[10px] text-text-muted block">
                            ±{formatINR(row.burnVarianceHigh - row.ewmaDailyBurn)}/d
                          </span>
                        </td>

                        <td className="py-2 px-3">
                          <span
                            className={cn(
                              "font-bold px-1.5 py-0.5 rounded",
                              isHighRisk
                                ? "bg-danger/20 text-danger border border-danger/40"
                                : isMediumRisk
                                ? "bg-warning/20 text-warning border border-warning/40"
                                : "text-text"
                            )}
                          >
                            {row.projectedUtilizationEomPct}%
                          </span>
                        </td>

                        <td className="py-2 px-3">
                          {row.projectedBreach80Date ? (
                            <span
                              className={cn(
                                "font-semibold",
                                row.projectedBreach80Date === "Already breached"
                                  ? "text-danger"
                                  : "text-warning"
                              )}
                            >
                              {row.projectedBreach80Date}
                            </span>
                          ) : (
                            <span className="text-text-muted">None</span>
                          )}
                        </td>

                        <td className="py-2 px-3">
                          {row.projectedBreach100Date ? (
                            <span className="font-bold text-danger">
                              {row.projectedBreach100Date}
                            </span>
                          ) : (
                            <span className="text-text-muted">None</span>
                          )}
                        </td>

                        <td className="py-2 px-3">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] uppercase font-bold",
                              row.confidence === "high"
                                ? "bg-success/15 text-success"
                                : row.confidence === "medium"
                                ? "bg-warning/15 text-warning"
                                : "bg-surface-2 text-text-muted"
                            )}
                          >
                            {row.confidence}
                          </span>
                        </td>

                        <td className="py-2 px-3">
                          {row.overdueAmount > 0 ? (
                            <div className="text-danger font-semibold">
                              {formatINR(row.overdueAmount)}
                              <span className="text-[10px] text-danger/80 block">
                                {row.maxDaysOverdue}d overdue
                              </span>
                            </div>
                          ) : (
                            <span className="text-success">₹0</span>
                          )}
                        </td>

                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1 font-sans">
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenLimitModal) {
                                  onOpenLimitModal(row.workspaceId);
                                } else {
                                  window.location.href = `/accounts/${row.orgId}`;
                                }
                              }}
                              className="rounded border border-border bg-surface-2 px-2 py-1 text-[11px] font-medium text-text hover:border-accent hover:text-accent transition-colors"
                            >
                              Raise limit
                            </button>

                            <button
                              type="button"
                              disabled={taskCreatingId === row.workspaceId}
                              onClick={() => handleCreateTask(row)}
                              className="rounded border border-accent/40 bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25 transition-colors disabled:opacity-50"
                              title={`Create task for AM ${row.assignedAmName}`}
                            >
                              {taskCreatingId === row.workspaceId ? "..." : "Create task"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AIOutputContainer>
      )}
    </div>
  );
}
