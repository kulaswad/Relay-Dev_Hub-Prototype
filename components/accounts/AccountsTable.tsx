"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Download,
  Building2,
  AlertTriangle,
  CreditCard,
  FileCheck2,
  Clock,
  Sparkles,
  ArrowUpDown,
  ChevronRight,
  Shield,
  EyeOff,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { AccountListItem } from "@/lib/services/accounts";
import { ActiveUser } from "@/components/layout/RoleContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyText } from "@/components/ui/MoneyText";
import { Sparkline } from "@/components/ui/Sparkline";
import { exportAccountsCsvAction } from "@/app/actions/accounts";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

export interface AccountsTableProps {
  initialAccounts: AccountListItem[];
  currentUser: ActiveUser;
}

type TabView =
  | "all"
  | "at_risk"
  | "credit_watch"
  | "pending_kyc"
  | "overdue"
  | "renewals_60d"
  | "low_wallet";

export function AccountsTable({ initialAccounts, currentUser }: AccountsTableProps) {
  const router = useRouter();
  const isSupport = currentUser.role === "support";
  const isAccountManager = currentUser.role === "account_manager";

  // Tab state
  const [activeTab, setActiveTab] = useState<TabView>("all");

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [billingFilter, setBillingFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [healthBandFilter, setHealthBandFilter] = useState<string>("all");
  const [amFilter, setAmFilter] = useState<string>(isAccountManager ? currentUser.id : "all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState<boolean>(false);

  // Sorting state
  const [sortField, setSortField] = useState<keyof AccountListItem | "healthScore" | "creditUtil">("healthScore");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Tab counts
  const tabCounts = useMemo(() => {
    const now = Date.now();
    const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

    return {
      all: initialAccounts.length,
      at_risk: initialAccounts.filter(
        (a) => a.status === "at_risk" || a.health.grade === "Critical"
      ).length,
      credit_watch: initialAccounts.filter(
        (a) => a.billingModel === "postpaid" && a.financialPosition.utilizationPct >= 80
      ).length,
      pending_kyc: initialAccounts.filter((a) => a.hasPendingKyc).length,
      overdue: initialAccounts.filter((a) => a.financialPosition.hasOverdueInvoice).length,
      renewals_60d: initialAccounts.filter((a) => {
        if (!a.contractEnd) return false;
        const diff = new Date(a.contractEnd).getTime() - now;
        return diff > 0 && diff <= SIXTY_DAYS_MS;
      }).length,
      low_wallet: initialAccounts.filter(
        (a) => a.billingModel === "prepaid" && a.financialPosition.walletBalance < 25000
      ).length,
    };
  }, [initialAccounts]);

  // Unique lists for dropdowns
  const uniqueIndustries = useMemo(() => {
    return Array.from(new Set(initialAccounts.map((a) => a.industry))).sort();
  }, [initialAccounts]);

  const uniquePlans = useMemo(() => {
    return Array.from(new Set(initialAccounts.map((a) => a.planName))).sort();
  }, [initialAccounts]);

  const uniqueAms = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of initialAccounts) {
      if (a.ownerAmId && a.ownerAmName) {
        map.set(a.ownerAmId, a.ownerAmName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [initialAccounts]);

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    const now = Date.now();
    const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

    return initialAccounts.filter((acc) => {
      // 1. Saved View Tabs
      if (activeTab === "at_risk") {
        if (acc.status !== "at_risk" && acc.health.grade !== "Critical") return false;
      } else if (activeTab === "credit_watch") {
        if (acc.billingModel !== "postpaid" || acc.financialPosition.utilizationPct < 80) return false;
      } else if (activeTab === "pending_kyc") {
        if (!acc.hasPendingKyc) return false;
      } else if (activeTab === "overdue") {
        if (!acc.financialPosition.hasOverdueInvoice) return false;
      } else if (activeTab === "renewals_60d") {
        if (!acc.contractEnd) return false;
        const diff = new Date(acc.contractEnd).getTime() - now;
        if (diff <= 0 || diff > SIXTY_DAYS_MS) return false;
      } else if (activeTab === "low_wallet") {
        if (acc.billingModel !== "prepaid" || acc.financialPosition.walletBalance >= 25000) return false;
      }

      // 2. Search query (org name, legal name, workspace name, workspace GSTIN)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesOrg =
          acc.name.toLowerCase().includes(q) ||
          acc.legalName.toLowerCase().includes(q) ||
          acc.city.toLowerCase().includes(q);
        const matchesWs = acc.workspacesSummary.some(
          (w) => w.name.toLowerCase().includes(q) || w.gstin.toLowerCase().includes(q)
        );
        if (!matchesOrg && !matchesWs) return false;
      }

      // 3. Status filter
      if (statusFilter !== "all" && acc.status !== statusFilter) return false;

      // 4. Billing model filter
      if (billingFilter !== "all" && acc.billingModel !== billingFilter) return false;

      // 5. Plan filter
      if (planFilter !== "all" && acc.planName !== planFilter) return false;

      // 6. Health band filter
      if (healthBandFilter !== "all") {
        if (healthBandFilter === "healthy" && acc.health.score < 70) return false;
        if (healthBandFilter === "at_risk" && (acc.health.score < 50 || acc.health.score >= 70)) return false;
        if (healthBandFilter === "critical" && acc.health.score >= 50) return false;
      }

      // 7. AM filter
      if (amFilter !== "all" && acc.ownerAmId !== amFilter) return false;

      // 8. Industry filter
      if (industryFilter !== "all" && acc.industry !== industryFilter) return false;

      // 9. Needs attention smart filter
      if (needsAttentionOnly && !acc.needsAttention) return false;

      return true;
    });
  }, [
    initialAccounts,
    activeTab,
    searchQuery,
    statusFilter,
    billingFilter,
    planFilter,
    healthBandFilter,
    amFilter,
    industryFilter,
    needsAttentionOnly,
  ]);

  // Sorted accounts
  const sortedAccounts = useMemo(() => {
    return [...filteredAccounts].sort((a, b) => {
      let valA: any = a[sortField as keyof AccountListItem];
      let valB: any = b[sortField as keyof AccountListItem];

      if (sortField === "healthScore") {
        valA = a.health.score;
        valB = b.health.score;
      } else if (sortField === "creditUtil") {
        valA = a.financialPosition.utilizationPct;
        valB = b.financialPosition.utilizationPct;
      }

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortAsc ? valA - valB : valB - valA;
    });
  }, [filteredAccounts, sortField, sortAsc]);

  // Paginated accounts
  const totalPages = Math.ceil(sortedAccounts.length / pageSize) || 1;
  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAccounts.slice(start, start + pageSize);
  }, [sortedAccounts, currentPage, pageSize]);

  const handleSort = (field: keyof AccountListItem | "healthScore" | "creditUtil") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setCurrentPage(1);
  };

  // CSV Export
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const res = await exportAccountsCsvAction();
      if (!res.success || !res.csv) {
        throw new Error(res.error || "Failed to generate CSV export");
      }

      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `relay_accounts_export_${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Accounts Export Complete",
        description: `Exported ${filteredAccounts.length} organization records (audit logged).`,
        variant: "default",
      });
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Saved Views as Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-1">
        {[
          { key: "all", label: "All Accounts", count: tabCounts.all },
          { key: "at_risk", label: "At Risk", count: tabCounts.at_risk, danger: true },
          { key: "credit_watch", label: "Credit Watch (≥80%)", count: tabCounts.credit_watch, warning: true },
          { key: "pending_kyc", label: "Pending KYC", count: tabCounts.pending_kyc, info: true },
          { key: "overdue", label: "Overdue Invoices", count: tabCounts.overdue, danger: true },
          { key: "renewals_60d", label: "Renewals in 60d", count: tabCounts.renewals_60d },
          { key: "low_wallet", label: "Low Wallet (< ₹25k)", count: tabCounts.low_wallet, warning: true },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as TabView);
                setCurrentPage(1);
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-t-md px-3 py-2 text-xs font-medium transition-colors border-b-2 whitespace-nowrap",
                isActive
                  ? "border-accent text-text bg-surface-2/40"
                  : "border-transparent text-text-muted hover:text-text hover:bg-surface/50"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                  isActive
                    ? "bg-accent/20 text-accent font-semibold"
                    : "bg-surface-2 text-text-muted"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by Org, Workspace, or GSTIN..."
            className="w-full rounded-md border border-border bg-surface-2 pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
          >
            <option value="all">Status: All</option>
            <option value="active">Active</option>
            <option value="at_risk">At Risk</option>
            <option value="onboarding">Onboarding</option>
            <option value="suspended">Suspended</option>
            <option value="offboarded">Offboarded</option>
          </select>

          {/* Billing Model Filter */}
          <select
            value={billingFilter}
            onChange={(e) => {
              setBillingFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
          >
            <option value="all">Billing: All</option>
            <option value="postpaid">Postpaid (Credit)</option>
            <option value="prepaid">Prepaid (Wallet)</option>
          </select>

          {/* Health Band Filter */}
          <select
            value={healthBandFilter}
            onChange={(e) => {
              setHealthBandFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
          >
            <option value="all">Health: All</option>
            <option value="healthy">Healthy (≥70)</option>
            <option value="at_risk">At Risk (50-69)</option>
            <option value="critical">Critical (&lt;50)</option>
          </select>

          {/* AM Filter */}
          <select
            value={amFilter}
            onChange={(e) => {
              setAmFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={cn(
              "rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none",
              isAccountManager && amFilter === currentUser.id ? "border-accent/50 text-accent font-medium" : ""
            )}
          >
            <option value="all">Account Manager: All</option>
            {isAccountManager && (
              <option value={currentUser.id}>★ My Accounts ({currentUser.name})</option>
            )}
            {uniqueAms.map((am) => (
              <option key={am.id} value={am.id}>
                {am.name}
              </option>
            ))}
          </select>

          {/* Industry Filter */}
          <select
            value={industryFilter}
            onChange={(e) => {
              setIndustryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
          >
            <option value="all">Industry: All</option>
            {uniqueIndustries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>

          {/* "Needs Attention" Smart Toggle */}
          <button
            type="button"
            onClick={() => {
              setNeedsAttentionOnly(!needsAttentionOnly);
              setCurrentPage(1);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              needsAttentionOnly
                ? "border-warning bg-warning/15 text-warning"
                : "border-border bg-surface-2 text-text-muted hover:text-text"
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Needs Attention</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text-muted hover:text-text hover:bg-surface-2/80 transition-colors disabled:opacity-50"
            title="Download CSV report (Action is logged to audit trail)"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b border-border bg-surface-2/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted select-none">
              <tr>
                <th
                  onClick={() => handleSort("name")}
                  className="py-3 px-3 cursor-pointer hover:text-text"
                >
                  <div className="flex items-center gap-1">
                    <span>Organization</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2">Model</th>
                <th className="py-3 px-2">Plan</th>
                <th
                  onClick={() => handleSort("healthScore")}
                  className="py-3 px-3 cursor-pointer hover:text-text"
                >
                  <div className="flex items-center gap-1">
                    <span>Health Score</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-3">
                  <div className="flex items-center gap-1">
                    <span>Credit / Wallet</span>
                    {isSupport && (
                      <span title="Financial limits hidden for Support role">
                        <EyeOff className="h-3 w-3 text-text-muted" />
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-3">30d Usage</th>
                <th
                  onClick={() => handleSort("openTicketsCount")}
                  className="py-3 px-2 text-center cursor-pointer hover:text-text"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Tickets</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-2 text-center" title="Compliance & KYC Status">
                  KYC
                </th>
                <th className="py-3 px-3">Owner AM</th>
                <th className="py-3 px-3">Contract End</th>
                <th className="py-3 px-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-text-muted">
                    <Building2 className="mx-auto h-8 w-8 text-text-muted/40 mb-2" />
                    <p className="text-sm font-medium text-text">No organizations found</p>
                    <p className="text-xs text-text-muted mt-1">
                      Try relaxing your search terms or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedAccounts.map((acc) => {
                  const healthColor =
                    acc.health.grade === "Healthy"
                      ? "text-success bg-success"
                      : acc.health.grade === "At Risk"
                      ? "text-warning bg-warning"
                      : "text-danger bg-danger";

                  const isAssignedToMe = isAccountManager && acc.ownerAmId === currentUser.id;

                  return (
                    <tr
                      key={acc.id}
                      onClick={() => router.push(`/accounts/${acc.id}`)}
                      className={cn(
                        "group cursor-pointer hover:bg-surface-2/60 transition-colors",
                        isAssignedToMe ? "bg-accent/[0.02]" : ""
                      )}
                    >
                      {/* Organization Name + Industry tag */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-medium text-text group-hover:text-accent transition-colors">
                            <span>{acc.name}</span>
                            {isAssignedToMe && (
                              <span className="rounded bg-accent/15 px-1 py-0.2 font-mono text-[9px] text-accent border border-accent/30 font-medium">
                                Mine
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="rounded bg-surface-2 px-1 py-0.2 font-mono text-[10px] text-text-muted border border-border">
                              {acc.industry}
                            </span>
                            <span className="text-[10px] text-text-muted/70">
                              {acc.city} • {acc.workspacesCount} WS
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-2 whitespace-nowrap">
                        <StatusBadge status={acc.status} size="sm" />
                      </td>

                      {/* Billing Model */}
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase font-semibold border",
                            acc.billingModel === "postpaid"
                              ? "bg-accent/10 text-accent border-accent/25"
                              : "bg-surface-2 text-text-muted border-border"
                          )}
                        >
                          {acc.billingModel}
                        </span>
                      </td>

                      {/* Plan */}
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span className="text-text font-medium">{acc.planName}</span>
                      </td>

                      {/* Health Score */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "font-mono font-semibold tabular-nums",
                                  acc.health.grade === "Healthy"
                                    ? "text-success"
                                    : acc.health.grade === "At Risk"
                                    ? "text-warning"
                                    : "text-danger"
                                )}
                              >
                                {acc.health.score}
                              </span>
                              <span className="text-[10px] text-text-muted">/100</span>
                            </div>
                            <div className="h-1.5 w-16 rounded-full bg-surface-2 overflow-hidden border border-border/50">
                              <div
                                className={cn("h-full rounded-full transition-all", healthColor.split(" ")[1])}
                                style={{ width: `${Math.max(5, acc.health.score)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Credit / Wallet Position (Role-aware: Hidden for Support) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isSupport ? (
                          <span
                            className="font-mono text-text-muted/60 text-[11px] italic"
                            title="Pricing & credit details hidden for Support role"
                          >
                            Restricted
                          </span>
                        ) : acc.billingModel === "postpaid" ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-between text-[11px] gap-2">
                              <MoneyText
                                amount={acc.financialPosition.creditUsed}
                                compact
                                className="text-text"
                              />
                              <span className="text-text-muted font-mono">
                                /{" "}
                                <MoneyText
                                  amount={acc.financialPosition.creditLimit}
                                  compact
                                  className="text-text-muted"
                                />
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="h-1.5 w-20 rounded-full bg-surface-2 overflow-hidden border border-border/50">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    acc.financialPosition.utilizationPct >= 90
                                      ? "bg-danger"
                                      : acc.financialPosition.utilizationPct >= 75
                                      ? "bg-warning"
                                      : "bg-success"
                                  )}
                                  style={{
                                    width: `${Math.min(100, Math.max(4, acc.financialPosition.utilizationPct))}%`,
                                  }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-text-muted">
                                {acc.financialPosition.utilizationPct}%
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <MoneyText
                              amount={acc.financialPosition.walletBalance}
                              compact
                              className="text-text"
                            />
                            <span className="text-[10px] text-text-muted">Prepaid Balance</span>
                          </div>
                        )}
                      </td>

                      {/* 30-day Usage Trend (Sparkline + % delta) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Sparkline
                            data={acc.usage.sparkline}
                            width={54}
                            height={20}
                            trend={
                              acc.usage.trendPct > 5
                                ? "up"
                                : acc.usage.trendPct < -5
                                ? "down"
                                : "neutral"
                            }
                          />
                          <span
                            className={cn(
                              "font-mono text-[11px] font-semibold tabular-nums",
                              acc.usage.trendPct > 0
                                ? "text-success"
                                : acc.usage.trendPct < -10
                                ? "text-danger"
                                : "text-text-muted"
                            )}
                          >
                            {acc.usage.trendPct >= 0 ? "+" : ""}
                            {acc.usage.trendPct}%
                          </span>
                        </div>
                      </td>

                      {/* Open Tickets */}
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        {acc.openTicketsCount > 0 ? (
                          <span
                            className={cn(
                              "inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-[11px] font-medium border",
                              acc.urgentTicketsCount > 0
                                ? "border-danger/30 bg-danger/10 text-danger"
                                : "border-border bg-surface-2 text-text"
                            )}
                          >
                            {acc.openTicketsCount}
                          </span>
                        ) : (
                          <span className="text-text-muted font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Compliance Status Dot */}
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        <span
                          className="inline-flex items-center justify-center"
                          title={
                            acc.complianceDot === "green"
                              ? "KYC Verified & All Workspaces Active"
                              : acc.complianceDot === "yellow"
                              ? "KYC Pending / In Review"
                              : "Workspace Suspended or KYC Rejected"
                          }
                        >
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              acc.complianceDot === "green"
                                ? "bg-success"
                                : acc.complianceDot === "yellow"
                                ? "bg-warning animate-pulse"
                                : "bg-danger"
                            )}
                          />
                        </span>
                      </td>

                      {/* Owner AM */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-text font-medium">{acc.ownerAmName}</span>
                          <span className="text-[10px] text-text-muted truncate max-w-[120px]">
                            {acc.ownerAmEmail}
                          </span>
                        </div>
                      </td>

                      {/* Contract End */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-text-muted">
                        {acc.contractEnd ? (
                          new Date(acc.contractEnd).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        ) : (
                          <span>Continuous</span>
                        )}
                      </td>

                      {/* Arrow Action */}
                      <td className="py-3 px-2 text-right">
                        <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-text transition-colors inline-block" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Summary Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 bg-surface text-xs text-text-muted">
          <div>
            Showing <strong className="text-text">{paginatedAccounts.length}</strong> of{" "}
            <strong className="text-text">{sortedAccounts.length}</strong> organizations
            {needsAttentionOnly && " (Attention Needed)"}
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-text focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Page Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded border border-border px-2 py-1 text-xs text-text hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none"
              >
                Previous
              </button>
              <span className="font-mono px-1">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="rounded border border-border px-2 py-1 text-xs text-text hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
