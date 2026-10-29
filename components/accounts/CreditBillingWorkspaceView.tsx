"use client";

import React, { useState, useEffect } from "react";
import { formatINR } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";
import { toast } from "@/components/ui/Toaster";
import {
  WorkspaceCreditBillingData,
  calculateGSTBreakup,
} from "@/lib/services/finance";
import {
  getWorkspaceCreditBillingAction,
  changeCreditLimitAction,
  recordTopupAction,
  recordManualAdjustmentAction,
  issueDraftInvoiceAction,
  markInvoicePaidAction,
  flagInvoiceDisputedAction,
  logFollowUpActionServer,
} from "@/app/actions/finance";
import { WorkspaceCreditForecastWidget } from "./WorkspaceCreditForecastWidget";
import {
  CreditCard,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Clock,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Printer,
  Shield,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  X,
  FileCheck,
  Send,
  Sliders,
  DollarSign,
} from "lucide-react";

interface CreditBillingWorkspaceViewProps {
  orgId: string;
  workspaces: Array<{
    id: string;
    name: string;
    billingModel: string;
    billingState?: string;
  }>;
  defaultWorkspaceId?: string;
}

export function CreditBillingWorkspaceView({
  orgId,
  workspaces,
  defaultWorkspaceId,
}: CreditBillingWorkspaceViewProps) {
  const { currentRole } = useRole();
  const [selectedWsId, setSelectedWsId] = useState<string>(
    defaultWorkspaceId || workspaces[0]?.id || ""
  );

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WorkspaceCreditBillingData | null>(null);

  // Dialog States
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [newLimitInput, setNewLimitInput] = useState<string>("");
  const [limitReason, setLimitReason] = useState("");
  const [limitNote, setLimitNote] = useState("");
  const [isSubmittingLimit, setIsSubmittingLimit] = useState(false);

  // Topup Modal
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState<string>("");
  const [topupRef, setTopupRef] = useState<string>("");
  const [topupMode, setTopupMode] = useState<"NEFT" | "RTGS" | "IMPS" | "Net Banking" | "UPI">("NEFT");
  const [isSubmittingTopup, setIsSubmittingTopup] = useState(false);

  // Adjustment Modal
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjType, setAdjType] = useState<"credit" | "debit">("credit");
  const [adjReasonCode, setAdjReasonCode] = useState<"goodwill_credit" | "billing_error" | "refund" | "chargeback">("goodwill_credit");
  const [adjAmount, setAdjAmount] = useState<string>("");
  const [adjReason, setAdjReason] = useState("");
  const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);

  // Invoice Payment Modal
  const [payingInvoice, setPayingInvoice] = useState<any | null>(null);
  const [payRef, setPayRef] = useState("");
  const [payMode, setPayMode] = useState("NEFT");
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Invoice Dispute Modal
  const [disputingInvoiceId, setDisputingInvoiceId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  // Printable Invoice Modal
  const [inspectingInvoice, setInspectingInvoice] = useState<any | null>(null);

  // Follow-up modal
  const [followUpInvoiceId, setFollowUpInvoiceId] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState("");
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

  const canManageMoney =
    currentRole === "finance" || currentRole === "finance_head" || currentRole === "admin";

  const fetchDetails = async (wsId: string) => {
    setLoading(true);
    try {
      const res = await getWorkspaceCreditBillingAction(wsId);
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWsId) {
      fetchDetails(selectedWsId);
    }
  }, [selectedWsId]);

  // Handle Change Limit
  const handleChangeLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = Number(newLimitInput);
    if (isNaN(limitNum) || limitNum <= 0) {
      toast({ title: "Invalid Limit", description: "Please enter a positive credit limit in INR.", variant: "destructive" });
      return;
    }
    if (limitReason.trim().length < 10) {
      toast({ title: "Justification Required", description: "Audit reason must be at least 10 characters.", variant: "destructive" });
      return;
    }

    setIsSubmittingLimit(true);
    try {
      const res = await changeCreditLimitAction({
        workspaceId: selectedWsId,
        newCreditLimit: limitNum,
        reason: limitReason.trim(),
        note: limitNote.trim() || undefined,
      });

      if (!res.success) throw new Error(res.error);

      if (res.data?.status === "pending") {
        toast({
          title: "Approval Request Submitted",
          description: `Change Request #${res.data.changeRequestId} routed for Finance Head authorization.`,
        });
      } else {
        toast({
          title: "Credit Limit Updated",
          description: `Credit limit updated to ₹${limitNum.toLocaleString("en-IN")}.`,
        });
      }

      setShowLimitModal(false);
      setNewLimitInput("");
      setLimitReason("");
      setLimitNote("");
      fetchDetails(selectedWsId);
    } catch (err: any) {
      toast({ title: "Operation Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingLimit(false);
    }
  };

  // Handle Top-up
  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(topupAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Invalid Amount", description: "Top-up amount must be a positive number.", variant: "destructive" });
      return;
    }
    if (!topupRef || topupRef.trim().length < 6) {
      toast({ title: "UTR Required", description: "Valid bank reference or UTR (min 6 chars) is mandatory.", variant: "destructive" });
      return;
    }

    setIsSubmittingTopup(true);
    try {
      const res = await recordTopupAction({
        workspaceId: selectedWsId,
        amount: amountNum,
        paymentReference: topupRef.trim(),
        paymentMode: topupMode,
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Top-up Processed",
        description: `Wallet credited by ₹${amountNum.toLocaleString("en-IN")}. Tx: ${res.data?.transactionId}`,
      });

      setShowTopupModal(false);
      setTopupAmount("");
      setTopupRef("");
      fetchDetails(selectedWsId);
    } catch (err: any) {
      toast({ title: "Top-up Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingTopup(false);
    }
  };

  // Handle Adjustment
  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(adjAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Invalid Amount", description: "Adjustment amount must be positive.", variant: "destructive" });
      return;
    }
    if (adjReason.trim().length < 10) {
      toast({ title: "Justification Required", description: "Audit reason must be at least 10 characters.", variant: "destructive" });
      return;
    }

    setIsSubmittingAdj(true);
    try {
      const res = await recordManualAdjustmentAction({
        workspaceId: selectedWsId,
        adjustmentType: adjType,
        reasonCode: adjReasonCode,
        reason: adjReason.trim(),
        amount: amountNum,
      });

      if (!res.success) throw new Error(res.error);

      if (res.data?.status === "pending") {
        toast({
          title: "Adjustment Request Submitted",
          description: `Adjustment over ₹50,000 created as Change Request #${res.data.changeRequestId} for Finance Head approval.`,
        });
      } else {
        toast({
          title: "Adjustment Recorded",
          description: `Successfully applied ${adjType} adjustment of ₹${amountNum.toLocaleString("en-IN")}.`,
        });
      }

      setShowAdjModal(false);
      setAdjAmount("");
      setAdjReason("");
      fetchDetails(selectedWsId);
    } catch (err: any) {
      toast({ title: "Adjustment Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  // Handle Mark Paid
  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    if (payRef.trim().length < 6) {
      toast({ title: "Payment Reference Required", description: "Enter at least 6 characters UTR.", variant: "destructive" });
      return;
    }

    setIsSubmittingPay(true);
    try {
      const res = await markInvoicePaidAction({
        invoiceId: payingInvoice.id,
        paymentReference: payRef.trim(),
        paymentMode: payMode,
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Invoice Settled",
        description: `Invoice #${payingInvoice.id} marked as paid. Credit line updated.`,
      });

      setPayingInvoice(null);
      setPayRef("");
      fetchDetails(selectedWsId);
    } catch (err: any) {
      toast({ title: "Failed to Mark Paid", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Handle Issue Draft
  const handleIssueDraft = async (invId: string) => {
    try {
      const res = await issueDraftInvoiceAction(invId);
      if (!res.success) throw new Error(res.error);
      toast({ title: "Invoice Issued", description: `Invoice #${invId} is now issued with 15-day credit terms.` });
      fetchDetails(selectedWsId);
    } catch (err: any) {
      toast({ title: "Action Failed", description: err.message, variant: "destructive" });
    }
  };

  // Handle Dispute
  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputingInvoiceId) return;
    if (disputeReason.trim().length < 10) {
      toast({ title: "Reason Required", description: "Dispute reason must be at least 10 characters.", variant: "destructive" });
      return;
    }

    setIsSubmittingDispute(true);
    try {
      const res = await flagInvoiceDisputedAction({
        invoiceId: disputingInvoiceId,
        reason: disputeReason.trim(),
      });
      if (!res.success) throw new Error(res.error);

      toast({ title: "Invoice Disputed", description: "Invoice flagged as disputed. Collections follow-up paused." });
      setDisputingInvoiceId(null);
      setDisputeReason("");
      fetchDetails(selectedWsId);
    } catch (err: any) {
      toast({ title: "Failed to Dispute", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  // Handle Follow-up Note
  const handleLogFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpInvoiceId) return;
    if (followUpNote.trim().length < 5) {
      toast({ title: "Note Required", description: "Please enter a follow-up summary.", variant: "destructive" });
      return;
    }

    setIsSubmittingFollowUp(true);
    try {
      const res = await logFollowUpActionServer({
        invoiceId: followUpInvoiceId,
        note: followUpNote.trim(),
      });
      if (!res.success) throw new Error(res.error);

      toast({ title: "Follow-up Logged", description: "Created task assigned to Account Manager." });
      setFollowUpInvoiceId(null);
      setFollowUpNote("");
    } catch (err: any) {
      toast({ title: "Failed to Log Follow-up", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-border bg-surface p-12 text-center text-xs text-text-muted">
        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[#7C7CFF]" />
        Loading financial positions and invoices...
      </div>
    );
  }

  if (!data) return null;

  const isPostpaid = data.billingModel === "postpaid";
  const post = data.postpaidPosition;
  const prep = data.prepaidPosition;

  return (
    <div className="space-y-6">
      {/* Workspace Selector Bar */}
      <div className="rounded-lg border border-border bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-[#7C7CFF]/30 bg-[#7C7CFF]/10 p-2 text-[#7C7CFF]">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              Credit, Ledger &amp; Invoices
            </h3>
            <p className="text-[11px] text-text-muted">
              GSTIN: <span className="font-mono text-text">{data.gstin}</span> • Billing State:{" "}
              <span className="font-semibold text-text">{data.billingState}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-text-muted whitespace-nowrap">Workspace:</label>
          <select
            value={selectedWsId}
            onChange={(e) => setSelectedWsId(e.target.value)}
            className="rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.billingModel})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* OVERDUE INVOICES WARNING CALLOUT (IF ANY) */}
      {data.hasOverdueInvoices && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 flex items-start justify-between gap-3 text-xs text-danger">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-danger" />
            <div>
              <span className="font-bold text-sm">
                Attention: {data.overdueCount} Overdue Invoice(s) Totaling {formatINR(data.overdueTotalINR)}
              </span>
              <p className="text-xs text-danger/90 mt-0.5">
                Statutory payment terms exceeded. Any credit limit increase requires mandatory Finance Head approval.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("invoices-table");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="rounded border border-danger/40 bg-danger/20 px-3 py-1 font-semibold text-xs text-danger hover:bg-danger/30 transition-colors shrink-0"
          >
            Review Invoices
          </button>
        </div>
      )}

      {/* POSITION SUMMARY: POSTPAID VS PREPAID */}
      {isPostpaid && (
        <WorkspaceCreditForecastWidget
          workspaceId={selectedWsId}
          onRequestLimitChange={() => setShowLimitModal(true)}
        />
      )}

      {isPostpaid && post ? (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-text">Postpaid Credit Line</h4>
                <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-mono text-text-muted uppercase">
                  Monthly Invoicing
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Headroom calculated against 14-day EWMA message burn rate.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewLimitInput(String(post.creditLimit));
                  setShowLimitModal(true);
                }}
                disabled={!canManageMoney}
                className="inline-flex items-center gap-1.5 rounded bg-[#7C7CFF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6868F7] transition-colors disabled:opacity-40"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Change Credit Limit</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdjModal(true)}
                disabled={!canManageMoney}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-hover transition-colors disabled:opacity-40"
              >
                <span>Manual Adjustment</span>
              </button>
            </div>
          </div>

          {/* Metric Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <span className="text-[10px] uppercase font-semibold text-text-muted">Credit Limit</span>
              <div className="font-mono text-xl font-bold text-text mt-1">
                {formatINR(post.creditLimit)}
              </div>
            </div>

            <div className="rounded-md border border-border bg-surface-2 p-3">
              <span className="text-[10px] uppercase font-semibold text-text-muted">Utilized Credit</span>
              <div className="font-mono text-xl font-bold text-text mt-1">
                {formatINR(post.creditUsed)}
              </div>
            </div>

            <div className="rounded-md border border-border bg-surface-2 p-3">
              <span className="text-[10px] uppercase font-semibold text-text-muted">Available Headroom</span>
              <div className="font-mono text-xl font-bold text-success mt-1">
                {formatINR(post.availableCredit)}
              </div>
            </div>

            <div className="rounded-md border border-border bg-surface-2 p-3">
              <span className="text-[10px] uppercase font-semibold text-text-muted">14-Day EWMA Burn</span>
              <div className="font-mono text-xl font-bold text-text mt-1">
                {formatINR(post.dailyBurnEWMA)}/day
              </div>
              <span className="text-[10px] text-text-muted block mt-0.5">
                {post.daysRemaining !== null
                  ? `Exhaustion in ~${post.daysRemaining} days`
                  : "Negligible traffic"}
              </span>
            </div>
          </div>

          {/* Utilization Bar with 70%, 80%, 90% Markers */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-text">
                Utilization Position:{" "}
                <span
                  className={
                    post.is90
                      ? "text-danger font-bold"
                      : post.is80
                      ? "text-warning font-bold"
                      : post.is70
                      ? "text-[#7C7CFF] font-semibold"
                      : "text-success font-semibold"
                  }
                >
                  {post.utilizationPct}%
                </span>
              </span>
              <span className="text-[11px] text-text-muted font-mono">
                {formatINR(post.creditUsed)} / {formatINR(post.creditLimit)}
              </span>
            </div>

            {/* Custom Progress Bar with Threshold Notches */}
            <div className="relative h-4 w-full rounded-full bg-surface-2 overflow-hidden border border-border">
              {/* Fill */}
              <div
                className={`h-full transition-all duration-500 ${
                  post.is90
                    ? "bg-danger"
                    : post.is80
                    ? "bg-warning"
                    : post.is70
                    ? "bg-[#7C7CFF]"
                    : "bg-success"
                }`}
                style={{ width: `${Math.min(100, post.utilizationPct)}%` }}
              />

              {/* Threshold Line Markers at 70%, 80%, 90% */}
              <div className="absolute top-0 bottom-0 left-[70%] w-0.5 bg-black/60 z-10" title="70% Warning Marker" />
              <div className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-black/80 z-10" title="80% Caution Marker" />
              <div className="absolute top-0 bottom-0 left-[90%] w-0.5 bg-danger z-10" title="90% Critical Marker" />
            </div>

            {/* Notches labels */}
            <div className="relative text-[9px] font-mono text-text-muted flex justify-between px-1">
              <span>0%</span>
              <span className="absolute left-[70%] -translate-x-1/2">70%</span>
              <span className="absolute left-[80%] -translate-x-1/2 font-semibold text-warning">80%</span>
              <span className="absolute left-[90%] -translate-x-1/2 font-bold text-danger">90%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Credit Change History */}
          <div className="pt-4 border-t border-border/60">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-text mb-3">
              Credit Limit Audit History ({post.history.length})
            </h5>
            {post.history.length === 0 ? (
              <p className="text-xs text-text-muted italic">No credit limit changes recorded.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-surface-2 text-[10px] uppercase text-text-muted">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Old Limit</th>
                      <th className="py-2 px-3">New Limit</th>
                      <th className="py-2 px-3">Change</th>
                      <th className="py-2 px-3">Reason / Details</th>
                      <th className="py-2 px-3">Authorized By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                    {post.history.map((h: any) => {
                      const diff = h.newLimit - h.oldLimit;
                      return (
                        <tr key={h.id} className="hover:bg-surface-2/40">
                          <td className="py-2 px-3 text-text-muted whitespace-nowrap">
                            {new Date(h.createdAt).toLocaleDateString("en-IN")}
                          </td>
                          <td className="py-2 px-3">{formatINR(h.oldLimit)}</td>
                          <td className="py-2 px-3 font-bold text-text">{formatINR(h.newLimit)}</td>
                          <td className={`py-2 px-3 font-semibold ${diff >= 0 ? "text-success" : "text-danger"}`}>
                            {diff >= 0 ? `+${formatINR(diff)}` : formatINR(diff)}
                          </td>
                          <td className="py-2 px-3 font-sans text-text-muted max-w-xs truncate" title={h.reason}>
                            {h.reason}
                          </td>
                          <td className="py-2 px-3 text-text font-sans">{h.approvedBy || h.changedBy}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : prep ? (
        /* PREPAID WALLET POSITION */
        <div className="rounded-lg border border-border bg-surface p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-text">Prepaid Wallet Ledger</h4>
                <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-mono text-text-muted uppercase">
                  Top-up Balance
                </span>
                {prep.isLowBalance && (
                  <span className="rounded bg-warning/20 border border-warning/40 text-warning px-2 py-0.5 text-[10px] font-mono uppercase font-bold">
                    Low Balance (&lt;5 Days Cover)
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Atomic wallet transactions. Deductions happen per dispatched message segment.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTopupModal(true)}
                disabled={!canManageMoney}
                className="inline-flex items-center gap-1.5 rounded bg-[#7C7CFF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6868F7] transition-colors disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Record Top-up</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdjModal(true)}
                disabled={!canManageMoney}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-hover transition-colors disabled:opacity-40"
              >
                <span>Manual Adjustment</span>
              </button>
            </div>
          </div>

          {/* Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <span className="text-[10px] uppercase font-semibold text-text-muted">Wallet Balance</span>
              <div className="font-mono text-2xl font-bold text-text mt-1">
                {formatINR(prep.walletBalance)}
              </div>
            </div>

            <div className="rounded-md border border-border bg-surface-2 p-3">
              <span className="text-[10px] uppercase font-semibold text-text-muted">14-Day Average Burn</span>
              <div className="font-mono text-2xl font-bold text-text mt-1">
                {formatINR(prep.dailyBurnAverage)}/day
              </div>
            </div>

            <div className="rounded-md border border-border bg-surface-2 p-3">
              <span className="text-[10px] uppercase font-semibold text-text-muted">Runway / Days of Cover</span>
              <div
                className={`font-mono text-2xl font-bold mt-1 ${
                  prep.isLowBalance ? "text-warning" : "text-success"
                }`}
              >
                ~{prep.daysOfCover} days
              </div>
              <span className="text-[10px] text-text-muted block mt-0.5">
                {prep.isLowBalance ? "Top-up recommended soon" : "Healthy liquidity runway"}
              </span>
            </div>
          </div>

          {/* Transactions Ledger */}
          <div className="pt-2">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-text mb-3">
              Recent Wallet Transactions ({prep.transactions.length})
            </h5>
            {prep.transactions.length === 0 ? (
              <p className="text-xs text-text-muted italic">No wallet transactions logged.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-surface-2 text-[10px] uppercase text-text-muted">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Balance After</th>
                      <th className="py-2 px-3">UTR / Payment Reference</th>
                      <th className="py-2 px-3">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                    {prep.transactions.map((t: any) => {
                      const isCredit = t.amount >= 0;
                      return (
                        <tr key={t.id} className="hover:bg-surface-2/40">
                          <td className="py-2 px-3 text-text-muted whitespace-nowrap">
                            {new Date(t.createdAt).toLocaleDateString("en-IN")}
                          </td>
                          <td className="py-2 px-3">
                            <span className="rounded bg-surface-2 px-1.5 py-0.5 uppercase text-[9px] text-text font-semibold">
                              {t.type}
                            </span>
                          </td>
                          <td className={`py-2 px-3 font-semibold ${isCredit ? "text-success" : "text-danger"}`}>
                            {isCredit ? `+${formatINR(t.amount)}` : formatINR(t.amount)}
                          </td>
                          <td className="py-2 px-3 font-bold text-text">{formatINR(t.balanceAfter)}</td>
                          <td className="py-2 px-3 text-text font-mono truncate max-w-xs">{t.reference}</td>
                          <td className="py-2 px-3 text-text-muted font-sans">{t.createdBy}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* INVOICES SECTION */}
      <div id="invoices-table" className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h4 className="text-sm font-bold text-text">Workspace Invoices</h4>
            <p className="text-xs text-text-muted">
              Monthly tax invoices with automated CGST/SGST vs IGST calculation based on billing address.
            </p>
          </div>
          <span className="font-mono text-xs text-text-muted">
            {data.invoices.length} invoices ({data.invoices.filter((i) => i.status === "paid").length} paid)
          </span>
        </div>

        {data.invoices.length === 0 ? (
          <p className="text-xs text-text-muted italic p-4 text-center">No invoices generated for this workspace.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-2 text-[10px] uppercase text-text-muted">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Pre-Tax Amount</th>
                  <th className="py-2.5 px-3">GST Breakup</th>
                  <th className="py-2.5 px-3">Total Amount</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {data.invoices.map((inv: any) => {
                  const gst = inv.gst;
                  return (
                    <tr key={inv.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-text font-sans">
                        #{inv.id}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-text-muted">{inv.period}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase font-bold ${
                            inv.status === "paid"
                              ? "bg-success/20 text-success"
                              : inv.status === "overdue"
                              ? "bg-danger/20 text-danger"
                              : inv.status === "disputed"
                              ? "bg-warning/20 text-warning"
                              : inv.status === "draft"
                              ? "bg-surface-2 text-text-muted"
                              : "bg-[#7C7CFF]/20 text-[#7C7CFF]"
                          }`}
                        >
                          {inv.status}
                          {inv.isOverdue && inv.status !== "paid" && ` (${inv.daysOverdue}d)`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-text-muted">{formatINR(inv.amount)}</td>
                      <td className="py-2.5 px-3 font-sans text-[10px]">
                        {gst.isInterstate ? (
                          <span className="text-[#5B9DFF]">IGST 18%: {formatINR(gst.igstAmount)}</span>
                        ) : (
                          <span className="text-success">
                            CGST 9% ({formatINR(gst.cgstAmount)}) + SGST 9% ({formatINR(gst.sgstAmount)})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-text">{formatINR(gst.totalAmount)}</td>
                      <td className="py-2.5 px-3 text-text-muted whitespace-nowrap font-sans">
                        {new Date(inv.dueAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Printable View */}
                          <button
                            type="button"
                            onClick={() => setInspectingInvoice(inv)}
                            className="rounded p-1 text-text-muted hover:text-text hover:bg-surface-2"
                            title="Print / View Invoice"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>

                          {/* Issue Draft */}
                          {inv.status === "draft" && canManageMoney && (
                            <button
                              type="button"
                              onClick={() => handleIssueDraft(inv.id)}
                              className="rounded bg-accent/20 text-accent px-2 py-0.5 text-[10px] font-semibold hover:bg-accent/30"
                            >
                              Issue
                            </button>
                          )}

                          {/* Mark Paid */}
                          {inv.status !== "paid" && canManageMoney && (
                            <button
                              type="button"
                              onClick={() => {
                                setPayingInvoice(inv);
                                setPayRef("");
                              }}
                              className="rounded bg-success/20 text-success px-2 py-0.5 text-[10px] font-semibold hover:bg-success/30"
                            >
                              Mark Paid
                            </button>
                          )}

                          {/* Dispute */}
                          {inv.status !== "paid" && inv.status !== "disputed" && canManageMoney && (
                            <button
                              type="button"
                              onClick={() => {
                                setDisputingInvoiceId(inv.id);
                                setDisputeReason("");
                              }}
                              className="rounded border border-warning/30 bg-warning/10 text-warning px-1.5 py-0.5 text-[10px] hover:bg-warning/20"
                            >
                              Dispute
                            </button>
                          )}

                          {/* Follow-up Note */}
                          {inv.isOverdue && inv.status !== "paid" && (
                            <button
                              type="button"
                              onClick={() => {
                                setFollowUpInvoiceId(inv.id);
                                setFollowUpNote("");
                              }}
                              className="rounded border border-danger/30 bg-danger/10 text-danger px-1.5 py-0.5 text-[10px] hover:bg-danger/20 font-bold"
                            >
                              Follow-up
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: CHANGE CREDIT LIMIT */}
      {showLimitModal && post && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl p-5 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text">Change Postpaid Credit Limit</h3>
                <p className="text-xs text-text-muted">Workspace: {data.workspaceName}</p>
              </div>
              <button type="button" onClick={() => setShowLimitModal(false)} className="text-text-muted hover:text-text">
                ✕
              </button>
            </div>

            <form onSubmit={handleChangeLimit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded bg-surface-2 border border-border">
                <div>
                  <span className="text-[10px] uppercase text-text-muted">Current Limit</span>
                  <div className="font-mono text-sm font-bold text-text">{formatINR(post.creditLimit)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-text-muted">Current Used</span>
                  <div className="font-mono text-sm font-bold text-text">{formatINR(post.creditUsed)}</div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-text">Proposed Credit Limit (INR)</label>
                <input
                  type="number"
                  value={newLimitInput}
                  onChange={(e) => setNewLimitInput(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  required
                />

                {/* Projected Utilization Live Feedback */}
                {(() => {
                  const num = Number(newLimitInput);
                  if (num > 0) {
                    const projUtil = Math.round((post.creditUsed / num) * 100);
                    const diff = num - post.creditLimit;
                    const pctDiff = post.creditLimit > 0 ? (diff / post.creditLimit) * 100 : 100;
                    const triggersOverdue = data.hasOverdueInvoices;
                    const triggersAmount = diff > 500000;
                    const triggersPct = pctDiff > 25;
                    const triggersBelowUsed = num < post.creditUsed;
                    const needsApproval = triggersOverdue || triggersAmount || triggersPct || triggersBelowUsed;

                    return (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-text-muted">Projected Utilization:</span>
                          <span className="font-mono font-bold text-text">{projUtil}%</span>
                        </div>

                        {needsApproval && (
                          <div className="rounded border border-warning/40 bg-warning/10 p-2.5 text-[11px] text-warning flex items-start gap-1.5">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold block">Requires Finance Head Approval:</span>
                              {triggersBelowUsed && <div>• Proposed limit is below currently utilized credit.</div>}
                              {triggersOverdue && <div>• Account has overdue invoices pending settlement.</div>}
                              {triggersAmount && <div>• Increase exceeds ₹5,00,000 auto-approval ceiling.</div>}
                              {triggersPct && <div>• Expansion exceeds 25% single-step policy limit.</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div>
                <label className="text-[11px] font-medium text-text">
                  Audit Reason <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={2}
                  value={limitReason}
                  onChange={(e) => setLimitReason(e.target.value)}
                  placeholder="e.g., Client expanding promotional traffic for festive season."
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-2 text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLimitModal(false)}
                  className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLimit}
                  className="rounded bg-[#7C7CFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6868F7] transition-colors disabled:opacity-40"
                >
                  {isSubmittingLimit ? "Submitting..." : "Submit Credit Change"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD PREPAID TOPUP */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl p-5 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text">Record Wallet Top-Up</h3>
                <p className="text-xs text-text-muted">Atomic balance credit with UTR fraud check</p>
              </div>
              <button type="button" onClick={() => setShowTopupModal(false)} className="text-text-muted hover:text-text">
                ✕
              </button>
            </div>

            <form onSubmit={handleTopup} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-medium text-text">Top-up Amount (INR)</label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-text">Payment Mode</label>
                <select
                  value={topupMode}
                  onChange={(e) => setTopupMode(e.target.value as any)}
                  className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                >
                  <option value="NEFT">NEFT (National Electronic Funds Transfer)</option>
                  <option value="RTGS">RTGS (Real Time Gross Settlement)</option>
                  <option value="IMPS">IMPS (Immediate Payment Service)</option>
                  <option value="Net Banking">Net Banking Corporate Gateway</option>
                  <option value="UPI">UPI Virtual Private Ledger</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-text">
                  Bank UTR / Transaction Reference <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC984128471"
                  value={topupRef}
                  onChange={(e) => setTopupRef(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  required
                />
                <span className="text-[10px] text-text-muted block mt-0.5">
                  Unique reference required. Duplicate UTRs are rejected by fraud guard.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTopupModal(false)}
                  className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTopup}
                  className="rounded bg-[#7C7CFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6868F7] transition-colors disabled:opacity-40"
                >
                  {isSubmittingTopup ? "Recording..." : "Record Top-Up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MANUAL ADJUSTMENT */}
      {showAdjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl p-5 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text">Record Financial Adjustment</h3>
                <p className="text-xs text-text-muted">
                  {isPostpaid ? "Modifies credit used balance" : "Adjusts prepaid wallet balance"}
                </p>
              </div>
              <button type="button" onClick={() => setShowAdjModal(false)} className="text-text-muted hover:text-text">
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustment} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-text">Adjustment Type</label>
                  <select
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as any)}
                    className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text"
                  >
                    <option value="credit">Credit (Relief / Addition)</option>
                    <option value="debit">Debit (Deduction)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-text">Reason Code</label>
                  <select
                    value={adjReasonCode}
                    onChange={(e) => setAdjReasonCode(e.target.value as any)}
                    className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text"
                  >
                    <option value="goodwill_credit">Goodwill Credit</option>
                    <option value="billing_error">Billing Error Correction</option>
                    <option value="refund">Commercial Refund</option>
                    <option value="chargeback">Bank Chargeback</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-text">Amount (INR)</label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text"
                  required
                />
                {Number(adjAmount) > 50000 && (
                  <span className="text-[10px] text-warning block mt-1">
                    ⚠ Adjustments exceeding ₹50,000 require Finance Head dual-approval.
                  </span>
                )}
              </div>

              <div>
                <label className="text-[11px] font-medium text-text">
                  Audit Explanation <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={2}
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g., Concession granted for telecom gateway latency outage on 14th Oct."
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-2 text-xs text-text"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjModal(false)}
                  className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdj}
                  className="rounded bg-[#7C7CFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6868F7] disabled:opacity-40"
                >
                  {isSubmittingAdj ? "Processing..." : "Apply Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: MARK INVOICE PAID */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl p-5 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text">Mark Invoice #{payingInvoice.id} as Paid</h3>
                <p className="text-xs text-text-muted">Total Dues: {formatINR(payingInvoice.gst.totalAmount)}</p>
              </div>
              <button type="button" onClick={() => setPayingInvoice(null)} className="text-text-muted hover:text-text">
                ✕
              </button>
            </div>

            <form onSubmit={handleMarkPaid} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-medium text-text">Settlement Mode</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text"
                >
                  <option value="RTGS">RTGS Bank Settlement</option>
                  <option value="NEFT">NEFT Settlement</option>
                  <option value="IMPS">IMPS Immediate</option>
                  <option value="Wire Transfer">Corporate Wire</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-text">
                  Bank Reference / UTR <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR984128470"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="rounded bg-success px-4 py-1.5 text-xs font-semibold text-white hover:bg-success/90 disabled:opacity-40"
                >
                  {isSubmittingPay ? "Settling..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: DISPUTE INVOICE */}
      {disputingInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl p-5 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text">Flag Invoice #{disputingInvoiceId} as Disputed</h3>
                <p className="text-xs text-text-muted">Pauses automated collections and notifies AM</p>
              </div>
              <button type="button" onClick={() => setDisputingInvoiceId(null)} className="text-text-muted hover:text-text">
                ✕
              </button>
            </div>

            <form onSubmit={handleDispute} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-medium text-text">
                  Dispute Reason <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={3}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="e.g., Client disputing message volume discrepancy in WhatsApp conversations."
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-2 text-xs text-text"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputingInvoiceId(null)}
                  className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispute}
                  className="rounded bg-warning px-4 py-1.5 text-xs font-semibold text-black hover:bg-warning/90 disabled:opacity-40"
                >
                  {isSubmittingDispute ? "Flagging..." : "Flag Disputed"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: PRINTABLE TAX INVOICE */}
      {inspectingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-[#111113] p-6 space-y-6 text-text animate-in fade-in-50 zoom-in-95 print:p-0 print:border-none print:bg-white print:text-black">
            {/* Print Header */}
            <div className="flex items-start justify-between border-b border-border pb-4 print:border-black">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl font-bold tracking-tight text-white print:text-black">RELAY TECHNOLOGIES PVT LTD</span>
                </div>
                <div className="text-xs text-text-muted print:text-gray-600 mt-1 space-y-0.5">
                  <p>Prestige Tech Park, Marathahalli-Sarjapur Outer Ring Rd, Bengaluru, Karnataka 560103</p>
                  <p>GSTIN: 29AABCR8921K1ZK • PAN: AABCR8921K • State: Karnataka (29)</p>
                </div>
              </div>

              <div className="text-right">
                <span className="rounded border border-[#7C7CFF]/40 bg-[#7C7CFF]/10 text-[#7C7CFF] px-2 py-0.5 text-[10px] font-mono uppercase font-bold print:border-none print:text-black">
                  TAX INVOICE
                </span>
                <div className="font-mono text-sm font-bold text-text print:text-black mt-1">
                  #{inspectingInvoice.id}
                </div>
                <span className="text-[11px] text-text-muted print:text-gray-600">
                  Date: {new Date(inspectingInvoice.issuedAt).toLocaleDateString("en-IN")}
                </span>
              </div>
            </div>

            {/* Bill To Info */}
            <div className="grid grid-cols-2 gap-4 text-xs border-b border-border pb-4 print:border-black">
              <div>
                <span className="text-[10px] uppercase font-semibold text-text-muted print:text-gray-600">Billed To Customer:</span>
                <div className="font-bold text-sm text-text print:text-black mt-0.5">{data.orgName}</div>
                <p className="text-text-muted print:text-gray-600">Workspace: {data.workspaceName}</p>
                <p className="text-text-muted print:text-gray-600">GSTIN: {data.gstin}</p>
                <p className="text-text-muted print:text-gray-600">Billing State: {data.billingState}</p>
              </div>

              <div className="text-right space-y-1">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-text-muted print:text-gray-600">Billing Period:</span>
                  <div className="font-semibold text-text print:text-black">{inspectingInvoice.period}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-text-muted print:text-gray-600">Due Date:</span>
                  <div className="font-mono text-text print:text-black">{new Date(inspectingInvoice.dueAt).toLocaleDateString("en-IN")}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-text-muted print:text-gray-600">Status:</span>
                  <div className="font-mono uppercase font-bold text-text print:text-black">{inspectingInvoice.status}</div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-2 text-[10px] uppercase text-text-muted print:border-black print:bg-gray-100 print:text-black">
                  <tr>
                    <th className="py-2 px-2">Description</th>
                    <th className="py-2 px-2 text-right">Taxable Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono text-[11px] print:divide-black">
                  {(() => {
                    let lines: any[] = [];
                    try {
                      if (inspectingInvoice.lineItems) lines = JSON.parse(inspectingInvoice.lineItems);
                    } catch {}
                    if (lines.length === 0) {
                      lines = [
                        { description: `Platform Enterprise Subscription Fee (${inspectingInvoice.period})`, amount: inspectingInvoice.amount * 0.4 },
                        { description: "SMS, RCS & WhatsApp Wholesale Message Dispatches", amount: inspectingInvoice.amount * 0.6 },
                      ];
                    }
                    return lines.map((l: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2 px-2 font-sans text-text print:text-black">{l.description || l.desc}</td>
                        <td className="py-2 px-2 text-right">{formatINR(l.amount)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Totals & GST Summary */}
            <div className="border-t border-border pt-4 text-xs space-y-1.5 font-mono print:border-black">
              <div className="flex justify-between text-text-muted print:text-gray-600">
                <span>Taxable Pre-Tax Value:</span>
                <span>{formatINR(inspectingInvoice.amount)}</span>
              </div>

              {inspectingInvoice.gst.isInterstate ? (
                <div className="flex justify-between text-[#5B9DFF] print:text-black">
                  <span>Integrated GST (IGST 18%):</span>
                  <span>{formatINR(inspectingInvoice.gst.igstAmount)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-success print:text-black">
                    <span>Central GST (CGST 9%):</span>
                    <span>{formatINR(inspectingInvoice.gst.cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-success print:text-black">
                    <span>State GST (SGST 9%):</span>
                    <span>{formatINR(inspectingInvoice.gst.sgstAmount)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-sm font-bold text-text pt-2 border-t border-border print:border-black print:text-black">
                <span>Total Invoice Value (INR):</span>
                <span>{formatINR(inspectingInvoice.gst.totalAmount)}</span>
              </div>
            </div>

            {/* Print & Close Controls (Hidden when printed) */}
            <div className="flex items-center justify-between pt-4 border-t border-border print:hidden">
              <button
                type="button"
                onClick={() => setInspectingInvoice(null)}
                className="rounded px-4 py-1.5 text-xs text-text-muted hover:text-text"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded bg-[#7C7CFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6868F7]"
              >
                <Printer className="h-4 w-4" />
                <span>Print / Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: COLLECTIONS FOLLOW-UP */}
      {followUpInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl p-5 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text">Log Collections Follow-up</h3>
                <p className="text-xs text-text-muted">Creates an action task assigned to Account Manager</p>
              </div>
              <button type="button" onClick={() => setFollowUpInvoiceId(null)} className="text-text-muted hover:text-text">
                ✕
              </button>
            </div>

            <form onSubmit={handleLogFollowUp} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-medium text-text">Follow-up Notes &amp; Next Action</label>
                <textarea
                  rows={3}
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  placeholder="e.g., Spoke with customer AP team. Committed RTGS settlement by Friday."
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-2 text-xs text-text"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFollowUpInvoiceId(null)}
                  className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFollowUp}
                  className="rounded bg-[#7C7CFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6868F7] disabled:opacity-40"
                >
                  {isSubmittingFollowUp ? "Logging..." : "Create Task & Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
