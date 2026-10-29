"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Search,
  Eye,
  RefreshCw,
  TrendingUp,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AIActivityClientProps {
  runs: Array<{
    id: string;
    feature: string;
    userId: string;
    inputHash: string;
    output: string;
    model: string;
    latencyMs: number;
    status: string;
    accepted: boolean | null;
    createdAt: Date | string;
  }>;
  stats: {
    totalRuns: number;
    successRuns: number;
    fallbackRuns: number;
    avgLatency: number;
    acceptedRate: number;
    reviewedCount: number;
  };
}

export function AIActivityClient({ runs: initialRuns, stats }: AIActivityClientProps) {
  const [runs] = useState(initialRuns);
  const [featureFilter, setFeatureFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inspectingRun, setInspectingRun] = useState<any | null>(null);

  const filteredRuns = runs.filter((r) => {
    if (featureFilter !== "all" && r.feature !== featureFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-text-muted uppercase font-semibold">
            <span>Total AI Runs</span>
            <Cpu className="h-4 w-4 text-accent" />
          </div>
          <div className="font-mono text-2xl font-bold text-text">{stats.totalRuns}</div>
          <span className="text-[11px] text-text-muted">Logged across all features</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-text-muted uppercase font-semibold">
            <span>Live Inference</span>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <div className="font-mono text-2xl font-bold text-success">
            {stats.successRuns}
          </div>
          <span className="text-[11px] text-text-muted">Gemini GenAI model calls</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-text-muted uppercase font-semibold">
            <span>Fallback Engine</span>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <div className="font-mono text-2xl font-bold text-warning">
            {stats.fallbackRuns}
          </div>
          <span className="text-[11px] text-text-muted">Deterministic rule-based</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-text-muted uppercase font-semibold">
            <span>Avg Latency</span>
            <Clock className="h-4 w-4 text-accent" />
          </div>
          <div className="font-mono text-2xl font-bold text-text">
            {stats.avgLatency} <span className="text-xs font-normal text-text-muted">ms</span>
          </div>
          <span className="text-[11px] text-text-muted">&lt;20s timeout enforced</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-text-muted uppercase font-semibold">
            <span>Acceptance Rate</span>
            <Sparkles className="h-4 w-4 text-success" />
          </div>
          <div className="font-mono text-2xl font-bold text-success">
            {stats.acceptedRate}%
          </div>
          <span className="text-[11px] text-text-muted">
            {stats.reviewedCount} human reviews recorded
          </span>
        </div>
      </div>

      {/* 2. Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-accent" />
          <span className="text-xs font-bold uppercase tracking-wider text-text">
            AI Operations &amp; Audit Telemetry
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={featureFilter}
            onChange={(e) => setFeatureFilter(e.target.value)}
            className="rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text focus:outline-none"
          >
            <option value="all">All Features</option>
            <option value="credit_forecast">Credit Forecast (EWMA)</option>
            <option value="health_summary">QBR Health Summary</option>
            <option value="kyc_extraction">KYC Document Reader</option>
            <option value="churn_prediction">Churn Risk Scoring</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="fallback">Fallback</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* 3. Telemetry Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              <tr>
                <th className="py-2.5 px-3">Timestamp (IST)</th>
                <th className="py-2.5 px-3">Feature</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Feedback</th>
                <th className="py-2.5 px-3">Input Hash</th>
                <th className="py-2.5 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-[11px]">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-text-muted font-sans">
                    No AI execution telemetry records found.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-2 px-3 text-text-muted">
                      {new Date(r.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>

                    <td className="py-2 px-3 font-sans">
                      <span className="font-semibold text-text">
                        {r.feature.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-text-muted">{r.userId}</td>

                    <td className="py-2 px-3">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.2 text-[10px]",
                          r.model.includes("gemini")
                            ? "bg-accent/15 text-accent"
                            : "bg-surface-2 text-text-muted"
                        )}
                      >
                        {r.model}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-text">{r.latencyMs}ms</td>

                    <td className="py-2 px-3">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.2 text-[10px] font-bold uppercase",
                          r.status === "success"
                            ? "bg-success/15 text-success"
                            : r.status === "fallback"
                            ? "bg-warning/15 text-warning"
                            : "bg-danger/15 text-danger"
                        )}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td className="py-2 px-3">
                      {r.accepted === true ? (
                        <span className="text-success font-semibold">Accepted</span>
                      ) : r.accepted === false ? (
                        <span className="text-warning font-semibold">Rejected / Edited</span>
                      ) : (
                        <span className="text-text-muted">Pending</span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-text-muted font-mono text-[10px]">
                      {r.inputHash.substring(0, 10)}...
                    </td>

                    <td className="py-2 px-3 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => setInspectingRun(r)}
                        className="rounded border border-border px-2 py-0.5 text-[11px] text-text hover:border-accent hover:text-accent transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Output Inspection Modal */}
      {inspectingRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg border border-border bg-surface p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-bold text-text uppercase">
                  AI Run Payload: {inspectingRun.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingRun(null)}
                className="text-text-muted hover:text-text text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded border border-border bg-surface-2 p-2">
                <span className="text-text-muted block text-[10px]">Feature:</span>
                <span className="text-text font-bold">{inspectingRun.feature}</span>
              </div>
              <div className="rounded border border-border bg-surface-2 p-2">
                <span className="text-text-muted block text-[10px]">Model &amp; Latency:</span>
                <span className="text-text">
                  {inspectingRun.model} ({inspectingRun.latencyMs}ms)
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-text">Structured Output Payload:</span>
              <pre className="max-h-60 overflow-y-auto rounded border border-border bg-background p-3 font-mono text-[11px] text-text-muted whitespace-pre-wrap">
                {inspectingRun.output}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
