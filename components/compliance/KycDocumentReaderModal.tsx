"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  ShieldCheck,
  Check,
  ExternalLink,
  Info,
  RotateCw,
  Loader2,
} from "lucide-react";
import { readKycDocumentAction, submitKycReviewWithAIAction } from "@/app/actions/ai-kyc";
import { AIOutputContainer } from "@/components/ui/AIOutputContainer";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";
import { ValidatedKycExtractionResult, FieldComparisonResult } from "@/lib/services/kyc-reader";

export interface KycDocumentReaderModalProps {
  kycCaseId: string;
  workspaceName: string;
  declaredData: {
    legalName: string;
    gstin: string;
    pan: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function KycDocumentReaderModal({
  kycCaseId,
  workspaceName,
  declaredData,
  onClose,
  onSuccess,
}: KycDocumentReaderModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any | null>(null);
  const [verifiedFields, setVerifiedFields] = useState<Record<string, boolean>>({});
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [reviewNote, setReviewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulateMismatch, setSimulateMismatch] = useState(false);

  const handleReadDocument = async (withMismatch = simulateMismatch) => {
    setIsLoading(true);
    try {
      const res = await readKycDocumentAction({
        kycCaseId,
        simulateMismatch: withMismatch,
      });

      if (!res.success || !res.result) {
        throw new Error(res.error || "Failed to process document with AI.");
      }

      setExtractionResult(res.result);
      // Reset checkboxes
      setVerifiedFields({});
      setEditedFields({});
    } catch (err: any) {
      toast({
        title: "Document Reading Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFieldVerification = (key: string) => {
    setVerifiedFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allRequiredVerified =
    extractionResult &&
    ["legal_name", "gstin", "pan"].every((k) => verifiedFields[k] === true);

  const handleSubmitDecision = async (decision: "approve" | "reject") => {
    if (decision === "approve" && !allRequiredVerified) {
      toast({
        title: "Verification Required",
        description: "You must check 'I've verified' for all critical fields before approving.",
        variant: "destructive",
      });
      return;
    }

    if (decision === "reject" && reviewNote.trim().length < 5) {
      toast({
        title: "Rejection Reason Required",
        description: "Please specify why this KYC submission is being rejected.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const overriddenKeys = Object.keys(editedFields);
      const res = await submitKycReviewWithAIAction({
        kycCaseId,
        decision,
        notes: reviewNote.trim() || `Approved after AI verification of registration certificate.`,
        verifiedFields: Object.keys(verifiedFields).filter((k) => verifiedFields[k]),
        overriddenFields: overriddenKeys,
        aiAssisted: true,
      });

      if (res.success) {
        toast({
          title: decision === "approve" ? "KYC Approved" : "KYC Rejected",
          description: `Maker-checker decision logged to immutable audit log with ai_assisted: true.`,
        });
        onSuccess();
        onClose();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBadge = (field: FieldComparisonResult) => {
    if (field.status === "match") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success border border-success/30 font-mono">
          <CheckCircle2 className="h-3 w-3" />
          MATCH
        </span>
      );
    }
    if (field.status === "minor_mismatch") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning border border-warning/30 font-mono">
          <AlertTriangle className="h-3 w-3" />
          MINOR MISMATCH
        </span>
      );
    }
    if (field.status === "major_mismatch") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-danger/15 px-2 py-0.5 text-[10px] font-bold text-danger border border-danger/30 font-mono">
          <XCircle className="h-3 w-3" />
          MAJOR MISMATCH
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-[10px] font-mono text-text-muted">
        LOW CONFIDENCE
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-surface p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-accent/15 text-accent border border-accent/30">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-text">
                Multimodal KYC Document Review (MCA &amp; GSTN Verification)
              </h3>
              <p className="text-xs text-text-muted">
                Workspace: <strong className="text-text">{workspaceName}</strong> ({kycCaseId})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text text-sm p-1"
          >
            ✕
          </button>
        </div>

        {/* Initial Trigger / Document Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-accent" />
            <div>
              <div className="text-xs font-semibold text-text">
                Certificate of Incorporation &amp; GST Registration REG-06
              </div>
              <div className="text-[11px] text-text-muted">
                Official PDF/Image scan uploaded by applicant
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer pr-2">
              <input
                type="checkbox"
                checked={simulateMismatch}
                onChange={(e) => {
                  setSimulateMismatch(e.target.checked);
                  handleReadDocument(e.target.checked);
                }}
                className="rounded border-border text-accent"
              />
              <span className="text-[11px]">Test Sample Mismatched Doc</span>
            </label>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleReadDocument(simulateMismatch)}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Reading document...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Read documents with AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Extraction Results */}
        {extractionResult && (
          <AIOutputContainer
            featureTitle="Multimodal KYC Field Extraction"
            runId={extractionResult.runId}
            isFallback={extractionResult.isFallback}
            fallbackReason={extractionResult.fallbackReason}
            asOf={extractionResult.asOf}
            confidence={extractionResult.data.overallStatus === "clean_match" ? "high" : "medium"}
            inputsSummary={{
              declaredGstin: declaredData.gstin,
              declaredLegalName: declaredData.legalName,
              embeddedPanVerified: extractionResult.data.embeddedPanMatchesGstin,
              documentType: extractionResult.data.documentType,
            }}
          >
            {/* Status Summary Banner */}
            <div
              className={cn(
                "rounded border p-3 text-xs flex items-center justify-between",
                extractionResult.data.overallStatus === "clean_match"
                  ? "bg-success/10 border-success/30 text-success"
                  : extractionResult.data.overallStatus === "has_minor_mismatch"
                  ? "bg-warning/10 border-warning/30 text-warning"
                  : "bg-danger/10 border-danger/30 text-danger"
              )}
            >
              <div className="flex items-center gap-2">
                {extractionResult.data.overallStatus === "clean_match" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <div>
                  <span className="font-bold uppercase tracking-wider">
                    {extractionResult.data.overallStatus.replace(/_/g, " ")}:
                  </span>
                  <span className="ml-1 opacity-90">
                    {extractionResult.data.overallStatus === "clean_match"
                      ? "All extracted regulatory identifiers align with declared enterprise records."
                      : extractionResult.data.overallStatus === "has_minor_mismatch"
                      ? "Minor suffix variance detected between certificate and declared legal entity."
                      : "Major substantive mismatch detected between uploaded document and declared entity!"}
                  </span>
                </div>
              </div>

              <span className="font-mono text-[10px] uppercase font-bold shrink-0">
                Type: {extractionResult.data.documentType}
              </span>
            </div>

            {/* Field Comparison Table */}
            <div className="overflow-hidden rounded border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="py-2.5 px-3">Field</th>
                    <th className="py-2.5 px-3">Declared Value</th>
                    <th className="py-2.5 px-3">Extracted by AI</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">I&apos;ve Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-[11px]">
                  {Object.entries(extractionResult.data.fields).map(([key, f]: [string, any]) => {
                    const isChecked = Boolean(verifiedFields[key]);
                    return (
                      <tr
                        key={key}
                        className={cn(
                          "transition-colors",
                          f.status === "major_mismatch"
                            ? "bg-danger/5"
                            : f.status === "minor_mismatch"
                            ? "bg-warning/5"
                            : "hover:bg-surface-2/40"
                        )}
                      >
                        <td className="py-2.5 px-3 font-sans font-medium text-text">
                          {f.fieldName}
                        </td>

                        <td className="py-2.5 px-3 text-text-muted">{f.declaredValue}</td>

                        <td className="py-2.5 px-3 font-semibold text-text">
                          {f.extractedValue || <span className="text-text-muted">Not Found</span>}
                          <span className="block text-[10px] font-sans text-text-muted font-normal">
                            {f.statusMessage}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">{renderStatusBadge(f)}</td>

                        <td className="py-2.5 px-3 text-center">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleFieldVerification(key)}
                              className="rounded border-border text-accent focus:ring-0"
                            />
                            <span className="text-[10px] font-sans text-text-muted font-medium">
                              Verify
                            </span>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Review Note & Final Decision Buttons */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text">
                  Compliance Officer Review Justification (Mandatory for audit trail)
                </label>
                <textarea
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Notes on MCA certificate inspection, state code alignment, or reason for rejection..."
                  className="w-full rounded border border-border bg-surface-2 p-2.5 text-xs text-text placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <div className="text-xs text-text-muted">
                  {!allRequiredVerified ? (
                    <span className="text-warning flex items-center gap-1 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Check &quot;I&apos;ve verified&quot; for Legal Name, GSTIN, and PAN to enable Approve.
                    </span>
                  ) : (
                    <span className="text-success flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      All mandatory fields checked by reviewer. Ready for authorization.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSubmitDecision("reject")}
                    className="rounded border border-danger/40 bg-danger/15 px-4 py-2 text-xs font-bold text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
                  >
                    Reject KYC
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting || !allRequiredVerified}
                    onClick={() => handleSubmitDecision("approve")}
                    className="inline-flex items-center gap-1.5 rounded bg-success px-4 py-2 text-xs font-bold text-black hover:bg-success/90 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    <span>Approve KYC (Maker-Checker)</span>
                  </button>
                </div>
              </div>
            </div>
          </AIOutputContainer>
        )}
      </div>
    </div>
  );
}
