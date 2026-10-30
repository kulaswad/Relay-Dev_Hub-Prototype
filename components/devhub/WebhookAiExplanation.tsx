"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Bug,
  AlertTriangle,
  RotateCw,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Terminal,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { CodeBlock } from "@/components/devhub";

interface WebhookAiExplanationProps {
  deliveryId: string;
  initialLanguage?: "node" | "python" | "go" | "php";
  onReplay?: (deliveryId: string) => Promise<void> | void;
  isReplaying?: boolean;
}

export function WebhookAiExplanation({
  deliveryId,
  initialLanguage = "node",
  onReplay,
  isReplaying = false,
}: WebhookAiExplanationProps) {
  const [language, setLanguage] = useState<"node" | "python" | "go" | "php">(initialLanguage);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRawFacts, setShowRawFacts] = useState(true);

  const fetchExplanation = async (lang: "node" | "python" | "go" | "php") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/ai/explain-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId, language: lang }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to analyze webhook delivery");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to analyze failure");
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (newLang: "node" | "python" | "go" | "php") => {
    setLanguage(newLang);
    if (data) {
      fetchExplanation(newLang);
    }
  };

  return (
    <div className="space-y-4">
      {/* Trigger Button if not yet loaded */}
      {!data && !loading && (
        <div className="p-4 rounded-xl border border-accent/30 bg-accent/5 flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-text flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Automated Root Cause Analysis</span>
            </h4>
            <p className="text-[11px] text-text-muted">
              Run deterministic mathematical HMAC verification and AI causal diagnosis.
            </p>
          </div>
          <button
            onClick={() => fetchExplanation(language)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-bold hover:bg-accent/90 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Explain with AI</span>
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="p-5 rounded-xl border border-border bg-surface-2/40 flex items-center justify-center gap-3 text-xs text-text font-mono">
          <RotateCw className="w-4 h-4 animate-spin text-accent" />
          <span>Verifying signature buffer, parsing stack trace & synthesizing fix...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-[#E5534B]/30 bg-[#E5534B]/10 text-xs text-[#E5534B] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loaded Content */}
      {data && (
        <div className="space-y-4">
          {/* STEP 1: DETERMINISTIC FACTS */}
          <div className="p-4 rounded-xl border border-border bg-[#09090B] space-y-3">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowRawFacts(!showRawFacts)}
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-accent" />
                <span className="text-xs font-bold uppercase tracking-wider text-text">
                  Deterministic Diagnostics (Verified Facts)
                </span>
              </div>
              <div className="flex items-center gap-2 text-text-muted">
                <span className="text-[10px] font-mono">
                  {showRawFacts ? "Hide details" : "Show details"}
                </span>
                {showRawFacts ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </div>
            </div>

            {showRawFacts && (
              <div className="space-y-2.5 pt-2 border-t border-border/60 text-xs">
                {/* Seeded Bug 2: Re-serialization */}
                {data.deterministic?.signature?.isReserializationBug && (
                  <div className="p-3 rounded-lg bg-[#E0A93B]/10 border border-[#E0A93B]/40 space-y-2">
                    <div className="flex items-center gap-2 text-[#E0A93B] font-bold">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Re-serialization Bug Detected (100% Match)</span>
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Your server verified HMAC over <code className="text-text font-mono">JSON.stringify(JSON.parse(raw))</code> instead of raw bytes.
                      Key re-ordering and whitespace alterations caused the HMAC mismatch.
                    </p>
                    <div className="p-2 rounded bg-surface border border-border font-mono text-[10px] space-y-1">
                      <div className="text-text-muted">
                        Sent Header v1:{" "}
                        <span className="text-accent">{data.deterministic.signature.headerV1}</span>
                      </div>
                      <div className="text-text-muted">
                        Computed Raw Buffer:{" "}
                        <span className="text-[#3FB68B]">
                          {data.deterministic.signature.rawBodySignature} (Matches!)
                        </span>
                      </div>
                      <div className="text-text-muted">
                        Re-serialized String:{" "}
                        <span className="text-[#E5534B]">
                          {data.deterministic.signature.reserializedBodySignature} (Mismatches!)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seeded Bug 1: Null Field Access */}
                {data.deterministic?.nullFieldCrash?.detected && (
                  <div className="p-3 rounded-lg bg-[#E5534B]/10 border border-[#E5534B]/40 space-y-1.5">
                    <div className="flex items-center gap-2 text-[#E5534B] font-bold">
                      <Bug className="w-4 h-4" />
                      <span>Null Property Access Detected</span>
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      The server threw an unhandled exception when evaluating{" "}
                      <code className="text-text font-mono">{data.deterministic.nullFieldCrash.field || "failure_reason"}</code>.
                      Delivered messages always carry <code className="text-accent font-mono">failure_reason: null</code>.
                    </p>
                  </div>
                )}

                {/* General Signature Valid Indicator */}
                {!data.deterministic?.signature?.isReserializationBug && data.deterministic?.signature?.valid && (
                  <div className="flex items-center gap-2 text-[#3FB68B] text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Relay-Signature mathematically verified against signing secret.</span>
                  </div>
                )}

                {/* Stack Trace preview */}
                {data.deterministic?.stackTrace?.detected && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-text-muted">Detected Stack Trace:</span>
                    <pre className="p-2 rounded bg-surface border border-border text-[11px] font-mono text-text max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {data.deterministic.stackTrace.preview}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: AI INTERPRETATION & ACTIONABLE FIX */}
          <div className="p-4 rounded-xl border border-border bg-surface space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h4 className="text-xs font-bold text-text">Root Cause & Resolution</h4>
              </div>

              <div className="flex items-center gap-2">
                {data.isFallback ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 text-text-muted border border-border">
                    Offline Diagnostic Rules
                  </span>
                ) : (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      data.aiExplanation.confidence === "high"
                        ? "bg-[#3FB68B]/15 text-[#3FB68B] border-[#3FB68B]/30"
                        : data.aiExplanation.confidence === "medium"
                        ? "bg-[#E0A93B]/15 text-[#E0A93B] border-[#E0A93B]/30"
                        : "bg-surface-2 text-text-muted border-border"
                    }`}
                  >
                    Confidence: {data.aiExplanation.confidence}
                  </span>
                )}
              </div>
            </div>

            {/* What Happened */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted font-semibold">What Happened:</span>
              <p className="text-xs text-text leading-relaxed">
                {data.aiExplanation.whatHappened}
              </p>
            </div>

            {/* Most Likely Cause */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted font-semibold">Most Likely Cause:</span>
              <p className="text-xs text-text leading-relaxed">
                {data.aiExplanation.mostLikelyCause}
              </p>
            </div>

            {/* Evidence Lines */}
            {data.aiExplanation.evidence && data.aiExplanation.evidence.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-text-muted font-semibold">Evidence:</span>
                <ul className="space-y-1 text-[11px] text-text-muted list-disc list-inside">
                  {data.aiExplanation.evidence.map((line: string, idx: number) => (
                    <li key={idx} className="font-mono">{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* How to Fix + Code Snippet */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-text-muted font-semibold">How to Fix:</span>
                <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded-lg border border-border">
                  {(["node", "python", "go", "php"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => handleLanguageChange(l)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-colors ${
                        language === l
                          ? "bg-surface text-accent font-bold shadow-sm"
                          : "text-text-muted hover:text-text"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {data.aiExplanation.howToFix && (
                <ul className="space-y-1 text-xs text-text list-disc list-inside">
                  {data.aiExplanation.howToFix.map((step: string, idx: number) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              )}

              {data.aiExplanation.codeSnippet && (
                <div className="relative group mt-2">
                  <pre className="p-3 rounded-xl bg-[#09090B] border border-border font-mono text-xs text-text overflow-x-auto leading-relaxed">
                    {data.aiExplanation.codeSnippet}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(data.aiExplanation.codeSnippet);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-surface border border-border hover:border-text-muted text-[10px] font-mono text-text flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
                  >
                    {copied ? <Check className="w-3 h-3 text-[#3FB68B]" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy Fix"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* How to Verify + Replay Button */}
            <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-text block">Verify Resolution</span>
                <p className="text-[11px] text-text-muted">
                  {data.aiExplanation.howToVerify || "Replay this webhook delivery to confirm your fix works."}
                </p>
              </div>

              {onReplay && (
                <button
                  onClick={() => onReplay(deliveryId)}
                  disabled={isReplaying}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-background text-xs font-bold hover:bg-accent/90 disabled:opacity-50 transition-all shrink-0 shadow-sm"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isReplaying ? "animate-spin" : ""}`} />
                  <span>{isReplaying ? "Replaying..." : "Replay Now"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}