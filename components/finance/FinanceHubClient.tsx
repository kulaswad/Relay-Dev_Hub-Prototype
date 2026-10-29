"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";
import { toast } from "@/components/ui/Toaster";
import {
  simulateDayOfUsageAction,
  changeCreditLimitAction,
  logFollowUpActionServer,
} from "@/app/actions/finance";
import { CreditIntelligenceBox } from "./CreditIntelligenceBox";
import {
  CreditCard,
  AlertTriangle,
  Clock,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Play,
  ArrowRight,
  ShieldAlert,
  Sliders,
  DollarSign,
  Send,
  Users,
  CheckCircle2,
  FileText,
  AlertCircle,
  Eye,
} from "lucide-react";

interface FinanceHubClientProps {
  initialData: any;
}

export function FinanceHubClient({ initialData }: FinanceHubClientProps) {
  const { currentRole } = useRole();
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<"watchlist" | "collections" | "prepaid" | "alerts">("watchlist");

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);

  // Quick Action Dialog States
  const [selectedLimitWs, setSelectedLimitWs] = useState<any | null>(null);
  const [newLimitInput, setNewLimitInput] = useState<string>("");
  const [limitReason, setLimitReason] = useState("");
  const [isSubmittingLimit, setIsSubmittingLimit] = useState(false);

  // Follow-up modal
  const [followUpInvoice, setFollowUpInvoice] = useState<any | null>(null);
  const [followUpNote, setFollowUpNote] = useState("");
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

  const canManageMoney =
    currentRole === "finance" || currentRole === "finance_head" || currentRole === "admin";

  const handleSimulateDay = async () => {
    setIsSimulating(true);
    try {
      const res = await simulateDayOfUsageAction();
      if (!res.success) throw new Error(res.error);

      toast({
        title: "Simulation Executed",
        description: `Advanced 1 day of traffic across ${res.data?.workspacesProcessed} workspaces. Spend generated: ₹${res.data?.totalSpendAdded?.toLocaleString("en-IN")}. ${res.data?.alertsGenerated} new proactive alert(s) fired!`,
      });

      // Refresh page data
      window.location.reload();
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

  const handleChangeLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLimitWs) return;
    const limitNum = Number(newLimitInput);
    if (isNaN(limitNum) || limitNum <= 0) {
      toast({ title: "Invalid Limit", description: "Limit must be a positive number.", variant: "destructive" });
      return;
    }
    if (limitReason.trim().length < 10) {
      toast({ title: "Justification Required", description: "Audit reason must be at least 10 characters.", variant: "destructive" });
      return;
    }

    setIsSubmittingLimit(true);
    try {
      const res = await changeCreditLimitAction({
        workspaceId: selectedLimitWs.workspaceId,
        newCreditLimit: limitNum,
        reason: limitReason.trim(),
      });

      if (!res.success) throw new Error(res.error);

      if (res.data?.status === "pending") {
        toast({
          title: "Approval Request Submitted",
          description: `Change Request #${res.data.changeRequestId} routed for Finance Head approval.`,
        });
      } else {
        toast({
          title: "Credit Limit Updated",
          description: `Limit updated to ₹${limitNum.toLocaleString("en-IN")}.`,
        });
      }

      setSelectedLimitWs(null);
      setNewLimitInput("");
      setLimitReason("");
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingLimit(false);
    }
  };

  const handleLogFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpInvoice) return;
    if (followUpNote.trim().length < 5) {
      toast({ title: "Note Required", description: "Please enter a follow-up summary.", variant: "destructive" });
      return;
    }

    setIsSubmittingFollowUp(true);
    try {
      const res = await logFollowUpActionServer({
        invoiceId: followUpInvoice.invoiceId,
        note: followUpNote.trim(),
      });
      if (!res.success) throw new Error(res.error);

      toast({
        title: "Follow-up Logged",
        description: "Task created and assigned to Account Manager.",
      });

      setFollowUpInvoice(null);
      setFollowUpNote("");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const { metrics, aging, creditWatchlist, collectionsList, prepaidAtRisk, recentAlerts } = data;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text">Finance &amp; Credit Hub</h1>
            <span className="rounded-md border border-[#3FB68B]/30 bg-[#3FB68B]/10 px-2 py-0.5 text-[11px] font-mono text-success">
              Live Ledger
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Aggregated postpaid credit utilization, automated collections aging, and proactive runway monitoring.
          </p>
        </div>

        {/* Demo Simulation Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSimulateDay}
            disabled={isSimulating}
            className="inline-flex items-center gap-2 rounded-md border border-[#7C7CFF]/50 bg-[#7C7CFF]/15 px-3 py-1.5 text-xs font-semibold text-[#7C7CFF] hover:bg-[#7C7CFF]/25 transition-all shadow-sm disabled:opacity-50"
            title="Advance 1 day of traffic, simulate message costs, update credit balances, and trigger threshold alerts."
          >
            {isSimulating ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>Simulate a Day of Usage</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <span className="text-[11px] text-text-muted uppercase font-semibold">Postpaid Credit Utilized</span>
          <div className="mt-1 font-mono text-2xl font-bold text-text">
            {formatINR(metrics.totalPostpaidCreditUsed)}
          </div>
          <span className="text-[11px] text-text-muted">Active utilized credit line</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <span className="text-[11px] text-danger uppercase font-semibold">Overdue Receivables</span>
          <div className="mt-1 font-mono text-2xl font-bold text-danger">
            {formatINR(metrics.overdueTotal)}
          </div>
          <span className="text-[11px] text-text-muted">{collectionsList.length} invoices awaiting collection</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <span className="text-[11px] text-warning uppercase font-semibold">Postpaid At Risk (&gt;80%)</span>
          <div className="mt-1 font-mono text-2xl font-bold text-warning">
            {metrics.postpaidAbove80Count}
          </div>
          <span className="text-[11px] text-text-muted">Workspaces near limit breach</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <span className="text-[11px] text-warning uppercase font-semibold">Prepaid Low Runway (&lt;5d)</span>
          <div className="mt-1 font-mono text-2xl font-bold text-warning">
            {metrics.prepaidBelow5DaysCount}
          </div>
          <span className="text-[11px] text-text-muted">Workspaces requiring top-up</span>
        </div>
      </div>

      {/* FEATURE 1: Natural-Language Credit Query & EWMA Forecast */}
      <CreditIntelligenceBox
        onOpenLimitModal={(wsId) => {
          const ws = (creditWatchlist || []).find((w: any) => w.workspaceId === wsId);
          if (ws) {
            setSelectedLimitWs(ws);
            setNewLimitInput(String(ws.creditLimit));
          }
        }}
      />

      {/* Overdue Aging Split Bar */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text">
              Overdue Invoices Aging Schedule
            </h3>
            <p className="text-[11px] text-text-muted">
              Aging brackets calculated from statutory payment due dates.
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-danger">
            Total Overdue: {formatINR(metrics.overdueTotal)}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div className="rounded bg-surface-2 p-3 border border-border">
            <span className="text-[10px] text-text-muted uppercase font-semibold">0 - 15 Days</span>
            <div className="font-mono text-base font-bold text-text mt-1">{formatINR(aging.d0_15.amount)}</div>
            <span className="text-[10px] text-text-muted font-mono">{aging.d0_15.count} invoices</span>
          </div>

          <div className="rounded bg-surface-2 p-3 border border-border">
            <span className="text-[10px] text-warning uppercase font-semibold">16 - 30 Days</span>
            <div className="font-mono text-base font-bold text-warning mt-1">{formatINR(aging.d16_30.amount)}</div>
            <span className="text-[10px] text-text-muted font-mono">{aging.d16_30.count} invoices</span>
          </div>

          <div className="rounded bg-surface-2 p-3 border border-border">
            <span className="text-[10px] text-danger uppercase font-semibold">31 - 60 Days</span>
            <div className="font-mono text-base font-bold text-danger mt-1">{formatINR(aging.d31_60.amount)}</div>
            <span className="text-[10px] text-text-muted font-mono">{aging.d31_60.count} invoices</span>
          </div>

          <div className="rounded bg-danger/10 p-3 border border-danger/30">
            <span className="text-[10px] text-danger uppercase font-bold">60+ Days (Critical)</span>
            <div className="font-mono text-base font-bold text-danger mt-1">{formatINR(aging.d60_plus.amount)}</div>
            <span className="text-[10px] text-danger/80 font-mono">{aging.d60_plus.count} invoices</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-border flex items-center gap-6 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("watchlist")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === "watchlist"
              ? "border-[#7C7CFF] text-[#7C7CFF]"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <span>Credit Watchlist (&ge;70%)</span>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.2 text-[10px] font-mono">
            {creditWatchlist.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("collections")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === "collections"
              ? "border-danger text-danger"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <span>Collections Queue</span>
          <span className="rounded-full bg-danger/20 text-danger px-1.5 py-0.2 text-[10px] font-mono font-bold">
            {collectionsList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("prepaid")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === "prepaid"
              ? "border-warning text-warning"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <span>Prepaid Low Runway (&lt;5d)</span>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.2 text-[10px] font-mono">
            {prepaidAtRisk.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === "alerts"
              ? "border-[#7C7CFF] text-[#7C7CFF]"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <span>Live Alerts &amp; Triggers</span>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.2 text-[10px] font-mono">
            {recentAlerts.length}
          </span>
        </button>
      </div>

      {/* TAB 1: CREDIT WATCHLIST */}
      {activeTab === "watchlist" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Workspaces with credit utilization at or exceeding 70% threshold</span>
            <span className="font-mono">{creditWatchlist.length} workspaces</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-2 text-[10px] uppercase text-text-muted">
                <tr>
                  <th className="py-2.5 px-3">Workspace &amp; Organization</th>
                  <th className="py-2.5 px-3">Credit Limit</th>
                  <th className="py-2.5 px-3">Utilized</th>
                  <th className="py-2.5 px-3">Utilization</th>
                  <th className="py-2.5 px-3">14d EWMA Burn</th>
                  <th className="py-2.5 px-3">Projected Breach</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {creditWatchlist.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-muted italic">
                      No workspaces currently above 70% credit utilization.
                    </td>
                  </tr>
                ) : (
                  creditWatchlist.map((item: any) => (
                    <tr key={item.workspaceId} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-2.5 px-3 font-sans">
                        <Link
                          href={`/accounts/${item.orgId}`}
                          className="font-semibold text-text hover:text-[#7C7CFF] transition-colors"
                        >
                          {item.workspaceName}
                        </Link>
                        <div className="text-[11px] text-text-muted">{item.orgName}</div>
                      </td>
                      <td className="py-2.5 px-3">{formatINR(item.creditLimit)}</td>
                      <td className="py-2.5 px-3 font-bold text-text">{formatINR(item.creditUsed)}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                            item.utilizationPct >= 90
                              ? "bg-danger/20 text-danger"
                              : item.utilizationPct >= 80
                              ? "bg-warning/20 text-warning"
                              : "bg-[#7C7CFF]/20 text-[#7C7CFF]"
                          }`}
                        >
                          {item.utilizationPct}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-text-muted">{formatINR(item.dailyBurnEWMA)}/day</td>
                      <td className="py-2.5 px-3 font-sans text-text">
                        {item.daysRemaining !== null ? (
                          <span className={item.daysRemaining <= 3 ? "text-danger font-bold" : "text-text"}>
                            ~{item.daysRemaining} days ({item.projectedDate ? new Date(item.projectedDate).toLocaleDateString("en-IN") : "—"})
                          </span>
                        ) : (
                          <span className="text-text-muted">Low burn</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLimitWs(item);
                              setNewLimitInput(String(item.creditLimit));
                            }}
                            className="rounded bg-[#7C7CFF] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#6868F7]"
                          >
                            Change Limit
                          </button>
                          <Link
                            href={`/accounts/${item.orgId}`}
                            className="rounded border border-border bg-surface-2 p-1 text-text-muted hover:text-text"
                            title="Open Account 360"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: OVERDUE COLLECTIONS */}
      {activeTab === "collections" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Outstanding invoices past payment terms sorted by aging</span>
            <span className="font-mono text-danger font-bold">{collectionsList.length} overdue</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-2 text-[10px] uppercase text-text-muted">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Organization &amp; Workspace</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3">Overdue Amount</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3">Aging</th>
                  <th className="py-2.5 px-3 text-right">Collections Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {collectionsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-success italic font-sans">
                      Zero overdue invoices across all accounts! Outstanding collections are fully settled.
                    </td>
                  </tr>
                ) : (
                  collectionsList.map((c: any) => (
                    <tr key={c.invoiceId} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-text">#{c.invoiceId}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <Link
                          href={`/accounts/${c.orgId}`}
                          className="font-semibold text-text hover:text-[#7C7CFF]"
                        >
                          {c.orgName}
                        </Link>
                        <div className="text-[11px] text-text-muted">{c.workspaceName}</div>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-text-muted">{c.period}</td>
                      <td className="py-2.5 px-3 font-bold text-danger">{formatINR(c.amount)}</td>
                      <td className="py-2.5 px-3 text-text-muted whitespace-nowrap font-sans">
                        {new Date(c.dueAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-danger/20 text-danger px-1.5 py-0.5 text-[10px] font-bold">
                          {c.daysOverdue} days overdue
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2 font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              setFollowUpInvoice(c);
                              setFollowUpNote("");
                            }}
                            className="rounded bg-accent/20 text-accent px-2.5 py-1 text-[11px] font-semibold hover:bg-accent/30"
                          >
                            Log Follow-up
                          </button>
                          <Link
                            href={`/accounts/${c.orgId}`}
                            className="rounded border border-danger/40 bg-danger/10 text-danger px-2.5 py-1 text-[11px] font-semibold hover:bg-danger/20"
                          >
                            Escalate
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PREPAID LOW RUNWAY */}
      {activeTab === "prepaid" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Prepaid accounts with less than 5 days of message liquidity remaining</span>
            <span className="font-mono">{prepaidAtRisk.length} workspaces</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-2 text-[10px] uppercase text-text-muted">
                <tr>
                  <th className="py-2.5 px-3">Workspace &amp; Organization</th>
                  <th className="py-2.5 px-3">Wallet Balance</th>
                  <th className="py-2.5 px-3">14d Daily Burn</th>
                  <th className="py-2.5 px-3">Days of Cover</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {prepaidAtRisk.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-text-muted italic font-sans">
                      All prepaid workspaces have healthy liquidity runway (&gt;5 days of cover).
                    </td>
                  </tr>
                ) : (
                  prepaidAtRisk.map((p: any) => (
                    <tr key={p.workspaceId} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-2.5 px-3 font-sans">
                        <Link
                          href={`/accounts/${p.orgId}`}
                          className="font-semibold text-text hover:text-[#7C7CFF]"
                        >
                          {p.workspaceName}
                        </Link>
                        <div className="text-[11px] text-text-muted">{p.orgName}</div>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-warning">{formatINR(p.walletBalance)}</td>
                      <td className="py-2.5 px-3 text-text-muted">{formatINR(p.dailyBurnAverage)}/day</td>
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-warning/20 text-warning px-2 py-0.5 font-bold">
                          ~{p.daysOfCover} days
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          href={`/accounts/${p.orgId}`}
                          className="inline-flex items-center gap-1 rounded bg-[#7C7CFF] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#6868F7]"
                        >
                          <span>Manage Wallet</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LIVE ALERTS LOG */}
      {activeTab === "alerts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Automated operational threshold alerts generated by usage events and simulations</span>
            <span className="font-mono">{recentAlerts.length} alerts</span>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-12 text-center text-xs text-text-muted">
              No threshold alerts logged yet. Click "Simulate a Day of Usage" above to test automated detection.
            </div>
          ) : (
            <div className="space-y-2">
              {recentAlerts.map((a: any) => (
                <div
                  key={a.id}
                  className={`rounded-lg border p-3 flex items-start justify-between text-xs transition-colors ${
                    a.severity === "critical"
                      ? "border-danger/40 bg-danger/5"
                      : a.severity === "warning"
                      ? "border-warning/40 bg-warning/5"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {a.severity === "critical" ? (
                      <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text">{a.title}</span>
                        <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[9px] font-mono text-text-muted uppercase">
                          {a.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5">{a.message}</p>
                    </div>
                  </div>

                  <span className="font-mono text-[10px] text-text-muted whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CHANGE LIMIT FROM WATCHLIST */}
      {selectedLimitWs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl p-5 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text">Adjust Credit Limit</h3>
                <p className="text-xs text-text-muted">{selectedLimitWs.workspaceName} ({selectedLimitWs.orgName})</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLimitWs(null)}
                className="text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangeLimit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded bg-surface-2 border border-border">
                <div>
                  <span className="text-[10px] uppercase text-text-muted">Current Limit</span>
                  <div className="font-mono text-sm font-bold text-text">{formatINR(selectedLimitWs.creditLimit)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-text-muted">Current Utilized</span>
                  <div className="font-mono text-sm font-bold text-text">{formatINR(selectedLimitWs.creditUsed)}</div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-text">Proposed Limit (INR)</label>
                <input
                  type="number"
                  value={newLimitInput}
                  onChange={(e) => setNewLimitInput(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-text">
                  Audit Reason <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={2}
                  value={limitReason}
                  onChange={(e) => setLimitReason(e.target.value)}
                  placeholder="e.g., Credit line expansion to support surge broadcast volume."
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-2 text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLimitWs(null)}
                  className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLimit}
                  className="rounded bg-[#7C7CFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6868F7] transition-colors disabled:opacity-40"
                >
                  {isSubmittingLimit ? "Saving..." : "Submit Change"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FOLLOW-UP NOTE FROM COLLECTIONS */}
      {followUpInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl p-5 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text">Log Collections Follow-up</h3>
                <p className="text-xs text-text-muted">
                  Invoice #{followUpInvoice.invoiceId} ({followUpInvoice.orgName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFollowUpInvoice(null)}
                className="text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLogFollowUp} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-medium text-text">Follow-up Summary &amp; Next Action</label>
                <textarea
                  rows={3}
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  placeholder="e.g., Customer finance manager confirmed RTGS settlement scheduled for end of day."
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-2 text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFollowUpInvoice(null)}
                  className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFollowUp}
                  className="rounded bg-[#7C7CFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6868F7] transition-colors disabled:opacity-40"
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
