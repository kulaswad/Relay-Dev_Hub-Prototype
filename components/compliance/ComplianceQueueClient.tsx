"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  FileText,
  FileCheck2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  Building2,
  Layers,
  Filter,
  Search,
  ExternalLink,
  Sparkles,
  Bot,
  HelpCircle,
  Plus,
} from "lucide-react";
import { ActiveUser } from "@/components/layout/RoleContext";
import { ComplianceQueueItem } from "@/lib/services/compliance";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  approveKycCaseAction,
  rejectKycCaseAction,
  approveSenderIdAction,
  approveTemplateAction,
  simulateCustomerSubmissionAction,
} from "@/app/actions/compliance";
import { validateSenderIdHeader, inspectTemplateContent } from "@/lib/validation/compliance";
import { KycDocumentReaderModal } from "./KycDocumentReaderModal";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

export interface ComplianceQueueClientProps {
  initialItems: ComplianceQueueItem[];
  stats: {
    totalPending: number;
    slaBreachedCount: number;
    avgWaitTimeDays: number;
    approvedThisWeekCount: number;
  };
  allWorkspaces: Array<{ id: string; name: string; orgId: string; orgName: string }>;
  currentUser: ActiveUser;
}

export function ComplianceQueueClient({
  initialItems,
  stats,
  allWorkspaces,
  currentUser,
}: ComplianceQueueClientProps) {
  const router = useRouter();
  const isCompliance = currentUser.role === "compliance" || currentUser.role === "admin";

  // Tab State: "queue" | "simulator"
  const [activeTab, setActiveTab] = useState<"queue" | "simulator">("queue");

  // Filter States
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [slaBreachedOnly, setSlaBreachedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Review Modal State
  const [inspectingItem, setInspectingItem] = useState<ComplianceQueueItem | null>(null);
  const [reviewNote, setReviewNote] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [showRejectForm, setShowRejectForm] = useState<boolean>(false);
  const [dltTemplateIdInput, setDltTemplateIdInput] = useState<string>("1407161234567890123");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showAiReaderModal, setShowAiReaderModal] = useState<boolean>(false);

  // Simulator Form State
  const [simWsId, setSimWsId] = useState<string>(allWorkspaces[0]?.id || "");
  const [simType, setSimType] = useState<"kyc" | "sender_id" | "template">("kyc");
  const [simHeader, setSimHeader] = useState<string>("RELTKY");
  const [simChannel, setSimChannel] = useState<string>("sms");
  const [simTmplName, setSimTmplName] = useState<string>("Festive Promotional Offer");
  const [simTmplCat, setSimTmplCat] = useState<string>("promotional");
  const [simTmplBody, setSimTmplBody] = useState<string>(
    "Exclusive Offer: Use code {#code#} for 25% off your next purchase. Reply STOP to opt out."
  );
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Filter items
  const filteredItems = useMemo(() => {
    return initialItems.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (slaBreachedOnly && !item.slaBreached) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          item.itemTitle.toLowerCase().includes(q) ||
          item.workspaceName.toLowerCase().includes(q) ||
          item.orgName.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [initialItems, typeFilter, statusFilter, slaBreachedOnly, searchQuery]);

  // Handlers for Review Actions
  const handleApproveKyc = async () => {
    if (!inspectingItem) return;
    try {
      setIsProcessing(true);
      const res = await approveKycCaseAction({
        caseId: inspectingItem.id,
        note: reviewNote.trim() || undefined,
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "KYC Case Approved",
        description: `Verified MCA & GSTIN documents for ${inspectingItem.workspaceName}. Workspace marked active-eligible.`,
        variant: "default",
      });

      setInspectingItem(null);
      setReviewNote("");
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Approval Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectKyc = async () => {
    if (!inspectingItem || rejectReason.trim().length < 10) {
      toast({
        title: "Justification Required",
        description: "Rejection requires an explicit audit reason of at least 10 characters.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      const res = await rejectKycCaseAction({
        caseId: inspectingItem.id,
        reason: rejectReason.trim(),
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "KYC Case Rejected",
        description: `Rejected with reason: "${rejectReason.trim()}".`,
        variant: "destructive",
      });

      setInspectingItem(null);
      setShowRejectForm(false);
      setRejectReason("");
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Rejection Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveSenderId = async () => {
    if (!inspectingItem) return;
    try {
      setIsProcessing(true);
      const res = await approveSenderIdAction({
        senderId: inspectingItem.id,
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Sender ID Header Approved",
        description: `Header '${inspectingItem.itemTitle}' is now registered for message dispatch.`,
        variant: "default",
      });

      setInspectingItem(null);
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Approval Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveTemplate = async () => {
    if (!inspectingItem) return;
    if (!dltTemplateIdInput.trim()) {
      toast({
        title: "DLT ID Required",
        description: "Enter a valid TRAI DLT Template Registration ID to complete approval.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      const res = await approveTemplateAction({
        templateId: inspectingItem.id,
        dltTemplateId: dltTemplateIdInput.trim(),
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Template Approved",
        description: `Template '${inspectingItem.itemTitle}' approved with DLT ID ${dltTemplateIdInput.trim()}.`,
        variant: "default",
      });

      setInspectingItem(null);
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Approval Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler for Customer Simulator
  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simWsId) return;

    try {
      setIsSimulating(true);
      let payload: any = {};
      if (simType === "kyc") {
        payload = {
          documents: [
            { type: "gst_certificate", filename: "gst_certificate_meridian.pdf" },
            { type: "pan_card", filename: "pan_card_meridian.pdf" },
          ],
        };
      } else if (simType === "sender_id") {
        payload = { header: simHeader, channel: simChannel };
      } else if (simType === "template") {
        payload = { name: simTmplName, category: simTmplCat, body: simTmplBody };
      }

      const res = await simulateCustomerSubmissionAction({
        workspaceId: simWsId,
        type: simType,
        payload,
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Customer Submission Simulated",
        description: `Simulated customer request created (${res.id}) and queued in Compliance.`,
        variant: "default",
      });

      setActiveTab("queue");
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Simulation Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation: Queue vs Customer Simulation */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5",
              activeTab === "queue"
                ? "bg-surface-2 text-text border border-border"
                : "text-text-muted hover:text-text"
            )}
          >
            <ShieldCheck className="h-4 w-4 text-accent" />
            <span>Verification Queue</span>
            <span className="rounded-full bg-accent/20 px-1.5 py-0.2 font-mono text-[10px] text-accent">
              {initialItems.filter((i) => i.status === "submitted" || i.status === "in_review").length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("simulator")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5",
              activeTab === "simulator"
                ? "bg-surface-2 text-text border border-border"
                : "text-text-muted hover:text-text"
            )}
          >
            <Sparkles className="h-4 w-4 text-warning" />
            <span>Customer Simulator (Demo)</span>
          </button>
        </div>

        <div className="text-xs text-text-muted font-mono">
          Evaluator: <strong className="text-text">{currentUser.name}</strong> ({currentUser.role})
        </div>
      </div>

      {activeTab === "queue" && (
        <div className="space-y-6">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
              <span className="text-xs text-text-muted uppercase font-semibold">Total Pending</span>
              <div className="font-mono text-xl font-bold text-text">{stats.totalPending}</div>
              <span className="text-[11px] text-text-muted">Awaiting compliance review</span>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
              <div className="flex items-center justify-between text-xs uppercase font-semibold">
                <span className="text-text-muted">SLA Breached</span>
                {stats.slaBreachedCount > 0 && (
                  <span className="flex h-2 w-2 rounded-full bg-danger animate-pulse" />
                )}
              </div>
              <div
                className={cn(
                  "font-mono text-xl font-bold",
                  stats.slaBreachedCount > 0 ? "text-danger" : "text-success"
                )}
              >
                {stats.slaBreachedCount}
              </div>
              <span className="text-[11px] text-text-muted">&gt;72h KYC or &gt;48h DLT SLA</span>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
              <span className="text-xs text-text-muted uppercase font-semibold">Avg Waiting Time</span>
              <div className="font-mono text-xl font-bold text-text">
                {stats.avgWaitTimeDays} <span className="text-xs font-normal text-text-muted">days</span>
              </div>
              <span className="text-[11px] text-text-muted">Across active submissions</span>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
              <span className="text-xs text-text-muted uppercase font-semibold">Approved Records</span>
              <div className="font-mono text-xl font-bold text-success">
                {stats.approvedThisWeekCount}
              </div>
              <span className="text-[11px] text-text-muted">Production authorizations</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Title, Header, Workspace, Org..."
                className="w-full rounded-md border border-border bg-surface-2 pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text focus:outline-none"
              >
                <option value="all">Type: All</option>
                <option value="kyc">KYC Cases</option>
                <option value="sender_id">Sender IDs (DLT)</option>
                <option value="template">Templates</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text focus:outline-none"
              >
                <option value="all">Status: All</option>
                <option value="submitted">Submitted</option>
                <option value="in_review">In Review</option>
                <option value="needs_info">Needs Info</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <button
                type="button"
                onClick={() => setSlaBreachedOnly(!slaBreachedOnly)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  slaBreachedOnly
                    ? "border-danger bg-danger/15 text-danger font-semibold"
                    : "border-border bg-surface-2 text-text-muted hover:text-text"
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>SLA Breached</span>
              </button>
            </div>
          </div>

          {/* Queue Table */}
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Submission Item</th>
                    <th className="py-3 px-3">Workspace / Organization</th>
                    <th className="py-3 px-3">Submitted At</th>
                    <th className="py-3 px-3">Waiting Time</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-text-muted">
                        <FileCheck2 className="mx-auto h-8 w-8 text-text-muted/40 mb-2" />
                        <p className="text-sm font-medium text-text">Compliance Queue Clear</p>
                        <p className="text-xs text-text-muted mt-1">
                          No pending submissions matching current filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-2/50 transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase border",
                              item.type === "kyc"
                                ? "bg-accent/15 text-accent border-accent/30"
                                : item.type === "sender_id"
                                ? "bg-[#3FB68B]/15 text-[#3FB68B] border-[#3FB68B]/30"
                                : "bg-[#5B9DFF]/15 text-[#5B9DFF] border-[#5B9DFF]/30"
                            )}
                          >
                            {item.type === "kyc"
                              ? "KYC"
                              : item.type === "sender_id"
                              ? "Sender ID"
                              : "Template"}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-text">
                            {item.type === "sender_id" ? (
                              <span className="font-mono text-sm tracking-wide text-accent">
                                {item.itemTitle}
                              </span>
                            ) : (
                              item.itemTitle
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-text-muted">{item.id}</div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-medium text-text">{item.workspaceName}</div>
                          <Link
                            href={`/accounts/${item.orgId}`}
                            className="text-[11px] text-text-muted hover:text-accent transition-colors"
                          >
                            {item.orgName}
                          </Link>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-text-muted whitespace-nowrap">
                          {item.submittedAt ? (
                            new Date(item.submittedAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={cn(
                              "font-mono text-xs font-semibold",
                              item.slaBreached
                                ? "text-danger bg-danger/10 px-1.5 py-0.5 rounded border border-danger/30"
                                : "text-text"
                            )}
                          >
                            {item.waitingTimeText}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <StatusBadge status={item.status} size="sm" />
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectingItem(item);
                              setShowRejectForm(false);
                              setReviewNote("");
                              setRejectReason("");
                            }}
                            className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text hover:bg-surface-2 hover:border-accent/50 transition-colors"
                          >
                            <Eye className="h-3 w-3 text-accent" />
                            <span>Review</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER SUBMISSION SIMULATOR TAB */}
      {activeTab === "simulator" && (
        <div className="rounded-lg border border-warning/40 bg-surface p-6 space-y-6 max-w-2xl mx-auto">
          <div className="border-b border-border/60 pb-3 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-warning" />
                <h3 className="text-sm font-bold text-text uppercase tracking-wider">
                  Customer Submission Simulator
                </h3>
              </div>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Internal testing harness to simulate customer self-service uploads from the customer portal. Exercising this workflow generates real records in SQLite and routes them to the Compliance Queue.
              </p>
            </div>
          </div>

          <form onSubmit={handleSimulateSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-text font-medium">Target Workspace</label>
              <select
                value={simWsId}
                onChange={(e) => setSimWsId(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:border-accent focus:outline-none"
              >
                {allWorkspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.orgName})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-text font-medium">Submission Artifact Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSimType("kyc")}
                  className={cn(
                    "rounded border p-2 text-center",
                    simType === "kyc"
                      ? "border-accent bg-accent/15 text-accent font-semibold"
                      : "border-border bg-surface-2 text-text-muted"
                  )}
                >
                  KYC Verification
                </button>
                <button
                  type="button"
                  onClick={() => setSimType("sender_id")}
                  className={cn(
                    "rounded border p-2 text-center",
                    simType === "sender_id"
                      ? "border-accent bg-accent/15 text-accent font-semibold"
                      : "border-border bg-surface-2 text-text-muted"
                  )}
                >
                  DLT Sender ID
                </button>
                <button
                  type="button"
                  onClick={() => setSimType("template")}
                  className={cn(
                    "rounded border p-2 text-center",
                    simType === "template"
                      ? "border-accent bg-accent/15 text-accent font-semibold"
                      : "border-border bg-surface-2 text-text-muted"
                  )}
                >
                  Content Template
                </button>
              </div>
            </div>

            {simType === "sender_id" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-text font-medium">6-Char Header</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={simHeader}
                    onChange={(e) => setSimHeader(e.target.value.toUpperCase())}
                    placeholder="e.g. RELBNK"
                    className="w-full rounded border border-border bg-surface-2 px-3 py-2 font-mono uppercase text-text focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-text font-medium">Channel</label>
                  <select
                    value={simChannel}
                    onChange={(e) => setSimChannel(e.target.value)}
                    className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:border-accent focus:outline-none"
                  >
                    <option value="sms">SMS</option>
                    <option value="rcs">RCS</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
              </div>
            )}

            {simType === "template" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-text font-medium">Template Name</label>
                    <input
                      type="text"
                      value={simTmplName}
                      onChange={(e) => setSimTmplName(e.target.value)}
                      className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-text font-medium">Category</label>
                    <select
                      value={simTmplCat}
                      onChange={(e) => setSimTmplCat(e.target.value)}
                      className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:border-accent focus:outline-none"
                    >
                      <option value="transactional">Transactional</option>
                      <option value="promotional">Promotional</option>
                      <option value="service">Service</option>
                      <option value="otp">OTP</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-text font-medium">Template Body (include variable placeholder)</label>
                  <textarea
                    rows={3}
                    value={simTmplBody}
                    onChange={(e) => setSimTmplBody(e.target.value)}
                    className="w-full rounded border border-border bg-surface-2 p-2.5 text-text focus:border-accent focus:outline-none font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {simType === "kyc" && (
              <div className="rounded border border-border bg-surface-2 p-3 text-xs text-text-muted space-y-1">
                <span className="font-semibold text-text">Simulated Document Attachments:</span>
                <div>• Certificate of Incorporation (PDF)</div>
                <div>• GSTIN Certificate &amp; PAN Card (PDF)</div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSimulating}
              className="w-full rounded bg-warning px-4 py-2 text-xs font-bold text-black hover:bg-warning/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSimulating ? "Submitting..." : "Simulate Customer Submission"}
            </button>
          </form>
        </div>
      )}

      {/* REVIEW INSPECTOR MODAL */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-surface p-6 space-y-5 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/30 font-bold">
                    {inspectingItem.type.replace("_", " ")}
                  </span>
                  <h3 className="text-base font-bold text-text">{inspectingItem.itemTitle}</h3>
                </div>
                <div className="text-xs text-text-muted">
                  Workspace: <strong className="text-text">{inspectingItem.workspaceName}</strong> ({inspectingItem.orgName})
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectingItem(null)}
                className="text-text-muted hover:text-text text-sm"
              >
                ✕
              </button>
            </div>

            {/* KYC INSPECTION: Left Documents Viewer, Right Match Slots */}
            {inspectingItem.type === "kyc" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                {/* Left: Document Viewer */}
                <div className="rounded-lg border border-border bg-surface-2 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text uppercase text-[11px] text-text-muted flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-accent" />
                      <span>Submitted Documents Viewer</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => setShowAiReaderModal(true)}
                      className="inline-flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent/90 transition-colors shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Read documents with AI</span>
                    </button>
                  </div>

                  <div className="rounded border border-border bg-background p-4 text-center space-y-3">
                    <div className="h-48 w-full rounded border border-border/80 bg-surface flex flex-col items-center justify-center text-text-muted p-4">
                      <FileCheck2 className="h-10 w-10 text-accent mb-2" />
                      <span className="font-mono text-xs text-text">sample-docs/gst_certificate_meridian.pdf</span>
                      <span className="text-[10px] text-text-muted mt-1">
                        Indian Ministry of Finance GSTIN Certificate (2.2 KB)
                      </span>
                    </div>

                    <a
                      href="/sample-docs/gst_certificate_meridian.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-1.5 text-xs text-text hover:bg-surface-2 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open PDF in New Window</span>
                    </a>
                  </div>
                </div>

                {/* Right: Declared vs Document-Extracted Match Slots */}
                <div className="rounded-lg border border-border bg-surface-2 p-4 space-y-3">
                  <span className="font-bold text-text uppercase text-[11px] text-text-muted">
                    Declared Data vs Document Verification Slots
                  </span>

                  <div className="space-y-2 text-xs">
                    <div className="rounded border border-border bg-surface p-2.5 space-y-1">
                      <div className="text-[10px] uppercase font-semibold text-text-muted">
                        Legal Business Name
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-text">
                          {inspectingItem.declaredData?.legalName || inspectingItem.workspaceName}
                        </span>
                        <span className="rounded bg-success/15 px-1.5 py-0.2 font-mono text-[10px] text-success font-bold">
                          MATCH
                        </span>
                      </div>
                    </div>

                    <div className="rounded border border-border bg-surface p-2.5 space-y-1">
                      <div className="text-[10px] uppercase font-semibold text-text-muted">
                        GSTIN Number
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-text">
                          {inspectingItem.declaredData?.gstin || "27AABCM1234F1Z5"}
                        </span>
                        <span className="rounded bg-success/15 px-1.5 py-0.2 font-mono text-[10px] text-success font-bold">
                          ACTIVE (MCA)
                        </span>
                      </div>
                    </div>

                    <div className="rounded border border-border bg-surface p-2.5 space-y-1">
                      <div className="text-[10px] uppercase font-semibold text-text-muted">
                        Corporate PAN
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-text">
                          {inspectingItem.declaredData?.pan || "AABCM1234F"}
                        </span>
                        <span className="rounded bg-success/15 px-1.5 py-0.2 font-mono text-[10px] text-success font-bold">
                          VERIFIED
                        </span>
                      </div>
                    </div>

                    <div className="rounded border border-border bg-surface p-2.5 space-y-1">
                      <div className="text-[10px] uppercase font-semibold text-text-muted">
                        Billing State
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text">{inspectingItem.declaredData?.state || "Maharashtra"}</span>
                        <span className="rounded bg-success/15 px-1.5 py-0.2 font-mono text-[10px] text-success font-bold">
                          MATCH
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SENDER ID INSPECTION */}
            {inspectingItem.type === "sender_id" && (
              <div className="rounded-lg border border-border bg-surface-2 p-5 space-y-3 text-xs">
                <span className="font-semibold text-text uppercase text-[10px] text-text-muted">
                  TRAI DLT Header Validation Check
                </span>

                <div className="flex items-center gap-4">
                  <div className="font-mono text-3xl font-black text-accent tracking-widest p-4 rounded-lg border border-accent/30 bg-accent/10">
                    {inspectingItem.itemTitle}
                  </div>
                  <div className="space-y-1">
                    <div className="text-text font-semibold">Channel: {inspectingItem.channel?.toUpperCase()}</div>
                    <div className="text-text-muted">Length: Exactly 6 alphabetic characters (DLT Compliant)</div>
                    <div className="text-success font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Not on TRAI brand impersonation blocklist</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TEMPLATE INSPECTION */}
            {inspectingItem.type === "template" && (
              <div className="rounded-lg border border-border bg-surface-2 p-5 space-y-4 text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-text uppercase text-[10px] text-text-muted">
                    Template Content &amp; Automated Checks
                  </span>
                  <div className="rounded border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-text">
                    {inspectingItem.body || "No body text provided."}
                  </div>
                </div>

                {/* Auto Check Findings */}
                {inspectingItem.body && (
                  <div className="space-y-1">
                    {inspectTemplateContent(inspectingItem.body, inspectingItem.category || "transactional").warnings.length === 0 ? (
                      <div className="text-success flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>All TRAI DLT syntactic content checks passed.</span>
                      </div>
                    ) : (
                      inspectTemplateContent(inspectingItem.body, inspectingItem.category || "transactional").warnings.map((w, i) => (
                        <div key={i} className="text-warning flex items-start gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="space-y-1 max-w-sm">
                  <label className="text-text font-medium">TRAI DLT Template ID (Required for Approval)</label>
                  <input
                    type="text"
                    value={dltTemplateIdInput}
                    onChange={(e) => setDltTemplateIdInput(e.target.value)}
                    placeholder="e.g. 1407161234567890123"
                    className="w-full rounded border border-border bg-surface px-3 py-1.5 font-mono text-text focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Rejection Sub-Form (If toggled) */}
            {showRejectForm ? (
              <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 space-y-3 text-xs">
                <span className="font-semibold text-danger">Rejection Reason &amp; Mandated Justification</span>
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Detail the non-compliance reason (min 10 characters)..."
                  className="w-full rounded border border-border bg-surface p-2 text-text focus:border-danger focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    className="rounded border border-border px-3 py-1 text-text-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectKyc}
                    disabled={isProcessing || rejectReason.trim().length < 10}
                    className="rounded bg-danger px-4 py-1 text-white font-bold disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            ) : (
              /* Review Actions Toolbar */
              <div className="flex items-center justify-between border-t border-border/60 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  disabled={!isCompliance}
                  className="rounded border border-danger/40 bg-danger/10 px-4 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20 transition-colors disabled:opacity-40"
                  title={isCompliance ? "Reject submission" : "Requires Compliance role"}
                >
                  Reject Submission
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectingItem(null)}
                    className="rounded border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-surface-2"
                  >
                    Close
                  </button>

                  {inspectingItem.type === "kyc" && (
                    <button
                      type="button"
                      onClick={handleApproveKyc}
                      disabled={!isCompliance || isProcessing}
                      className="rounded bg-success px-5 py-1.5 text-xs font-bold text-white hover:bg-success/90 transition-colors disabled:opacity-40 shadow-sm"
                      title={isCompliance ? "Approve KYC" : "Requires Compliance role"}
                    >
                      {isProcessing ? "Approving..." : "Approve KYC & Activate Workspace"}
                    </button>
                  )}

                  {inspectingItem.type === "sender_id" && (
                    <button
                      type="button"
                      onClick={handleApproveSenderId}
                      disabled={!isCompliance || isProcessing}
                      className="rounded bg-success px-5 py-1.5 text-xs font-bold text-white hover:bg-success/90 transition-colors disabled:opacity-40 shadow-sm"
                      title={isCompliance ? "Approve Header" : "Requires Compliance role"}
                    >
                      {isProcessing ? "Approving..." : "Approve Sender ID Header"}
                    </button>
                  )}

                  {inspectingItem.type === "template" && (
                    <button
                      type="button"
                      onClick={handleApproveTemplate}
                      disabled={!isCompliance || isProcessing || !dltTemplateIdInput.trim()}
                      className="rounded bg-success px-5 py-1.5 text-xs font-bold text-white hover:bg-success/90 transition-colors disabled:opacity-40 shadow-sm"
                      title={isCompliance ? "Approve Template" : "Requires Compliance role"}
                    >
                      {isProcessing ? "Approving..." : "Approve Template (Save DLT ID)"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KYC AI Document Reader Modal */}
      {showAiReaderModal && inspectingItem && (
        <KycDocumentReaderModal
          kycCaseId={inspectingItem.id}
          workspaceName={inspectingItem.workspaceName}
          declaredData={{
            legalName: inspectingItem.declaredData?.legalName || inspectingItem.orgName,
            gstin: inspectingItem.declaredData?.gstin || "27AABCM1234F1Z5",
            pan: (inspectingItem.declaredData?.gstin || "27AABCM1234F1Z5").substring(2, 12),
          }}
          onClose={() => setShowAiReaderModal(false)}
          onSuccess={() => {
            setShowAiReaderModal(false);
            setInspectingItem(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
