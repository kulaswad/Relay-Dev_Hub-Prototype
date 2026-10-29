"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Copy,
  Download,
  FileText,
  RotateCw,
  Check,
  AlertTriangle,
  Info,
  Sliders,
  CheckCircle2,
  BookmarkPlus,
  Loader2,
} from "lucide-react";
import { generateQBRAction, saveQBRNoteAction } from "@/app/actions/ai-qbr";
import { AIOutputContainer } from "@/components/ui/AIOutputContainer";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";
import { VerifiedQBRResult } from "@/lib/services/qbr-summary";

export interface QBRGeneratorViewProps {
  orgId: string;
  orgName: string;
  initialData?: any;
}

export function QBRGeneratorView({ orgId, orgName }: QBRGeneratorViewProps) {
  const [tone, setTone] = useState<"concise" | "detailed">("concise");
  const [isLoading, setIsLoading] = useState(false);
  const [qbrResult, setQbrResult] = useState<any | null>(null);
  const [editableMarkdown, setEditableMarkdown] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const fetchQBR = async (targetTone = tone) => {
    setIsLoading(true);
    try {
      const res = await generateQBRAction(orgId, targetTone);
      if (!res.success || !res.result) {
        throw new Error(res.error || "Failed to generate QBR brief.");
      }
      setQbrResult(res.result);
      setEditableMarkdown(res.result.data.markdownFull);
    } catch (err: any) {
      toast({
        title: "Generation Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQBR(tone);
  }, [orgId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(editableMarkdown);
    setIsCopied(true);
    toast({ title: "Copied to Clipboard", description: "QBR Markdown copied." });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([editableMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `QBR_${orgName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Downloaded QBR brief as Markdown file." });
  };

  const handleSaveAsNote = async () => {
    setIsSavingNote(true);
    try {
      const res = await saveQBRNoteAction(orgId, editableMarkdown);
      if (res.success) {
        toast({
          title: "Saved to Account Notes",
          description: "QBR brief saved to organization notes with AI-assisted audit log entry.",
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingNote(false);
    }
  };

  /**
   * Inline text renderer that highlights unverified figures with yellow underline and tooltip
   */
  const renderVerifiedText = (text: string, unverifiedList: string[]) => {
    if (!unverifiedList || unverifiedList.length === 0) {
      return text;
    }

    // Escape regex characters
    const pattern = new RegExp(
      `(${unverifiedList.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "g"
    );

    const parts = text.split(pattern);
    return parts.map((part, i) => {
      if (unverifiedList.includes(part)) {
        return (
          <span
            key={i}
            className="underline decoration-warning decoration-wavy underline-offset-4 text-warning font-semibold cursor-help relative group"
            title="Couldn't verify against account data"
          >
            {part}
            <span className="invisible group-hover:visible absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/90 text-warning text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50 border border-warning/40">
              Couldn&apos;t verify against account data
            </span>
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-xs font-bold uppercase tracking-wider text-text">
            Customer Health QBR Brief (Executive Synthesizer)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Tone Selector */}
          <div className="flex items-center rounded border border-border bg-surface-2 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setTone("concise");
                fetchQBR("concise");
              }}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                tone === "concise"
                  ? "bg-accent/20 text-accent font-semibold"
                  : "text-text-muted hover:text-text"
              )}
            >
              Concise
            </button>
            <button
              type="button"
              onClick={() => {
                setTone("detailed");
                fetchQBR("detailed");
              }}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                tone === "detailed"
                  ? "bg-accent/20 text-accent font-semibold"
                  : "text-text-muted hover:text-text"
              )}
            >
              Detailed
            </button>
          </div>

          {/* Regenerate Button */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => fetchQBR(tone)}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
          >
            <RotateCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            <span>Regenerate</span>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-border bg-surface p-12 text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-accent mx-auto" />
          <p className="text-xs text-text-muted font-medium">
            Synthesizing 30-day traffic records, invoice histories, and ticket logs for {orgName}...
          </p>
        </div>
      )}

      {!isLoading && qbrResult && (
        <AIOutputContainer
          featureTitle="Customer Health QBR Brief (Quarterly Account Synthesis)"
          runId={qbrResult.runId}
          isFallback={qbrResult.isFallback}
          fallbackReason={qbrResult.fallbackReason}
          asOf={qbrResult.asOf}
          confidence={qbrResult.data.verificationRatio >= 90 ? "high" : "medium"}
          inputsSummary={{
            ...qbrResult.inputsSummary,
            factsEvaluated: Object.keys(qbrResult.data.facts).length,
            industry: qbrResult.data.facts.industry,
          }}
          actionSlot={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-text hover:text-accent transition-colors"
              >
                {isCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{isCopied ? "Copied" : "Copy"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportMarkdown}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-text hover:text-accent transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Markdown</span>
              </button>

              <button
                type="button"
                disabled={isSavingNote}
                onClick={handleSaveAsNote}
                className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent/90 transition-colors shadow-sm disabled:opacity-50"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>{isSavingNote ? "Saving..." : "Save as Account Note"}</span>
              </button>
            </div>
          }
        >
          {/* Verification Ratio Indicator */}
          <div className="flex items-center justify-between rounded border border-border bg-surface-2/60 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={cn(
                  "h-4 w-4",
                  qbrResult.data.unverifiedFigures.length === 0 ? "text-success" : "text-warning"
                )}
              />
              <span className="font-semibold text-text">
                Verified {qbrResult.data.verifiedCount} of {qbrResult.data.totalFiguresCount} figures
              </span>
              <span className="text-[11px] text-text-muted">
                ({qbrResult.data.verificationRatio}% grounded in real ledger facts)
              </span>
            </div>

            {qbrResult.data.unverifiedFigures.length > 0 && (
              <span className="text-[11px] text-warning flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {qbrResult.data.unverifiedFigures.length} unverified claim(s) underlined in yellow
              </span>
            )}
          </div>

          {/* Structured Visual Cards */}
          <div className="space-y-4">
            {/* Snapshot */}
            <div className="rounded border border-border bg-surface-2 p-3.5 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Executive Snapshot
              </span>
              <p className="text-xs text-text leading-relaxed">
                {renderVerifiedText(qbrResult.data.brief.snapshot, qbrResult.data.unverifiedFigures)}
              </p>
            </div>

            {/* Two-column layout: What's Going Well vs Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* What's going well */}
              <div className="rounded border border-border bg-surface-2 p-3.5 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  What&apos;s Going Well
                </span>
                <ul className="space-y-1.5 text-xs text-text">
                  {qbrResult.data.brief.whats_going_well.map((point: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                      <span className="text-success mt-0.5">•</span>
                      <span>{renderVerifiedText(point, qbrResult.data.unverifiedFigures)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risks */}
              <div className="rounded border border-border bg-surface-2 p-3.5 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-warning flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Identified Risks &amp; Friction
                </span>
                <ul className="space-y-1.5 text-xs text-text">
                  {qbrResult.data.brief.risks.map((point: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                      <span className="text-warning mt-0.5">•</span>
                      <span>{renderVerifiedText(point, qbrResult.data.unverifiedFigures)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Talking Points & Next Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded border border-border bg-surface-2 p-3.5 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Suggested QBR Talking Points
                </span>
                <ol className="space-y-1.5 text-xs text-text list-decimal list-inside leading-relaxed">
                  {qbrResult.data.brief.talking_points.map((tp: string, idx: number) => (
                    <li key={idx}>
                      <span>{renderVerifiedText(tp, qbrResult.data.unverifiedFigures)}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded border border-border bg-surface-2 p-3.5 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-accent" />
                  Suggested Next Actions
                </span>
                <ul className="space-y-1.5 text-xs text-text">
                  {qbrResult.data.brief.suggested_actions.map((act: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                      <input type="checkbox" readOnly className="mt-1 rounded border-border" />
                      <span>{renderVerifiedText(act, qbrResult.data.unverifiedFigures)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Editable Markdown Source Area */}
            <div className="rounded border border-border bg-surface-2 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Editable Brief Markdown (Audit &amp; Note Payload)
                </span>
                <span className="text-[10px] text-text-muted">
                  Edits preserve fact verification indicators
                </span>
              </div>
              <textarea
                rows={6}
                value={editableMarkdown}
                onChange={(e) => setEditableMarkdown(e.target.value)}
                className="w-full rounded border border-border bg-background p-2.5 font-mono text-xs text-text leading-relaxed focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </AIOutputContainer>
      )}
    </div>
  );
}
