"use client";

import React, { useState, useEffect } from "react";
import {
  StatusPill,
  DiffBadge,
  Callout,
} from "@/components/devhub";
import { useDevHub } from "@/components/providers/DevHubContext";
import {
  Building2,
  ShieldCheck,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export default function SettingsConsolePage() {
  const { workspace, setWorkspace } = useDevHub();
  const [kycStatus, setKycStatus] = useState<"not_started" | "in_review" | "approved">(
    workspace.kycStatus === "active" ? "approved" : (workspace.kycStatus as any) || "in_review"
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Reset Demo State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      const res = await fetch("/api/internal/reset-demo", { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      window.location.reload();
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
      setIsResetting(false);
      setIsResetModalOpen(false);
    }
  };

  // Fetch active workspace details on mount
  useEffect(() => {
    async function loadWorkspace() {
      try {
        const res = await fetch("/api/internal/session");
        const data = await res.json();
        if (data.workspace) {
          const status = data.workspace.kycStatus || "in_review";
          setKycStatus(status);
          setWorkspace({
            ...workspace,
            name: data.workspace.name,
            kycStatus: status === "approved" ? "active" : "kyc_pending",
            isLiveApproved: status === "approved",
          });
        }
      } catch {}
    }
    loadWorkspace();
  }, []);

  const handleToggleKyc = async (newStatus: "not_started" | "in_review" | "approved") => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/internal/simulate-kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kycStatus: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setKycStatus(newStatus);
      setWorkspace({
        ...workspace,
        kycStatus: newStatus === "approved" ? "active" : "kyc_pending",
        isLiveApproved: newStatus === "approved",
      });
      setMessage(
        newStatus === "approved"
          ? "✅ Workspace KYC simulated as APPROVED. Live keys and live message sending unlocked!"
          : "⚠️ Workspace KYC simulated as PENDING. Live keys are now locked."
      );
    } catch (err: any) {
      setMessage(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1 border-b border-border pb-6">
        <h1 className="text-2xl font-bold text-text">Workspace Settings & Compliance</h1>
        <p className="text-xs text-text-muted">
          Manage workspace metadata, Indian GST registrations, MCA KYC verification, and TRAI DLT headers.
        </p>
      </div>

      {/* Evaluator KYC Simulation Box */}
      <div className="p-6 rounded-xl border border-accent/40 bg-accent/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-text">
                Evaluator Tool: Simulate Indian KYC States
              </h2>
            </div>
            <p className="text-xs text-text-muted max-w-xl">
              Toggle between states to test both the friction-free Sandbox experience and the unlocked Live Production state with approved DLT headers.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleToggleKyc("approved")}
              disabled={loading || kycStatus === "approved"}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                kycStatus === "approved"
                  ? "bg-[#3FB68B] text-black cursor-default font-bold"
                  : "bg-surface border border-border hover:border-[#3FB68B] text-text"
              }`}
            >
              Simulate KYC Approved
            </button>
            <button
              onClick={() => handleToggleKyc("in_review")}
              disabled={loading || kycStatus === "in_review"}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                kycStatus === "in_review"
                  ? "bg-[#E0A93B] text-black cursor-default font-bold"
                  : "bg-surface border border-border hover:border-[#E0A93B] text-text"
              }`}
            >
              Simulate KYC In Review
            </button>
          </div>
        </div>

        {message && (
          <div className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text">
            {message}
          </div>
        )}
      </div>

      {/* Organization & Workspace info */}
      <div className="p-6 rounded-xl border border-border bg-surface space-y-4">
        <h2 className="text-sm font-bold text-text flex items-center gap-2">
          <Building2 className="w-4 h-4 text-accent" />
          <span>Entity Information</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <span className="text-text-muted block text-[11px]">Workspace Name:</span>
            <span className="text-text font-bold">{workspace.name}</span>
          </div>
          <div>
            <span className="text-text-muted block text-[11px]">Parent Organization:</span>
            <span className="text-text font-bold">{workspace.orgName}</span>
          </div>
          <div>
            <span className="text-text-muted block text-[11px]">Indian GSTIN:</span>
            <span className="text-text font-bold">29AABCA1234F1Z5 (Karnataka)</span>
          </div>
          <div>
            <span className="text-text-muted block text-[11px]">Compliance Status:</span>
            <StatusPill
              variant={kycStatus === "approved" ? "success" : "warning"}
              label={
                kycStatus === "approved"
                  ? "KYC Approved & Active"
                  : kycStatus === "in_review"
                  ? "KYC In Review"
                  : "KYC Not Started"
              }
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* TRAI DLT Headers */}
      <div className="p-6 rounded-xl border border-border bg-surface space-y-4">
        <h2 className="text-sm font-bold text-text flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#3FB68B]" />
          <span>Approved DLT Sender IDs (Headers)</span>
        </h2>

        <div className="divide-y divide-border border border-border rounded-lg overflow-hidden text-xs">
          <div className="p-3 flex items-center justify-between bg-surface-2/40">
            <div>
              <span className="font-mono font-bold text-text">ACMEPY</span>
              <span className="text-text-muted ml-3">Service / Transactional (AcmePay)</span>
            </div>
            <StatusPill variant="success" label="Approved by Jio, Airtel, Vi" size="sm" />
          </div>
          <div className="p-3 flex items-center justify-between bg-surface-2/40">
            <div>
              <span className="font-mono font-bold text-text">RELAYI</span>
              <span className="text-text-muted ml-3">Pre-registered Sandbox Default</span>
            </div>
            <StatusPill variant="success" label="Universal Default" size="sm" />
          </div>
        </div>
      </div>

      {/* Danger Zone: Reset Demo */}
      <div className="p-6 rounded-xl border border-[#E5534B]/30 bg-[#E5534B]/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[#E5534B] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Reset Demo State</span>
            </h2>
            <p className="text-xs text-text-muted max-w-xl leading-relaxed">
              Restore the entire developer hub database back to pristine initial seed fixtures.
              Resets all simulated messages, rate limiter sliding-window buckets, webhook deliveries, and API keys.
            </p>
          </div>

          <button
            onClick={() => setIsResetModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-[#E5534B] hover:bg-[#E5534B]/90 text-white text-xs font-bold transition-all shrink-0 shadow-sm"
          >
            Reset Demo Data
          </button>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-[#0C0C0F] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E5534B]/15 border border-[#E5534B]/30 flex items-center justify-center text-[#E5534B]">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">Confirm Demo Reset</h3>
                <p className="text-xs text-text-muted">This action will re-seed the SQLite database.</p>
              </div>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to reset? This will revert all workspaces, API keys, webhook test endpoints, and usage meters to their initial benchmark state.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="px-4 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDemo}
                disabled={isResetting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5534B] text-white text-xs font-bold hover:bg-[#E5534B]/90 disabled:opacity-50 transition-all"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
                <span>{isResetting ? "Re-seeding database..." : "Yes, Reset Demo"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
