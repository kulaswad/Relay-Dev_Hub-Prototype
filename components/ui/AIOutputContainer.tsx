"use client";

import React, { useState } from "react";
import { Sparkles, HelpCircle, Check, X, Edit3, AlertCircle, Info } from "lucide-react";
import { recordAIFeedbackAction } from "@/app/actions/ai-feedback";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

export interface AIOutputContainerProps {
  featureTitle: string;
  runId: string;
  isFallback: boolean;
  fallbackReason?: string;
  asOf: string | Date;
  confidence?: "high" | "medium" | "low" | number;
  inputsSummary?: Record<string, any>;
  onAccept?: () => void;
  onEdit?: () => void;
  onDismiss?: () => void;
  actionSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AIOutputContainer({
  featureTitle,
  runId,
  isFallback,
  fallbackReason,
  asOf,
  confidence,
  inputsSummary,
  onAccept,
  onEdit,
  onDismiss,
  actionSlot,
  children,
  className,
}: AIOutputContainerProps) {
  const [showWhyPopover, setShowWhyPopover] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<"accepted" | "rejected" | "dismissed" | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const formattedTime = new Date(asOf).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const handleFeedback = async (feedback: "accepted" | "rejected" | "dismissed") => {
    setIsSubmittingFeedback(true);
    try {
      const res = await recordAIFeedbackAction(runId, feedback);
      if (res.success) {
        setFeedbackStatus(feedback);
        toast({
          title: "Feedback Recorded",
          description: `AI response marked as ${feedback}. Logged to audit telemetry.`,
        });
        if (feedback === "accepted" && onAccept) onAccept();
        if (feedback === "rejected" && onEdit) onEdit();
        if (feedback === "dismissed" && onDismiss) onDismiss();
      } else {
        toast({
          title: "Feedback Error",
          description: res.error || "Failed to record feedback.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Feedback Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className={cn("rounded-lg border border-border bg-surface p-4 space-y-3 relative", className)}>
      {/* 1. Amber Degradation Banner if fallback */}
      {isFallback && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">AI unavailable, showing rule-based result.</span>
            {fallbackReason && <span className="opacity-80 ml-1">({fallbackReason})</span>}
          </div>
        </div>
      )}

      {/* 2. AI Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          {/* AI Chip */}
          <span className="inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent border border-accent/30 font-mono uppercase tracking-wider">
            <Sparkles className="h-3 w-3" />
            AI
          </span>

          <span className="text-xs font-semibold text-text">{featureTitle}</span>

          {/* Confidence Badge */}
          {confidence !== undefined && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider",
                confidence === "high" || (typeof confidence === "number" && confidence >= 0.8)
                  ? "bg-success/15 text-success border border-success/30"
                  : confidence === "medium" || (typeof confidence === "number" && confidence >= 0.5)
                  ? "bg-warning/15 text-warning border border-warning/30"
                  : "bg-danger/15 text-danger border border-danger/30"
              )}
            >
              {typeof confidence === "number" ? `${Math.round(confidence * 100)}% Conf.` : `${confidence} Conf.`}
            </span>
          )}

          {/* Time indicator */}
          <span className="text-[11px] text-text-muted">
            generated from data as of {formattedTime}
          </span>
        </div>

        {/* Right side: Why Popover + Accept / Edit / Dismiss buttons */}
        <div className="flex items-center gap-1.5">
          {/* Why am I seeing this? */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowWhyPopover(!showWhyPopover)}
              className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-accent transition-colors px-1.5 py-0.5 rounded hover:bg-surface-2"
              title="Inspect facts used to generate this recommendation"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Why am I seeing this?</span>
            </button>

            {showWhyPopover && (
              <div className="absolute right-0 top-full mt-1.5 z-40 w-80 rounded-lg border border-border bg-surface-2 p-3 text-xs shadow-xl space-y-2">
                <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                  <span className="font-semibold text-text flex items-center gap-1">
                    <Info className="h-3.5 w-3.5 text-accent" />
                    Source Facts &amp; Inputs
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowWhyPopover(false)}
                    className="text-text-muted hover:text-text"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  The following sanitized operational facts from the database were used. No PII, customer credentials, or raw user phone numbers are ever shared.
                </p>
                <div className="max-h-48 overflow-y-auto rounded border border-border bg-background p-2 font-mono text-[10px] text-text-muted space-y-1">
                  {inputsSummary ? (
                    Object.entries(inputsSummary).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-text font-medium">{k}:</span>
                        <span className="text-right truncate max-w-[140px]">
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span>Internal database records</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Feedback buttons */}
          <div className="flex items-center gap-1 border-l border-border/60 pl-2">
            <button
              type="button"
              disabled={isSubmittingFeedback || feedbackStatus !== null}
              onClick={() => handleFeedback("accepted")}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors border",
                feedbackStatus === "accepted"
                  ? "bg-success/20 border-success text-success font-semibold"
                  : "border-border bg-surface-2 text-text-muted hover:text-success hover:border-success/40"
              )}
              title="Accept recommendation"
            >
              <Check className="h-3 w-3" />
              <span>Accept</span>
            </button>

            <button
              type="button"
              disabled={isSubmittingFeedback || feedbackStatus !== null}
              onClick={() => handleFeedback("rejected")}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors border",
                feedbackStatus === "rejected"
                  ? "bg-warning/20 border-warning text-warning font-semibold"
                  : "border-border bg-surface-2 text-text-muted hover:text-warning hover:border-warning/40"
              )}
              title="Edit or revise recommendation"
            >
              <Edit3 className="h-3 w-3" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              disabled={isSubmittingFeedback || feedbackStatus !== null}
              onClick={() => handleFeedback("dismissed")}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors border",
                feedbackStatus === "dismissed"
                  ? "bg-danger/20 border-danger text-danger font-semibold"
                  : "border-border bg-surface-2 text-text-muted hover:text-danger hover:border-danger/40"
              )}
              title="Dismiss recommendation"
            >
              <X className="h-3 w-3" />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Content */}
      <div className="space-y-3">{children}</div>

      {/* 4. Action Slot (AI never applies changes directly - human triggers maker-checker action) */}
      {actionSlot && (
        <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-text-muted italic">
            AI recommendations require human approval before mutating database state.
          </span>
          <div>{actionSlot}</div>
        </div>
      )}
    </div>
  );
}
