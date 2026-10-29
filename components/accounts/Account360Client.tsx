"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  AlertTriangle,
  CreditCard,
  FileCheck2,
  Clock,
  Sparkles,
  Users,
  ShieldCheck,
  LifeBuoy,
  History,
  Bot,
  ExternalLink,
  ChevronRight,
  Plus,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sliders,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Percent,
  Calendar,
  Layers,
  FileText,
  EyeOff,
  MoreVertical,
  Check,
  RefreshCw,
  PowerOff,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { ActiveUser } from "@/components/layout/RoleContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyText } from "@/components/ui/MoneyText";
import { UsageChart } from "./UsageChart";
import { can } from "@/lib/permissions/can";
import { updateTicketStatusAction, createOrgTaskAction } from "@/app/actions/accounts";
import {
  transitionOrgStatusAction,
  changePlanAction,
  calculatePlanChangeProrationAction,
} from "@/app/actions/lifecycle";
import { createSeatCorrectionRequestAction } from "@/app/actions/plans";
import { PlanPricingManager, SeatReconcileCard } from "./PlanPricingManager";
import { CreditBillingWorkspaceView } from "./CreditBillingWorkspaceView";
import { AuditLogViewer } from "@/components/audit/AuditLogViewer";
import { QBRGeneratorView } from "./QBRGeneratorView";
import { ChurnRiskAndSeatsCard } from "./ChurnRiskAndSeatsCard";
import { ChurnAnalysis, UnusedSeatAnalysis, ChurnRecommendation } from "@/lib/services/churn-seats";
import { PlanCatalogItem } from "@/lib/services/plans";
import { toast } from "@/components/ui/Toaster";
import { cn, formatINR } from "@/lib/utils";

export interface Account360ClientProps {
  data: any; // Comprehensive Account 360 data from getAccount360
  currentUser: ActiveUser;
  availablePlans?: PlanCatalogItem[];
  churn?: ChurnAnalysis;
  seats?: UnusedSeatAnalysis;
  recommendations?: ChurnRecommendation[];
}

export function Account360Client({
  data,
  currentUser,
  availablePlans = [],
  churn,
  seats,
  recommendations = [],
}: Account360ClientProps) {
  const router = useRouter();
  const {
    organization,
    plan,
    ownerAm,
    allInternalUsers,
    health,
    healthNarrative,
    attentionItems,
    stats,
    dailyUsage,
    usageByDateWs,
    workspaces,
    users,
    seatStats,
    pricing,
    invoices,
    walletTransactions,
    creditHistory,
    compliance,
    tickets,
    auditLogs,
    tasks,
    suspensionDetails,
    onboardingChecklist,
  } = data;

  const isSupport = currentUser.role === "support";
  const isFinance = currentUser.role === "finance" || currentUser.role === "finance_head";
  const isAdmin = currentUser.role === "admin";
  const isAccountManager = currentUser.role === "account_manager";
  const isSalesOps = currentUser.role === "sales_ops";

  // Tab State
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Quick Action Dialog States
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState(ownerAm?.id || currentUser.id);
  const [newTaskDueAt, setNewTaskDueAt] = useState("");
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Suspension Modal
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendCategory, setSuspendCategory] = useState<any>("non_payment");
  const [suspendReason, setSuspendReason] = useState("");
  const [isSubmittingSuspend, setIsSubmittingSuspend] = useState(false);

  // Reactivation Modal
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivateReason, setReactivateReason] = useState("");
  const [overrideDues, setOverrideDues] = useState(false);
  const [isSubmittingReactivate, setIsSubmittingReactivate] = useState(false);

  // Offboarding Modal
  const [showOffboardModal, setShowOffboardModal] = useState(false);
  const [offboardReason, setOffboardReason] = useState("");
  const [offboardStep1, setOffboardStep1] = useState(false);
  const [offboardStep2, setOffboardStep2] = useState(false);
  const [offboardStep3, setOffboardStep3] = useState(false);
  const [isSubmittingOffboard, setIsSubmittingOffboard] = useState(false);

  // Plan Change Modal
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [targetPlanId, setTargetPlanId] = useState(organization.planId);
  const [effectiveWhen, setEffectiveWhen] = useState<"immediate" | "next_cycle">("immediate");
  const [planChangeReason, setPlanChangeReason] = useState("");
  const [prorationPreview, setProrationPreview] = useState<any>(null);
  const [isLoadingProration, setIsLoadingProration] = useState(false);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);

  // Updating ticket status state
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [isActivatingGoLive, setIsActivatingGoLive] = useState(false);

  // Permission Checks
  const canManageTickets = can(currentUser.role, "tickets:manage").allowed;
  const canCreateTasks = can(currentUser.role, "tasks:create").allowed;
  const canRequestSuspension = can(currentUser.role, "account:request_suspension").allowed;
  const canRequestCredit = can(currentUser.role, "credit:request_limit_change").allowed;
  const canRequestPlan = can(currentUser.role, "account:request_plan_change").allowed;
  const canOffboard = can(currentUser.role, "account:request_offboarding").allowed;

  // Proration fetcher
  useEffect(() => {
    if (showPlanChangeModal && targetPlanId) {
      setIsLoadingProration(true);
      calculatePlanChangeProrationAction({
        orgId: organization.id,
        targetPlanId,
        effectiveWhen,
      }).then((res) => {
        if (res.success) {
          setProrationPreview(res.data);
        }
        setIsLoadingProration(false);
      });
    }
  }, [showPlanChangeModal, targetPlanId, effectiveWhen, organization.id]);

  // Go-Live activation handler
  const handleGoLiveActivation = async () => {
    try {
      setIsActivatingGoLive(true);
      const res = await transitionOrgStatusAction({
        orgId: organization.id,
        targetStatus: "active",
        reason: "Regulatory verification and onboarding milestones completed. Activated for production traffic.",
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Account Activated",
        description: `${organization.name} is now Live with full gateway access.`,
        variant: "default",
      });
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Activation Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsActivatingGoLive(false);
    }
  };

  const handleUpdateTicket = async (ticketId: string, newStatus: any) => {
    try {
      setUpdatingTicketId(ticketId);
      const res = await updateTicketStatusAction({
        ticketId,
        orgId: organization.id,
        status: newStatus,
        note: `Updated by ${currentUser.name} (${currentUser.role}) via Account 360`,
      });

      if (!res.success) {
        throw new Error(res.error);
      }

      toast({
        title: "Ticket Status Updated",
        description: `Ticket ${ticketId} transitioned to ${newStatus.replace("_", " ")}.`,
        variant: "default",
      });
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      setIsSubmittingTask(true);
      const res = await createOrgTaskAction({
        orgId: organization.id,
        assignedTo: newTaskAssignedTo,
        title: newTaskTitle.trim(),
        dueAt: newTaskDueAt || undefined,
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Task Created",
        description: `Task assigned to ${allInternalUsers.find((u: any) => u.id === newTaskAssignedTo)?.name}.`,
        variant: "default",
      });

      setNewTaskTitle("");
      setNewTaskDueAt("");
      setShowTaskModal(false);
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Task Creation Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleSuspendAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suspendReason.trim().length < 10) {
      toast({
        title: "Reason Required",
        description: "Compliance mandates a justification of at least 10 characters.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmittingSuspend(true);
      const res = await transitionOrgStatusAction({
        orgId: organization.id,
        targetStatus: "suspended",
        suspensionCategory: suspendCategory,
        reason: suspendReason.trim(),
      });

      if (!res.success) throw new Error(res.error);

      if (res.status === "pending") {
        toast({
          title: "Suspension Routed for Secondary Sign-Off",
          description: res.message,
          variant: "default",
        });
      } else {
        toast({
          title: "Account Suspended",
          description: "Account status has been transitioned to suspended.",
          variant: "destructive",
        });
      }

      setShowSuspendModal(false);
      setSuspendReason("");
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingSuspend(false);
    }
  };

  const handleReactivateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reactivateReason.trim().length < 10) {
      toast({
        title: "Reason Required",
        description: "A reactivation reason of at least 10 characters is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmittingReactivate(true);
      const res = await transitionOrgStatusAction({
        orgId: organization.id,
        targetStatus: "active",
        reason: reactivateReason.trim(),
        overrideDues,
      });

      if (!res.success) throw new Error(res.error);

      if (res.status === "pending") {
        toast({
          title: "Reactivation Routed for Secondary Sign-Off",
          description: res.message,
          variant: "default",
        });
      } else {
        toast({
          title: "Account Reactivated",
          description: `${organization.name} has been returned to Active status.`,
          variant: "default",
        });
      }

      setShowReactivateModal(false);
      setReactivateReason("");
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Reactivation Blocked",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReactivate(false);
    }
  };

  const handlePlanChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (planChangeReason.trim().length < 10) {
      toast({
        title: "Reason Required",
        description: "An audit justification of at least 10 characters is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmittingPlan(true);
      const res = await changePlanAction({
        orgId: organization.id,
        targetPlanId,
        effectiveWhen,
        reason: planChangeReason.trim(),
      });

      if (!res.success) throw new Error(res.error);

      if (res.status === "pending") {
        toast({
          title: "Plan Modification Routed for Approval",
          description: res.message,
          variant: "default",
        });
      } else {
        toast({
          title: "Plan Updated",
          description: `Account transitioned to target plan successfully.`,
          variant: "default",
        });
      }

      setShowPlanChangeModal(false);
      setPlanChangeReason("");
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Plan Change Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleOffboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offboardStep1 || !offboardStep2 || !offboardStep3) {
      toast({
        title: "Checklist Incomplete",
        description: "All three offboarding statutory checklist items must be confirmed.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmittingOffboard(true);
      const res = await transitionOrgStatusAction({
        orgId: organization.id,
        targetStatus: "offboarded",
        reason: offboardReason.trim() || "Customer offboarding and final settlement completed.",
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Account Offboarded",
        description: `${organization.name} has been de-provisioned and marked terminal offboarded.`,
        variant: "default",
      });

      setShowOffboardModal(false);
      router.push("/accounts");
    } catch (err: any) {
      toast({
        title: "Offboarding Blocked",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingOffboard(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. SUSPENSION ALERT BANNER (If Suspended) */}
      {organization.status === "suspended" && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-danger flex items-start justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Account Administratively Suspended
              </h4>
              <p className="text-xs text-text leading-relaxed">
                {suspensionDetails?.reason || "Account suspended due to policy or billing non-compliance."}
                {suspensionDetails?.date && (
                  <span className="text-text-muted ml-2 font-mono text-[11px]">
                    (Suspended on{" "}
                    {new Date(suspensionDetails.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    )
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowReactivateModal(true)}
            className="shrink-0 rounded bg-success px-3 py-1.5 text-xs font-bold text-white hover:bg-success/90 transition-colors shadow-sm"
          >
            Reactivate Account
          </button>
        </div>
      )}

      {/* 2. STICKY HEADER */}
      <div className="sticky top-0 z-10 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 bg-background/95 backdrop-blur border-b border-border transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Org Identity & Core Badges */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/accounts"
                className="text-xs text-text-muted hover:text-text transition-colors flex items-center gap-1"
              >
                Accounts <ChevronRight className="h-3 w-3" />
              </Link>
              <h1 className="text-lg font-bold tracking-tight text-text flex items-center gap-2">
                {organization.name}
              </h1>
              <StatusBadge status={organization.status} size="sm" />
              <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-muted border border-border">
                {organization.industry}
              </span>
              <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent font-semibold border border-accent/20">
                {plan?.name || "Enterprise"} Plan
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
              <span className="font-mono text-[11px] text-text-muted/80">{organization.legalName}</span>
              <span>•</span>
              <span>{organization.city}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                Owner AM: <strong className="text-text font-medium">{ownerAm?.name || "Unassigned"}</strong>
              </span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <span>Health:</span>
                <span
                  className={cn(
                    "font-mono font-bold",
                    health.grade === "Healthy"
                      ? "text-success"
                      : health.grade === "At Risk"
                      ? "text-warning"
                      : "text-danger"
                  )}
                >
                  {health.score}/100 ({health.grade})
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Dropdown / Group */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Prepare QBR (AM, Sales Ops, Admin) */}
            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/25 transition-colors shadow-sm"
              title="Generate AI-assisted Quarterly Business Review Brief"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Prepare QBR</span>
            </button>

            {/* Create Task Button */}
            <button
              type="button"
              onClick={() => setShowTaskModal(true)}
              disabled={!canCreateTasks}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={canCreateTasks ? "Assign task" : "Requires Account Manager or Sales Ops"}
            >
              <Plus className="h-3.5 w-3.5 text-accent" />
              <span>Create Task</span>
            </button>

            {/* Change Plan Button */}
            <button
              type="button"
              onClick={() => setShowPlanChangeModal(true)}
              disabled={!canRequestPlan}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={canRequestPlan ? "Request custom pricing or plan tier" : "Requires Account Manager or Sales Ops"}
            >
              <Sliders className="h-3.5 w-3.5 text-text-muted" />
              <span>Change Plan</span>
            </button>

            {/* Change Credit (Finance only) */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("billing");
                toast({
                  title: "Credit Management",
                  description: "Switched to Credit & Billing tab to adjust limits.",
                });
              }}
              disabled={!canRequestCredit}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={canRequestCredit ? "Adjust credit line" : "Requires Finance or Finance Head"}
            >
              <CreditCard className="h-3.5 w-3.5 text-text-muted" />
              <span>Credit Limit</span>
            </button>

            {/* Suspend Account Button */}
            {organization.status !== "suspended" && organization.status !== "offboarded" && (
              <button
                type="button"
                onClick={() => setShowSuspendModal(true)}
                disabled={!canRequestSuspension}
                className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={canRequestSuspension ? "Initiate account suspension" : "Insufficient permissions"}
              >
                <span>Suspend</span>
              </button>
            )}

            {/* Offboard Account Button (Admin only) */}
            {organization.status !== "offboarded" && (
              <button
                type="button"
                onClick={() => setShowOffboardModal(true)}
                disabled={!canOffboard}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-danger hover:border-danger/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={canOffboard ? "Initiate customer offboarding" : "Requires Platform Admin"}
              >
                <PowerOff className="h-3.5 w-3.5 text-text-muted" />
                <span className="hidden sm:inline">Offboard</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. TABS NAVIGATION */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-border mt-3 pt-2">
          {[
            { id: "overview", label: "Overview", icon: Building2 },
            { id: "workspaces", label: `Workspaces (${workspaces.length})`, icon: Layers },
            { id: "users", label: `Users & Seats (${users.length})`, icon: Users },
            { id: "pricing", label: "Plan & Pricing", icon: Sliders },
            { id: "billing", label: "Credit & Billing", icon: CreditCard },
            { id: "compliance", label: `Compliance (${compliance.kycCases.length + compliance.senderIds.length})`, icon: ShieldCheck },
            { id: "tickets", label: `Tickets (${tickets.length})`, icon: LifeBuoy },
            { id: "activity", label: `Activity & Tasks (${tasks.length})`, icon: History },
            { id: "ai", label: "AI Insights", icon: Bot, badge: "AI" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-surface-2 text-text border border-border font-semibold shadow-sm"
                    : "text-text-muted hover:text-text hover:bg-surface-2/60"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-accent" : "text-text-muted")} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="rounded bg-accent/20 px-1 py-0.2 font-mono text-[9px] font-bold text-accent">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. TAB CONTENTS */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* ONBOARDING CHECKLIST (Displayed for Onboarding or Incomplete Onboarding) */}
          {onboardingChecklist && (organization.status === "onboarding" || !onboardingChecklist.allCompleted) && (
            <div className="rounded-lg border border-accent/40 bg-surface p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                      Customer Onboarding Checklist ({onboardingChecklist.completionPct}% Complete)
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted">
                    Mandatory operational milestones for production traffic activation
                  </p>
                </div>

                {organization.status === "onboarding" && (
                  <button
                    type="button"
                    onClick={handleGoLiveActivation}
                    disabled={!onboardingChecklist.canGoLive || isActivatingGoLive}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition-all shadow-sm",
                      onboardingChecklist.canGoLive
                        ? "bg-success text-white hover:bg-success/90 shadow-success-glow cursor-pointer"
                        : "bg-surface-2 text-text-muted/60 border border-border cursor-not-allowed"
                    )}
                    title={
                      onboardingChecklist.canGoLive
                        ? "Activate production access"
                        : "Requires approved KYC, Sender ID, and Template"
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{isActivatingGoLive ? "Activating..." : "Activate Go-Live"}</span>
                  </button>
                )}
              </div>

              {/* Steps Progress Bar */}
              <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden border border-border/50">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${Math.max(5, onboardingChecklist.completionPct)}%` }}
                />
              </div>

              {/* 9 Checklist Steps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                {onboardingChecklist.steps.map((st: any, idx: number) => {
                  const isDone = st.status === "completed";
                  const isInProg = st.status === "in_progress";
                  return (
                    <div
                      key={st.id}
                      className={cn(
                        "rounded-md border p-3 flex flex-col justify-between text-xs space-y-2 transition-colors",
                        isDone
                          ? "border-success/30 bg-success/[0.04]"
                          : isInProg
                          ? "border-warning/30 bg-warning/[0.04]"
                          : "border-border bg-surface-2/40"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-text-muted">
                            Step {idx + 1}
                          </span>
                          <span className="rounded bg-surface px-1.5 py-0.2 font-mono text-[9px] text-text-muted border border-border">
                            {st.ownerRole}
                          </span>
                        </div>
                        <div className="font-semibold text-text flex items-center gap-1.5">
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                          ) : isInProg ? (
                            <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                          ) : (
                            <span className="h-3.5 w-3.5 rounded-full border border-text-muted/40 shrink-0" />
                          )}
                          <span>{st.title}</span>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed">
                          {st.description}
                        </p>
                      </div>

                      {st.deepLink && (
                        <button
                          type="button"
                          onClick={() => setActiveTab(st.deepLink)}
                          className="inline-flex items-center gap-1 text-[11px] text-accent font-medium hover:underline pt-1"
                        >
                          <span>Open {st.deepLink} tab</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attention Needed Panel */}
          {attentionItems.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text">
                    Attention Needed ({attentionItems.length})
                  </h3>
                </div>
                <span className="text-[11px] text-text-muted">
                  Operational and risk anomalies requiring team intervention
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {attentionItems.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface-2 p-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-text">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            item.severity === "critical"
                              ? "bg-danger"
                              : item.severity === "warning"
                              ? "bg-warning"
                              : "bg-accent"
                          )}
                        />
                        <span>{item.title}</span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab(item.deepLinkTab)}
                      className="shrink-0 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-medium text-text hover:bg-surface hover:text-accent transition-colors"
                    >
                      <span>{item.actionLabel}</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 30d Volume */}
            <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>30-Day Messages</span>
                <span className="font-mono text-success text-[11px]">{stats.avgDeliveryPct}% Delv</span>
              </div>
              <div className="font-mono text-xl font-bold text-text">
                {stats.totalMessages30d.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-text-muted">
                SMS, RCS, &amp; WhatsApp aggregate
              </div>
            </div>

            {/* 30d Spend */}
            <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>30-Day Spend</span>
                <span className="text-[10px] text-text-muted font-mono">Billed traffic</span>
              </div>
              <div className="font-mono text-xl font-bold text-text">
                {formatINR(stats.totalSpend30d)}
              </div>
              <div className="text-[11px] text-text-muted">
                Across {stats.totalWorkspacesCount} workspace(s)
              </div>
            </div>

            {/* Credit / Wallet Position (Masked for Support) */}
            <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{organization.billingModel === "postpaid" ? "Credit Position" : "Wallet Balance"}</span>
                {isSupport && <EyeOff className="h-3 w-3 text-text-muted" />}
              </div>
              {isSupport ? (
                <div className="text-sm font-mono text-text-muted italic pt-1">
                  Hidden for Support role
                </div>
              ) : organization.billingModel === "postpaid" ? (
                <>
                  <div className="font-mono text-xl font-bold text-text">
                    <MoneyText amount={stats.totalCreditUsed} compact />
                    <span className="text-xs text-text-muted font-normal">
                      {" "}
                      / <MoneyText amount={stats.totalCreditLimit} compact />
                    </span>
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {stats.totalCreditLimit > 0
                      ? `${Math.round((stats.totalCreditUsed / stats.totalCreditLimit) * 100)}% utilized`
                      : "No limit assigned"}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-mono text-xl font-bold text-text">
                    <MoneyText amount={stats.totalWalletBalance} />
                  </div>
                  <div className="text-[11px] text-text-muted">Prepaid balance available</div>
                </>
              )}
            </div>

            {/* Active Seats & Waste */}
            <div className="rounded-lg border border-border bg-surface p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Seats &amp; Licenses</span>
                {seatStats.hasSeatWaste && (
                  <span className="rounded bg-warning/15 px-1 font-mono text-[9px] text-warning font-semibold">
                    Waste Flagged
                  </span>
                )}
              </div>
              <div className="font-mono text-xl font-bold text-text">
                {stats.activeSeats} <span className="text-xs text-text-muted font-normal">/ {stats.totalPaidSeats} active</span>
              </div>
              <div className="text-[11px] text-text-muted">
                {seatStats.inactiveSeats > 0
                  ? `${seatStats.inactiveSeats} inactive seats (₹${(stats.wastedSeatCostMonthly).toLocaleString("en-IN")}/mo waste)`
                  : "100% active seat utilization"}
              </div>
            </div>
          </div>

          {/* Health Score Breakdown Card with "Why this score" Narrative */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-lg border border-border bg-surface p-5 space-y-4 lg:col-span-1">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
                  Health Score Model
                </h3>
                <span
                  className={cn(
                    "rounded px-2 py-0.5 font-mono text-xs font-bold",
                    health.grade === "Healthy"
                      ? "bg-success/15 text-success border border-success/30"
                      : health.grade === "At Risk"
                      ? "bg-warning/15 text-warning border border-warning/30"
                      : "bg-danger/15 text-danger border border-danger/30"
                  )}
                >
                  {health.score}/100 • {health.grade}
                </span>
              </div>

              {/* Breakdown Bars */}
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between text-text mb-1">
                    <span className="text-text-muted">Usage Trend</span>
                    <span className="font-mono font-semibold">{health.breakdown.usageTrendScore}/30</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden border border-border/50">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(health.breakdown.usageTrendScore / 30) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-text mb-1">
                    <span className="text-text-muted">Payment Behaviour</span>
                    <span className="font-mono font-semibold">{health.breakdown.paymentScore}/25</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden border border-border/50">
                    <div
                      className="h-full rounded-full bg-[#3FB68B]"
                      style={{ width: `${(health.breakdown.paymentScore / 25) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-text mb-1">
                    <span className="text-text-muted">Seat Utilization</span>
                    <span className="font-mono font-semibold">{health.breakdown.seatScore}/15</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden border border-border/50">
                    <div
                      className="h-full rounded-full bg-[#5B9DFF]"
                      style={{ width: `${(health.breakdown.seatScore / 15) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-text mb-1">
                    <span className="text-text-muted">Ticket Load</span>
                    <span className="font-mono font-semibold">{health.breakdown.ticketScore}/15</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden border border-border/50">
                    <div
                      className="h-full rounded-full bg-[#E0A93B]"
                      style={{ width: `${(health.breakdown.ticketScore / 15) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-text mb-1">
                    <span className="text-text-muted">Compliance &amp; Status</span>
                    <span className="font-mono font-semibold">{health.breakdown.complianceScore}/15</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden border border-border/50">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(health.breakdown.complianceScore / 15) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Plain English "Why this score" Narrative */}
              <div className="pt-2 border-t border-border/60 space-y-2">
                <span className="text-[11px] font-semibold text-text uppercase tracking-wider">
                  Why this score
                </span>
                <ul className="space-y-1.5 text-[11px] text-text-muted leading-relaxed">
                  {healthNarrative.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-accent mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Omnichannel Usage Chart (90 days, SMS/RCS/WA, stacked, 7/30/90d toggles) */}
            <div className="lg:col-span-2">
              <UsageChart
                dailyTotals={dailyUsage}
                workspaceUsage={usageByDateWs}
                workspaces={workspaces.map((w: any) => ({ id: w.id, name: w.name }))}
              />
            </div>
          </div>

          {/* FEATURE 4: Churn Risk & Unused Seat Analysis */}
          {churn && seats && (
            <div className="pt-2">
              <ChurnRiskAndSeatsCard
                churn={churn}
                seats={seats}
                recommendations={recommendations}
                orgId={organization.id}
                onOpenSeatReductionModal={() => setShowPlanChangeModal(true)}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WORKSPACES */}
      {activeTab === "workspaces" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              Workspaces ({workspaces.length})
            </h3>
            <span className="text-xs text-text-muted">
              Individual billing and regulatory GST entities under {organization.name}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws: any) => (
              <div
                key={ws.id}
                className="rounded-lg border border-border bg-surface p-4 space-y-3 hover:border-accent/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-text">{ws.name}</h4>
                    <span className="font-mono text-[10px] text-text-muted">{ws.id}</span>
                  </div>
                  <StatusBadge status={ws.status} size="sm" />
                </div>

                <div className="rounded border border-border bg-surface-2 p-2.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-text-muted">
                    <span>GSTIN:</span>
                    <span className="font-mono text-text font-medium">{ws.gstin}</span>
                  </div>
                  <div className="flex items-center justify-between text-text-muted">
                    <span>State:</span>
                    <span className="text-text font-medium">{ws.billingState}</span>
                  </div>
                </div>

                {/* Financial Position */}
                {!isSupport && (
                  <div className="space-y-1 text-xs">
                    {ws.creditLimit > 0 ? (
                      <div>
                        <div className="flex items-center justify-between text-text-muted text-[11px]">
                          <span>Credit Used:</span>
                          <span className="font-mono text-text">
                            {formatINR(ws.creditUsed)} / {formatINR(ws.creditLimit)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden border border-border/50 mt-1">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              (ws.creditUsed / ws.creditLimit) >= 0.9
                                ? "bg-danger"
                                : (ws.creditUsed / ws.creditLimit) >= 0.75
                                ? "bg-warning"
                                : "bg-success"
                            )}
                            style={{
                              width: `${Math.min(100, Math.round((ws.creditUsed / ws.creditLimit) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-text-muted">
                        <span>Prepaid Wallet:</span>
                        <span className="font-mono font-semibold text-text">
                          {formatINR(ws.walletBalance)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Operational Counts */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center text-xs">
                  <div className="rounded bg-surface-2 p-1.5">
                    <span className="text-[10px] text-text-muted uppercase">Users</span>
                    <div className="font-mono font-semibold text-text">{ws.usersCount}</div>
                  </div>
                  <div className="rounded bg-surface-2 p-1.5">
                    <span className="text-[10px] text-text-muted uppercase">Headers</span>
                    <div className="font-mono font-semibold text-text">{ws.senderIdsCount}</div>
                  </div>
                  <div className="rounded bg-surface-2 p-1.5">
                    <span className="text-[10px] text-text-muted uppercase">Templates</span>
                    <div className="font-mono font-semibold text-text">{ws.templatesCount}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: USERS AND SEATS */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* SEAT RECONCILIATION CARD (Single Source of Truth) */}
          <SeatReconcileCard
            recon={{
              seatsBilled: seatStats.totalPaidSeats,
              seatsProvisioned: users.filter((u: any) => u.seatActive).length,
              seatsActive: seatStats.activeSeats,
              seatWasteCount: seatStats.inactiveSeats,
              seatWasteMonthlyINR: stats.wastedSeatCostMonthly,
              mismatchDetected: seatStats.totalPaidSeats !== users.filter((u: any) => u.seatActive).length,
              mismatchType:
                users.filter((u: any) => u.seatActive).length > seatStats.totalPaidSeats
                  ? "over_provisioned"
                  : users.filter((u: any) => u.seatActive).length < seatStats.totalPaidSeats
                  ? "under_utilized"
                  : "in_sync",
              mismatchMessage:
                users.filter((u: any) => u.seatActive).length > seatStats.totalPaidSeats
                  ? `Revenue Leakage: ${users.filter((u: any) => u.seatActive).length} users provisioned, but only ${seatStats.totalPaidSeats} seats billed.`
                  : users.filter((u: any) => u.seatActive).length < seatStats.totalPaidSeats
                  ? `Under-utilized: ${seatStats.totalPaidSeats - users.filter((u: any) => u.seatActive).length} paid license(s) unassigned (${seatStats.inactiveSeats} inactive).`
                  : "Seats billed match seats provisioned.",
            }}
            onTrueUp={async () => {
              if (workspaces[0]) {
                const res = await createSeatCorrectionRequestAction({
                  workspaceId: workspaces[0].id,
                  actionType: "true_up_billing",
                  reason: "One-click seat true-up requested from Users tab.",
                });
                if (res.success) {
                  toast({ title: "Seat Correction Applied", description: res.data?.message });
                  router.refresh();
                } else {
                  toast({ title: "Correction Failed", description: res.error, variant: "destructive" });
                }
              }
            }}
            onDeprovision={async () => {
              if (workspaces[0]) {
                const res = await createSeatCorrectionRequestAction({
                  workspaceId: workspaces[0].id,
                  actionType: "deprovision_inactive",
                  reason: "De-provisioning request submitted from Users tab.",
                });
                if (res.success) {
                  toast({ title: "Deprovisioning Task Logged", description: res.data?.message });
                }
              }
            }}
          />

          <div className="rounded-lg border border-border bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
                Seat Allocation &amp; License Utilization
              </h3>
              <p className="text-xs text-text-muted">
                Relay seats cost ₹1,500/seat/month. Inactive licenses (&gt;45 days without login) are flagged for deprovisioning.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded border border-border bg-surface-2 px-3 py-2 text-center">
                <span className="text-[10px] text-text-muted uppercase font-semibold">Paid Seats</span>
                <div className="font-mono text-sm font-bold text-text">{seatStats.totalPaidSeats}</div>
              </div>
              <div className="rounded border border-border bg-surface-2 px-3 py-2 text-center">
                <span className="text-[10px] text-text-muted uppercase font-semibold">Active</span>
                <div className="font-mono text-sm font-bold text-success">{seatStats.activeSeats}</div>
              </div>
              <div className="rounded border border-border bg-surface-2 px-3 py-2 text-center">
                <span className="text-[10px] text-text-muted uppercase font-semibold">Inactive (45d+)</span>
                <div className="font-mono text-sm font-bold text-warning">{seatStats.inactiveSeats}</div>
              </div>
              <div className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-center text-danger">
                <span className="text-[10px] uppercase font-semibold">Monthly Waste</span>
                <div className="font-mono text-sm font-bold">
                  {formatINR(stats.wastedSeatCostMonthly)}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Workspace</th>
                    <th className="py-2.5 px-3">Tier / Role</th>
                    <th className="py-2.5 px-3">Last Login</th>
                    <th className="py-2.5 px-3">Seat Status</th>
                    <th className="py-2.5 px-3">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-text">{u.name}</span>
                          <span className="font-mono text-[11px] text-text-muted">{u.email}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-text-muted">{u.workspaceName}</td>
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase text-text border border-border">
                          {u.tier} {u.customRoleName ? `(${u.customRoleName})` : ""}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-text-muted">
                        {u.lastLoginAt ? (
                          new Date(u.lastLoginAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        ) : (
                          <span className="text-warning">Never</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase font-semibold",
                            u.seatActive
                              ? "bg-success/15 text-success border border-success/30"
                              : "bg-surface-2 text-text-muted border border-border"
                          )}
                        >
                          {u.seatActive ? "Active" : "Deprovisioned"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {u.isInactive45Days && u.seatActive && (
                          <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] text-warning border border-warning/30 font-semibold">
                            <Clock className="h-3 w-3" />
                            <span>Inactive 45+ days</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PLAN & PRICING */}
      {activeTab === "pricing" && (
        <PlanPricingManager
          orgId={organization.id}
          workspaces={workspaces.map((w: any) => ({
            id: w.id,
            name: w.name,
            billingModel: w.billingModel || organization.billingModel,
          }))}
          availablePlans={availablePlans}
          defaultWorkspaceId={workspaces[0]?.id}
        />
      )}

      {/* TAB 5: CREDIT & BILLING */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {isSupport ? (
            <div className="rounded-lg border border-border bg-surface p-12 text-center max-w-md mx-auto space-y-3">
              <EyeOff className="mx-auto h-8 w-8 text-text-muted" />
              <h3 className="text-sm font-semibold text-text">Financial Details Restricted</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Support agents cannot view bank-level invoice internals, wallet top-ups, or credit limits.
                Switch to a <strong>Finance</strong> or <strong>Admin</strong> persona using the top-bar role selector.
              </p>
            </div>
          ) : (
            <CreditBillingWorkspaceView
              orgId={organization.id}
              workspaces={workspaces.map((w: any) => ({
                id: w.id,
                name: w.name,
                billingModel: w.billingModel || organization.billingModel,
                billingState: w.billingState,
              }))}
              defaultWorkspaceId={workspaces[0]?.id}
            />
          )}
        </div>
      )}

      {/* TAB 6: COMPLIANCE */}
      {activeTab === "compliance" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              KYC Verifications ({compliance.kycCases.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {compliance.kycCases.map((k: any) => (
                <div key={k.id} className="rounded-lg border border-border bg-surface p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="font-mono text-xs font-semibold text-text">{k.id}</span>
                    <StatusBadge status={k.status} size="sm" />
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="flex items-center justify-between text-text-muted">
                      <span>Declared GSTIN:</span>
                      <span className="font-mono text-text">{k.declaredDataObj?.gstin || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-between text-text-muted">
                      <span>Declared PAN:</span>
                      <span className="font-mono text-text">{k.declaredDataObj?.pan || "N/A"}</span>
                    </div>
                  </div>

                  {k.documentsList.length > 0 && (
                    <div className="pt-2 border-t border-border/60">
                      <span className="text-[10px] uppercase font-semibold text-text-muted">
                        Verified Documents ({k.documentsList.length})
                      </span>
                      <div className="mt-1 space-y-1 text-xs">
                        {k.documentsList.map((doc: any, idx: number) => (
                          <div
                            key={idx}
                            className="rounded bg-surface-2 p-1.5 flex items-center justify-between text-[11px]"
                          >
                            <span className="truncate max-w-[200px] text-text font-medium">
                              {doc.filename || doc.type}
                            </span>
                            <span className="font-mono text-success text-[10px]">VERIFIED</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              TRAI DLT Registered Sender IDs ({compliance.senderIds.length})
            </h3>
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="py-2 px-3">Header (6-Char)</th>
                    <th className="py-2 px-3">Channel</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">SLA Waiting Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {compliance.senderIds.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-text-muted">
                        No sender IDs registered.
                      </td>
                    </tr>
                  ) : (
                    compliance.senderIds.map((s: any) => (
                      <tr key={s.id}>
                        <td className="py-2.5 px-3 font-mono font-bold text-accent text-sm">
                          {s.header}
                        </td>
                        <td className="py-2.5 px-3 uppercase font-mono text-[11px] text-text">
                          {s.channel}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={s.status} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs">
                          {s.status === "approved" ? (
                            <span className="text-success">Approved</span>
                          ) : (
                            <span className={cn(s.daysWaiting >= 3 ? "text-danger font-bold" : "text-text-muted")}>
                              Waiting {s.daysWaiting} days
                            </span>
                          )}
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

      {/* TAB 7: TICKETS */}
      {activeTab === "tickets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              Support &amp; Operations Tickets ({tickets.length})
            </h3>
            {canManageTickets && (
              <span className="text-[11px] text-accent font-medium">
                Support Reps can change ticket statuses inline below
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase text-text-muted">
                <tr>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                  {canManageTickets && <th className="py-2.5 px-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-text-muted">
                      <LifeBuoy className="mx-auto h-8 w-8 text-text-muted/40 mb-2" />
                      <p className="text-sm font-medium text-text">Zero Support Inquiries</p>
                      <p className="text-xs text-text-muted mt-1">
                        This customer has no active support tickets or operational disputes logged.
                      </p>
                    </td>
                  </tr>
                ) : (
                  tickets.map((t: any) => (
                    <tr key={t.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-text">{t.subject}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-text-muted">
                        {t.category}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase font-bold",
                            t.priority === "urgent"
                              ? "bg-danger/15 text-danger border border-danger/30"
                              : t.priority === "high"
                              ? "bg-warning/15 text-warning border border-warning/30"
                              : "bg-surface-2 text-text-muted border border-border"
                          )}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={t.status} size="sm" />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-text-muted">
                        {t.createdAt ? (
                          new Date(t.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        ) : (
                          "—"
                        )}
                      </td>
                      {canManageTickets && (
                        <td className="py-2.5 px-3 text-right">
                          <select
                            disabled={updatingTicketId === t.id}
                            value={t.status}
                            onChange={(e) => handleUpdateTicket(t.id, e.target.value)}
                            className="rounded border border-border bg-surface-2 px-2 py-1 text-[11px] text-text focus:border-accent focus:outline-none"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="waiting_on_customer">Waiting on Customer</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: ACTIVITY & AUDIT */}
      {activeTab === "activity" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
                Assigned Operational Tasks ({tasks.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowTaskModal(true)}
                disabled={!canCreateTasks}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2.5 py-1 text-xs text-text hover:bg-surface-2 transition-colors disabled:opacity-40"
              >
                <Plus className="h-3 w-3 text-accent" />
                <span>Add Task</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tasks.length === 0 ? (
                <div className="col-span-2 rounded border border-border bg-surface p-6 text-center text-xs text-text-muted">
                  No pending tasks for this account.
                </div>
              ) : (
                tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="rounded-md border border-border bg-surface p-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-text">{task.title}</div>
                      <div className="flex items-center gap-2 text-[10px] text-text-muted">
                        <span>Assigned to: {allInternalUsers.find((u: any) => u.id === task.assignedTo)?.name || task.assignedTo}</span>
                        {task.dueAt && (
                          <span>
                            • Due: {new Date(task.dueAt).toLocaleDateString("en-IN")}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={task.status} size="sm" />
                  </div>
                ))
              )}
            </div>
          </div>

          <AuditLogViewer
            initialLogs={auditLogs}
            orgId={organization.id}
            title="Account Audit Trail & Tamper-Evident History"
            subtitle="Cryptographically verified immutable sequence of operational and financial actions executed on this organization."
            compact={true}
          />
        </div>
      )}

      {/* TAB 9: AI INSIGHTS & QBR PREP */}
      {activeTab === "ai" && (
        <QBRGeneratorView orgId={organization.id} orgName={organization.name} />
      )}

      {/* PLAN CHANGE MODAL */}
      {showPlanChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h3 className="text-sm font-semibold text-text">Modify Commercial Plan Tier</h3>
              <button
                type="button"
                onClick={() => setShowPlanChangeModal(false)}
                className="text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePlanChangeSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-text font-medium">Target Plan Tier</label>
                <select
                  value={targetPlanId}
                  onChange={(e) => setTargetPlanId(e.target.value)}
                  className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:border-accent focus:outline-none"
                >
                  <option value="plan_starter">Starter (₹5,000/mo, 3 seats, 30 MPS)</option>
                  <option value="plan_growth">Growth (₹25,000/mo, 8 seats, 100 MPS)</option>
                  <option value="plan_scale">Scale (₹75,000/mo, 20 seats, 350 MPS)</option>
                  <option value="plan_enterprise">Enterprise (₹1,50,000/mo, 50 seats, 1000 MPS)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-text font-medium">Effective Date</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEffectiveWhen("immediate")}
                    className={cn(
                      "rounded border p-2 text-center",
                      effectiveWhen === "immediate"
                        ? "border-accent bg-accent/10 text-accent font-semibold"
                        : "border-border bg-surface-2 text-text-muted"
                    )}
                  >
                    Immediate (Prorated)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEffectiveWhen("next_cycle")}
                    className={cn(
                      "rounded border p-2 text-center",
                      effectiveWhen === "next_cycle"
                        ? "border-accent bg-accent/10 text-accent font-semibold"
                        : "border-border bg-surface-2 text-text-muted"
                    )}
                  >
                    Next Billing Cycle
                  </button>
                </div>
              </div>

              {/* Proration Preview Box */}
              {prorationPreview && (
                <div className="rounded border border-border bg-surface-2 p-3 space-y-2">
                  <span className="font-semibold text-text uppercase text-[10px] text-text-muted">
                    Proration &amp; Capacity Impact
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Proration Delta:</span>
                    <span className="font-mono font-bold text-text">
                      {prorationPreview.prorationAmount >= 0 ? "+" : ""}
                      {formatINR(prorationPreview.prorationAmount)}
                    </span>
                  </div>

                  {prorationPreview.warnings?.map((w: string, i: number) => (
                    <div key={i} className="text-[11px] text-warning flex items-start gap-1.5 pt-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-text font-medium">
                  Modification Reason (min 10 characters)
                </label>
                <textarea
                  rows={2}
                  required
                  value={planChangeReason}
                  onChange={(e) => setPlanChangeReason(e.target.value)}
                  placeholder="e.g. Account expanding traffic into Diwali season"
                  className="w-full rounded border border-border bg-surface-2 p-2 text-text focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowPlanChangeModal(false)}
                  className="rounded border border-border px-3 py-1.5 text-text-muted hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPlan || planChangeReason.trim().length < 10}
                  className="rounded bg-accent px-4 py-1.5 font-bold text-white hover:bg-accent/90 disabled:opacity-50"
                >
                  {isSubmittingPlan ? "Submitting..." : "Apply Plan Change"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REACTIVATION MODAL */}
      {showReactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-success/40 bg-surface p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h3 className="text-sm font-semibold text-success">Reactivate Organization</h3>
              <button
                type="button"
                onClick={() => setShowReactivateModal(false)}
                className="text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Reactivating will re-enable message routing and API tokens across all workspaces under {organization.name}. If suspended for non-payment, any overdue invoices must be settled unless Finance Head overrides.
            </p>

            <form onSubmit={handleReactivateAccount} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-text font-medium">Reactivation Reason (min 10 chars)</label>
                <textarea
                  rows={2}
                  required
                  value={reactivateReason}
                  onChange={(e) => setReactivateReason(e.target.value)}
                  placeholder="Detail the resolution or clearance..."
                  className="w-full rounded border border-border bg-surface-2 p-2 text-text focus:border-success focus:outline-none"
                />
              </div>

              {isFinance && (
                <label className="flex items-center gap-2 text-text cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={overrideDues}
                    onChange={(e) => setOverrideDues(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-0"
                  />
                  <span>Finance Head Override: Allow reactivation despite pending dues</span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowReactivateModal(false)}
                  className="rounded border border-border px-3 py-1.5 text-text-muted hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReactivate || reactivateReason.trim().length < 10}
                  className="rounded bg-success px-4 py-1.5 font-bold text-white hover:bg-success/90 disabled:opacity-50"
                >
                  {isSubmittingReactivate ? "Reactivating..." : "Confirm Reactivation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFBOARDING MODAL (Admin Only) */}
      {showOffboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-lg border border-danger/40 bg-surface p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h3 className="text-sm font-semibold text-danger">Customer Offboarding Pre-Check</h3>
              <button
                type="button"
                onClick={() => setShowOffboardModal(false)}
                className="text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Offboarding is a <strong>terminal</strong> action. All API credentials, templates, and active workspaces will be deactivated.
            </p>

            {/* Pre-Check Balance & Addons Strip */}
            <div className="rounded border border-border bg-surface-2 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-text-muted">
                <span>Outstanding Invoices:</span>
                <span className="font-mono font-semibold text-text">
                  {invoices.filter((i: any) => i.status === "overdue" || i.status === "issued").length} invoices
                </span>
              </div>
              <div className="flex items-center justify-between text-text-muted">
                <span>Prepaid Wallet to Refund:</span>
                <span className="font-mono font-semibold text-text">
                  {formatINR(stats.totalWalletBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-text-muted">
                <span>Active Addons to Cancel:</span>
                <span className="font-mono font-semibold text-text">
                  {pricing.addons.length} active
                </span>
              </div>
              <div className="pt-1 border-t border-border/60 text-[11px] text-text-muted">
                Notice: 7-year MCA &amp; TRAI regulatory tax audit trail will be preserved in cold storage.
              </div>
            </div>

            {/* Statutory Checklist */}
            <form onSubmit={handleOffboardSubmit} className="space-y-3 text-xs">
              <span className="font-semibold text-text uppercase text-[10px] text-text-muted">
                Mandatory Statutory Checklist
              </span>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offboardStep1}
                    onChange={(e) => setOffboardStep1(e.target.checked)}
                    className="rounded border-border text-danger focus:ring-0"
                  />
                  <span>Final billing tax invoice has been generated &amp; issued</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offboardStep2}
                    onChange={(e) => setOffboardStep2(e.target.checked)}
                    className="rounded border-border text-danger focus:ring-0"
                  />
                  <span>Outstanding balances or refundable deposits settled</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offboardStep3}
                    onChange={(e) => setOffboardStep3(e.target.checked)}
                    className="rounded border-border text-danger focus:ring-0"
                  />
                  <span>Customer data export / deletion request formally archived</span>
                </label>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-text font-medium">Offboarding Reason (Optional)</label>
                <input
                  type="text"
                  value={offboardReason}
                  onChange={(e) => setOffboardReason(e.target.value)}
                  placeholder="e.g. Contract ended without renewal"
                  className="w-full rounded border border-border bg-surface-2 p-2 text-text focus:border-danger focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowOffboardModal(false)}
                  className="rounded border border-border px-3 py-1.5 text-text-muted hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOffboard || !offboardStep1 || !offboardStep2 || !offboardStep3}
                  className="rounded bg-danger px-4 py-1.5 font-bold text-white hover:bg-danger/90 disabled:opacity-40"
                >
                  {isSubmittingOffboard ? "Offboarding..." : "Execute Offboarding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h3 className="text-sm font-semibold text-text">Create Account Task</h3>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-text font-medium">Task Description</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Follow up on Q4 festive traffic volume"
                  className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 text-text focus:border-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-text font-medium">Assigned To</label>
                <select
                  value={newTaskAssignedTo}
                  onChange={(e) => setNewTaskAssignedTo(e.target.value)}
                  className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-text focus:border-accent focus:outline-none"
                >
                  {allInternalUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-text font-medium">Due Date (Optional)</label>
                <input
                  type="date"
                  value={newTaskDueAt}
                  onChange={(e) => setNewTaskDueAt(e.target.value)}
                  className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 text-text focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="rounded border border-border px-3 py-1.5 text-text-muted hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTask || !newTaskTitle.trim()}
                  className="rounded bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                >
                  {isSubmittingTask ? "Creating..." : "Save Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUSPEND REASON MODAL */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-danger/40 bg-surface p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h3 className="text-sm font-semibold text-danger">Suspend Organization</h3>
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                className="text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Suspending this organization will halt all message delivery, API tokens, and template submissions across all its workspaces. If this postpaid account has overdue invoices, this will require dual-approval by the Finance Head.
            </p>

            <form onSubmit={handleSuspendAccount} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-text font-medium">Suspension Category</label>
                <select
                  value={suspendCategory}
                  onChange={(e) => setSuspendCategory(e.target.value)}
                  className="w-full rounded border border-border bg-surface-2 p-2 text-text focus:border-danger focus:outline-none"
                >
                  <option value="non_payment">Non-Payment / Overdue Invoices</option>
                  <option value="compliance_violation">TRAI / Regulatory Compliance Violation</option>
                  <option value="fraud_suspicion">Spam / Fraud Suspicion</option>
                  <option value="customer_request">Customer Initiated Request</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-text font-medium">
                  Mandatory Justification (min 10 characters)
                </label>
                <textarea
                  rows={3}
                  required
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Detail the operational reason or payment failure..."
                  className="w-full rounded border border-border bg-surface-2 p-2.5 text-text focus:border-danger focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowSuspendModal(false)}
                  className="rounded border border-border px-3 py-1.5 text-text-muted hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSuspend || suspendReason.trim().length < 10}
                  className="rounded bg-danger px-3 py-1.5 font-medium text-white hover:bg-danger/90 disabled:opacity-50"
                >
                  {isSubmittingSuspend ? "Submitting..." : "Confirm Suspension"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
