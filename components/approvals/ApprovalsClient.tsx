"use client";

import React, { useState, useTransition } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyText } from "@/components/ui/MoneyText";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toaster";
import {
  approveChangeRequestAction,
  rejectChangeRequestAction,
  cancelChangeRequestAction,
  requestCreditLimitIncreaseAction,
} from "@/app/actions/approvals";
import { formatDateTimeIST } from "@/lib/utils";
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  PlusCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

export interface ChangeRequestItem {
  id: string;
  type: string;
  targetType: string;
  targetId: string;
  payload: string;
  status: string;
  requestedBy: string;
  approverRoleNeeded: string;
  approvedBy: string | null;
  reason: string;
  decisionNote: string | null;
  createdAt: Date | string | number;
  decidedAt: Date | string | number | null;
  expiresAt: Date | string | number | null;
  requesterName: string;
  requesterRole: string;
  targetName: string;
}

interface ApprovalsClientProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
  requestsList: ChangeRequestItem[];
  availableWorkspaces: Array<{ id: string; name: string; creditLimit: number; creditUsed: number }>;
}

export function ApprovalsClient({
  currentUser,
  requestsList,
  availableWorkspaces,
}: ApprovalsClientProps) {
  const [activeTab, setActiveTab] = useState<"needs_my_approval" | "my_requests" | "all">("needs_my_approval");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [testHikeOpen, setTestHikeOpen] = useState(false);

  // New Hike Demo Form State
  const [selectedWsId, setSelectedWsId] = useState(availableWorkspaces[0]?.id || "");
  const [newLimitInput, setNewLimitInput] = useState(3500000);
  const [hikeReasonInput, setHikeReasonInput] = useState("Campaign burst requiring limit hike above ₹5,00,000 threshold");

  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Tab Filtering
  const needsMyApproval = requestsList.filter((r) => {
    if (r.status !== "pending") return false;
    if (r.requestedBy === currentUser.id) return false; // Maker cannot check own request
    return currentUser.role === "admin" || r.approverRoleNeeded === currentUser.role;
  });

  const myRequests = requestsList.filter((r) => r.requestedBy === currentUser.id);

  const displayedRequests =
    activeTab === "needs_my_approval"
      ? needsMyApproval
      : activeTab === "my_requests"
      ? myRequests
      : requestsList;

  // Handlers
  const handleApprove = async (note: string) => {
    if (!selectedRequestId) return;
    startTransition(async () => {
      try {
        await approveChangeRequestAction({
          requestId: selectedRequestId,
          note,
        });
        toast.success("Change Request Approved & Executed", {
          description: "Target workspace state updated and immutable audit entry recorded.",
        });
        setApproveDialogOpen(false);
        setSelectedRequestId(null);
        router.refresh();
      } catch (err: any) {
        toast.error("Approval Failed", { description: err?.message || "Unknown error" });
      }
    });
  };

  const handleReject = async (note: string) => {
    if (!selectedRequestId) return;
    startTransition(async () => {
      try {
        await rejectChangeRequestAction({
          requestId: selectedRequestId,
          note,
        });
        toast.info("Change Request Rejected", {
          description: `Decision note recorded: "${note}"`,
        });
        setRejectDialogOpen(false);
        setSelectedRequestId(null);
        router.refresh();
      } catch (err: any) {
        toast.error("Rejection Failed", { description: err?.message || "Unknown error" });
      }
    });
  };

  const handleCancel = async () => {
    if (!selectedRequestId) return;
    startTransition(async () => {
      try {
        await cancelChangeRequestAction({ requestId: selectedRequestId });
        toast.info("Request Cancelled", {
          description: "Pending request was cancelled by maker.",
        });
        setCancelDialogOpen(false);
        setSelectedRequestId(null);
        router.refresh();
      } catch (err: any) {
        toast.error("Cancellation Failed", { description: err?.message || "Unknown error" });
      }
    });
  };

  const handleCreateTestHike = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await requestCreditLimitIncreaseAction({
          workspaceId: selectedWsId,
          newCreditLimit: Number(newLimitInput),
          reason: hikeReasonInput,
        });

        if (res.status === "pending") {
          toast.warning("Halted by Maker-Checker Policy", {
            description: `${res.message} Pending approval from ${res.approverRole}.`,
          });
        } else {
          toast.success("Credit Limit Updated Directly", {
            description: res.message,
          });
        }

        setTestHikeOpen(false);
        router.refresh();
      } catch (err: any) {
        toast.error("Operation Denied", {
          description: err?.message || "Permission or policy error.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Approvals Inbox (Maker-Checker)"
        description="Dual-control governance queue. High-risk credit expansions, custom discounts, and account suspensions require secondary review."
        badge={
          <StatusBadge
            status={needsMyApproval.length > 0 ? "warning" : "active"}
            label={`${needsMyApproval.length} Actionable for You`}
            size="sm"
          />
        }
        breadcrumbs={[
          { label: "Relay BMP", href: "/" },
          { label: "Governance" },
          { label: "Approvals Inbox" },
        ]}
        actions={
          <button
            type="button"
            onClick={() => setTestHikeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover shadow-accent-glow transition-all"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Raise Credit Limit (Demo)</span>
          </button>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("needs_my_approval")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === "needs_my_approval"
              ? "bg-accent/15 text-accent border border-accent/30"
              : "text-text-muted hover:text-text hover:bg-surface-2"
          }`}
        >
          <span>Needs My Approval</span>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.2 font-mono text-[10px]">
            {needsMyApproval.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("my_requests")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === "my_requests"
              ? "bg-accent/15 text-accent border border-accent/30"
              : "text-text-muted hover:text-text hover:bg-surface-2"
          }`}
        >
          <span>My Requests</span>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.2 font-mono text-[10px]">
            {myRequests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === "all"
              ? "bg-accent/15 text-accent border border-accent/30"
              : "text-text-muted hover:text-text hover:bg-surface-2"
          }`}
        >
          <span>All History</span>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.2 font-mono text-[10px]">
            {requestsList.length}
          </span>
        </button>
      </div>

      {/* Requests Feed */}
      <div className="space-y-4">
        {displayedRequests.length === 0 ? (
          <EmptyState
            icon={<FileCheck2 className="h-6 w-6" />}
            title={
              activeTab === "needs_my_approval"
                ? "No Approvals Pending for Your Role"
                : activeTab === "my_requests"
                ? "You Have Not Submitted Any Requests"
                : "No Change Requests on Record"
            }
            description={
              activeTab === "needs_my_approval"
                ? `You are acting as ${currentUser.name} (${currentUser.role.replace("_", " ")}). Switch role in top-bar (e.g. to Finance Head or Admin) to review other pending requests.`
                : "All submitted change requests will appear here with before/after diffs."
            }
          />
        ) : (
          displayedRequests.map((req) => {
            let payloadObj: any = {};
            try {
              payloadObj = JSON.parse(req.payload);
            } catch (e) {
              payloadObj = {};
            }

            const isPendingState = req.status === "pending";
            const isMaker = req.requestedBy === currentUser.id;
            const canApprove =
              isPendingState &&
              !isMaker &&
              (currentUser.role === "admin" || currentUser.role === req.approverRoleNeeded);

            const isExpired = req.expiresAt && new Date(req.expiresAt).getTime() < Date.now();

            return (
              <div
                key={req.id}
                className="rounded-lg border border-border bg-surface p-5 transition-all hover:border-border/80 space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent uppercase tracking-wider border border-accent/25">
                      {req.type.replace(/_/g, " ")}
                    </span>
                    <h3 className="text-sm font-semibold text-text tracking-tight">
                      {req.targetName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={req.status} size="sm" />
                    <span className="font-mono text-[11px] text-text-muted">
                      ID: {req.id}
                    </span>
                  </div>
                </div>

                {/* Body Details & Policy Trigger */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: What Changed (Diff View) */}
                  <div className="rounded border border-border bg-surface-2 p-3.5 space-y-2">
                    <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center justify-between">
                      <span>Proposed State Diff</span>
                      {payloadObj.policyName && (
                        <span className="text-warning text-[10px] font-mono">
                          Trigger: {payloadObj.policyName}
                        </span>
                      )}
                    </div>

                    {req.type === "credit_limit_increase" && (
                      <div className="flex items-center gap-3 pt-1">
                        <div>
                          <span className="text-[10px] text-text-muted block">Current Limit</span>
                          <MoneyText
                            amount={payloadObj.currentCreditLimit}
                            className="text-sm text-text-muted line-through"
                          />
                        </div>
                        <ArrowRight className="h-4 w-4 text-accent" />
                        <div>
                          <span className="text-[10px] text-text-muted block">Requested Limit</span>
                          <MoneyText
                            amount={payloadObj.newCreditLimit}
                            className="text-base text-success font-bold"
                          />
                        </div>
                        {payloadObj.increasePct && (
                          <span className="rounded bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] text-warning border border-warning/30 ml-auto">
                            +{payloadObj.increasePct}% Hike
                          </span>
                        )}
                      </div>
                    )}

                    {req.type === "custom_discount" && (
                      <div className="flex items-center gap-3 pt-1">
                        <div>
                          <span className="text-[10px] text-text-muted block">Standard Discount</span>
                          <span className="font-mono text-sm line-through text-text-muted">
                            {payloadObj.currentDiscountPct || 0}%
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-accent" />
                        <div>
                          <span className="text-[10px] text-text-muted block">Requested Discount</span>
                          <span className="font-mono text-base font-bold text-success">
                            {payloadObj.requestedDiscountPct}%
                          </span>
                        </div>
                      </div>
                    )}

                    {req.type === "account_suspension" && (
                      <div className="text-xs text-danger font-medium pt-1">
                        Requesting full service cutoff and message delivery throttling.
                      </div>
                    )}

                    {payloadObj.policyDescription && (
                      <p className="text-[11px] text-text-muted/80 italic pt-1 border-t border-border/40">
                        "{payloadObj.policyDescription}"
                      </p>
                    )}
                  </div>

                  {/* Right: Maker Details & Audit Reason */}
                  <div className="rounded border border-border bg-surface-2 p-3.5 space-y-2">
                    <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      Maker Justification & Timeline
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted">Submitted by:</span>
                      <strong className="text-text">{req.requesterName}</strong>
                      <span className="rounded bg-surface px-1.5 py-0.2 text-[10px] font-mono text-text-muted border border-border">
                        {req.requesterRole}
                      </span>
                    </div>

                    <div className="text-xs text-text-muted/90 bg-surface/70 rounded p-2 border border-border/50">
                      "{req.reason}"
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-text-muted pt-1">
                      <span>Submitted: {formatDateTimeIST(req.createdAt)}</span>
                      {isPendingState && req.expiresAt && (
                        <span className="text-warning flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          72h SLA Window
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Checker Decision Row */}
                {req.status !== "pending" && (
                  <div className="rounded border border-border/80 bg-surface-2/60 p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted font-medium">Outcome:</span>
                      <strong className="capitalize text-text">{req.status}</strong>
                      {req.approvedBy && (
                        <span className="text-text-muted">
                          by <strong className="text-text">{req.approvedBy}</strong> on{" "}
                          {formatDateTimeIST(req.decidedAt)}
                        </span>
                      )}
                    </div>
                    {req.decisionNote && (
                      <span className="italic text-text-muted text-[11px]">
                        Note: "{req.decisionNote}"
                      </span>
                    )}
                  </div>
                )}

                {/* Action Controls for Pending Requests */}
                {isPendingState && (
                  <div className="flex items-center justify-between border-t border-border/50 pt-3">
                    <div className="text-xs text-text-muted">
                      Required Checker Role:{" "}
                      <strong className="text-accent uppercase font-mono">
                        {req.approverRoleNeeded.replace("_", " ")}
                      </strong>
                      {isMaker && (
                        <span className="ml-2 text-warning font-medium">
                          (You created this request — maker cannot approve own submission)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isMaker && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            setSelectedRequestId(req.id);
                            setCancelDialogOpen(true);
                          }}
                          className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                        >
                          Cancel Request
                        </button>
                      )}

                      {canApprove && (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              setSelectedRequestId(req.id);
                              setRejectDialogOpen(true);
                            }}
                            className="rounded-md border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/20 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              setSelectedRequestId(req.id);
                              setApproveDialogOpen(true);
                            }}
                            className="rounded-md bg-accent px-3.5 py-1.5 text-xs font-medium text-white hover:bg-accent-hover shadow-accent-glow transition-all"
                          >
                            Approve & Execute
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Approve Dialog */}
      <ReasonDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        title="Approve & Execute Change Request"
        description="As the secondary reviewer, your approval will immediately execute the mutation on the live account and write an immutable audit log entry."
        actionLabel="Approve & Apply"
        placeholder="E.g. Reviewed 90-day seasonal transaction burn and confirmed creditworthiness..."
        minReasonLength={10}
        isLoading={isPending}
        onSubmit={handleApprove}
      />

      {/* Reject Dialog */}
      <ReasonDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        title="Reject Change Request"
        description="A decision note explaining the rejection reason is required for compliance audit trails."
        actionLabel="Reject Request"
        placeholder="E.g. Declined due to uncollected outstanding invoices on subsidiary account..."
        minReasonLength={5}
        isLoading={isPending}
        onSubmit={handleReject}
      />

      {/* Cancel Dialog */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Change Request"
        description="Are you sure you want to withdraw this pending request? This action will mark it cancelled."
        confirmLabel="Withdraw Request"
        variant="danger"
        isLoading={isPending}
        onConfirm={handleCancel}
      />

      {/* Demo: Raise Credit Limit Dialog */}
      {testHikeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold text-text">
                  Raise Postpaid Credit Limit
                </h3>
                <p className="text-xs text-text-muted">
                  Test the maker-checker engine and policy triggers in real time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTestHikeOpen(false)}
                className="text-text-muted hover:text-text text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTestHike} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1">
                  Select Target Workspace
                </label>
                <select
                  value={selectedWsId}
                  onChange={(e) => setSelectedWsId(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
                >
                  {availableWorkspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name} (Current Limit: ₹{ws.creditLimit.toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1">
                  New Credit Limit (INR)
                </label>
                <input
                  type="number"
                  value={newLimitInput}
                  onChange={(e) => setNewLimitInput(Number(e.target.value))}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text font-mono focus:border-accent focus:outline-none"
                />
                <span className="text-[11px] text-text-muted mt-1 block">
                  Rule: Increase &gt; ₹5,00,000 or &gt; 25% halts for Finance Head review.
                </span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1">
                  Mandatory Audit Reason (min 10 chars)
                </label>
                <textarea
                  required
                  rows={2}
                  value={hikeReasonInput}
                  onChange={(e) => setHikeReasonInput(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
                  placeholder="Justification for credit increase..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setTestHikeOpen(false)}
                  className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover shadow-accent-glow"
                >
                  {isPending ? "Submitting..." : "Submit Mutation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
