"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  TrendingDown,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Plus,
  X,
  Sliders,
  DollarSign,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { createRecommendationTaskAction, dismissRecommendationAction } from "@/app/actions/ai-churn";
import { AIOutputContainer } from "@/components/ui/AIOutputContainer";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";
import { ChurnAnalysis, UnusedSeatAnalysis, ChurnRecommendation } from "@/lib/services/churn-seats";

export interface ChurnRiskAndSeatsCardProps {
  churn: ChurnAnalysis;
  seats: UnusedSeatAnalysis;
  recommendations: ChurnRecommendation[];
  orgId: string;
  onOpenSeatReductionModal?: () => void;
}

export function ChurnRiskAndSeatsCard({
  churn,
  seats,
  recommendations: initialRecs,
  orgId,
  onOpenSeatReductionModal,
}: ChurnRiskAndSeatsCardProps) {
  const [recs, setRecs] = useState<ChurnRecommendation[]>(initialRecs);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);

  const handleCreateTask = async (rec: ChurnRecommendation) => {
    setCreatingTaskId(rec.id);
    try {
      const res = await createRecommendationTaskAction({
        orgId,
        title: `[AI Rec] ${rec.title}`,
      });

      if (res.success) {
        toast({
          title: "Task Assigned to AM",
          description: `Created task with source: ai_recommendation.`,
        });
        // Remove from list
        setRecs((prev) => prev.filter((r) => r.id !== rec.id));
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
      setCreatingTaskId(null);
    }
  };

  const handleDismiss = async (recId: string) => {
    try {
      await dismissRecommendationAction(recId, dismissReason || "Not useful at this time");
      toast({
        title: "Recommendation Dismissed",
        description: "Feedback logged to audit telemetry.",
      });
      setRecs((prev) => prev.filter((r) => r.id !== recId));
      setDismissingId(null);
      setDismissReason("");
    } catch (err: any) {
      toast({
        title: "Dismissal Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Transparent Weighted Churn Score Card */}
      <AIOutputContainer
        featureTitle="Transparent Weighted Churn Risk Model (Deterministic, Non-LLM)"
        runId={`churn_${churn.orgId}`}
        isFallback={false}
        asOf={new Date().toISOString()}
        confidence="high"
        inputsSummary={{
          totalSignalsEvaluated: churn.signals.length,
          activeSignalsCount: churn.signals.filter((s) => s.isTriggered).length,
          riskBand: churn.riskBand,
        }}
      >
        <div className="space-y-4">
          {/* Header Score Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface-2 p-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg font-mono text-lg font-bold border",
                  churn.riskBand === "High"
                    ? "bg-danger/20 text-danger border-danger/40"
                    : churn.riskBand === "Medium"
                    ? "bg-warning/20 text-warning border-warning/40"
                    : "bg-success/20 text-success border-success/40"
                )}
              >
                {churn.totalScore}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-text">
                    Churn Probability: {churn.riskBand} Band
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-mono uppercase font-bold",
                      churn.riskBand === "High"
                        ? "bg-danger/20 text-danger"
                        : churn.riskBand === "Medium"
                        ? "bg-warning/20 text-warning"
                        : "bg-success/20 text-success"
                    )}
                  >
                    {churn.totalScore}/100 Score
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">{churn.summaryText}</p>
              </div>
            </div>

            <span className="text-[10px] font-mono text-text-muted">
              Mathematical signals (0-100) with fixed risk weights
            </span>
          </div>

          {/* Contributing Signals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {churn.signals.map((sig, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded border p-2.5 space-y-1 transition-colors text-xs",
                  sig.isTriggered
                    ? "border-warning/50 bg-warning/5"
                    : "border-border bg-surface-2/60"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text truncate max-w-[170px]">
                    {sig.title}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px] font-bold px-1.5 py-0.2 rounded",
                      sig.pointsAdded > 0
                        ? "bg-danger/20 text-danger"
                        : "bg-surface-2 text-text-muted"
                    )}
                  >
                    +{sig.pointsAdded} pts
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-text-muted">{sig.valueDisplay}</span>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase",
                      sig.isTriggered ? "text-warning" : "text-success"
                    )}
                  >
                    {sig.isTriggered ? "Risk Factor" : "Healthy"}
                  </span>
                </div>

                <p className="text-[10px] text-text-muted leading-tight">{sig.description}</p>
              </div>
            ))}
          </div>
        </div>
      </AIOutputContainer>

      {/* 2. Unused Seat Detection Card */}
      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-accent/15 text-accent border border-accent/30">
              <Users className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-text">
              Unused Seat Licensing Waste Detector
            </span>
          </div>

          <span className="text-[11px] font-mono text-text-muted">
            Inactive threshold: &gt;45 days with zero login
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded border border-border bg-surface-2 p-3 space-y-1">
            <span className="text-[11px] text-text-muted uppercase">Seat Reconciliation</span>
            <div className="font-mono text-base font-bold text-text">
              {seats.activeSeats} <span className="text-xs font-normal text-text-muted">active</span> / {seats.totalPurchasedSeats} <span className="text-xs font-normal text-text-muted">total</span>
            </div>
            <span className="text-[10px] text-text-muted block">
              {seats.inactiveSeatsCount} unutilized removable seat(s)
            </span>
          </div>

          <div className="rounded border border-border bg-surface-2 p-3 space-y-1">
            <span className="text-[11px] text-text-muted uppercase">Estimated Monthly Waste</span>
            <div className="font-mono text-base font-bold text-warning">
              {formatINR(seats.estimatedMonthlyWasteInr)}
              <span className="text-xs font-normal text-text-muted">/month</span>
            </div>
            <span className="text-[10px] text-text-muted block">
              Calculated at {formatINR(seats.costPerSeatMonthlyInr)} per seat
            </span>
          </div>

          <div className="rounded border border-border bg-surface-2 p-3 space-y-2 flex flex-col justify-between">
            <span className="text-[11px] text-text-muted uppercase">Recommended Action</span>
            <div className="text-xs font-semibold text-text">
              {seats.recommendedAction}
            </div>

            {seats.inactiveSeatsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenSeatReductionModal) {
                    onOpenSeatReductionModal();
                  } else {
                    toast({
                      title: "Plan Change Requested",
                      description: `Prepared plan change request to remove ${seats.inactiveSeatsCount} unused seat(s). Subject to maker-checker approval policy.`,
                    });
                  }
                }}
                className="w-full rounded bg-accent/20 border border-accent/40 py-1 text-[11px] font-semibold text-accent hover:bg-accent/30 transition-colors"
              >
                Pre-fill Seat Reduction Request
              </button>
            )}
          </div>
        </div>

        {/* Protected Owner Disclaimer Banner */}
        <div className="flex items-center gap-2 rounded border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span className="text-[11px] leading-tight">{seats.disclaimer}</span>
        </div>
      </div>

      {/* 3. Actionable Recommendations Card */}
      {recs.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-accent/15 text-accent border border-accent/30">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-text">
                Contextual AI Recommendations for AM
              </span>
            </div>
            <span className="text-[11px] text-text-muted">
              Source: ai_recommendation · Creates assigned task
            </span>
          </div>

          <div className="space-y-2.5">
            {recs.map((r) => (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded border border-border bg-surface-2 p-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text">{r.title}</span>
                    <span className="rounded bg-accent/15 px-1.5 py-0.2 text-[9px] font-mono text-accent uppercase font-bold">
                      {r.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {r.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={creatingTaskId === r.id}
                    onClick={() => handleCreateTask(r)}
                    className="inline-flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent/90 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{creatingTaskId === r.id ? "Creating..." : "Create Task"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDismissingId(r.id)}
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text hover:bg-surface transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Not Useful</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dismissal Reason Dialog */}
      {dismissingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-4 space-y-3 shadow-xl">
            <h4 className="text-xs font-bold text-text uppercase">
              Dismiss Recommendation
            </h4>
            <p className="text-[11px] text-text-muted">
              Why is this recommendation not helpful? Your feedback improves AM intelligence accuracy.
            </p>
            <input
              type="text"
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="e.g. Client already scheduled direct call..."
              className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDismissingId(null)}
                className="rounded border border-border px-3 py-1 text-xs text-text-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDismiss(dismissingId)}
                className="rounded bg-danger px-3 py-1 text-xs font-semibold text-white hover:bg-danger/90"
              >
                Confirm Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
