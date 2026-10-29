"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatINR, formatDateTimeIST } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";
import {
  Building2,
  AlertTriangle,
  CreditCard,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileCheck2,
  Users,
  ExternalLink,
  ChevronRight,
  Play,
  CheckSquare,
  FileText,
  Plus,
} from "lucide-react";

interface RoleAwareDashboardProps {
  data: any;
}

export function RoleAwareDashboardClient({ data }: RoleAwareDashboardProps) {
  const { currentRole, currentUser, roleDefinition } = useRole();
  const [adminActiveTab, setAdminActiveTab] = useState<"overview" | "am" | "finance" | "compliance" | "salesOps" | "support">("overview");

  const { metrics, am, finance, compliance, salesOps, support, admin } = data;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text">
              Welcome back, {currentUser.name}
            </h1>
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border"
              style={{
                backgroundColor: `${roleDefinition.badgeColor}18`,
                borderColor: `${roleDefinition.badgeColor}40`,
                color: roleDefinition.badgeColor,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: roleDefinition.badgeColor }}
              />
              <span>{roleDefinition.label}</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Role-tailored mission control for B2B telecommunication accounts, financial limits, compliance gates, and SLAs.
          </p>
        </div>

        {/* Global Action CTAs */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/accounts"
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-hover transition-colors"
          >
            <Building2 className="h-3.5 w-3.5 text-text-muted" />
            <span>All Accounts</span>
          </Link>
          {currentRole === "sales_ops" || currentRole === "admin" ? (
            <Link
              href="/accounts/new"
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Onboard Organization</span>
            </Link>
          ) : (
            <Link
              href="/approvals"
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent/80 transition-colors"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              <span>Approvals Queue ({metrics.pendingApprovalsCount})</span>
            </Link>
          )}
        </div>
      </div>

      {/* ADMIN MASTER VIEW: Includes departmental tabs to preview any role */}
      {currentRole === "admin" && (
        <div className="space-y-6">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-lg border border-border bg-surface p-3.5">
              <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                Total Organizations
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-text">
                {metrics.totalOrganizations}
              </div>
              <div className="text-[10px] text-text-muted mt-1">
                {metrics.activeWorkspaces} active workspaces
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-3.5">
              <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                Accounts At Risk
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-danger">
                {metrics.atRiskAccountsCount}
              </div>
              <div className="text-[10px] text-text-muted mt-1">
                Requiring AM intervention
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-3.5">
              <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                Total Overdue Receivables
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-text">
                {formatINR(metrics.overdueTotalAmount)}
              </div>
              <div className="text-[10px] text-text-muted mt-1">
                Unsettled past due invoices
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-3.5">
              <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                Compliance SLA Breaches
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-warning">
                {compliance.slaBreachedCount}
              </div>
              <div className="text-[10px] text-text-muted mt-1">
                Past 48-hour SLA window
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-3.5">
              <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                Approval Backlog
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-accent">
                {metrics.pendingApprovalsCount}
              </div>
              <div className="text-[10px] text-text-muted mt-1">
                Maker-checker pending
              </div>
            </div>
          </div>

          {/* Departmental Switcher Tabs for Admin */}
          <div className="flex items-center gap-1.5 border-b border-border pb-2 text-xs font-medium">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mr-2">
              Preview Mission Control:
            </span>
            {(
              [
                { id: "overview", label: "Executive Overview" },
                { id: "am", label: "Account Manager" },
                { id: "finance", label: "Finance & Credit" },
                { id: "compliance", label: "Compliance & DLT" },
                { id: "salesOps", label: "Sales Ops" },
                { id: "support", label: "Customer Support" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAdminActiveTab(tab.id)}
                className={`rounded px-3 py-1 transition-colors ${
                  adminActiveTab === tab.id
                    ? "bg-accent/20 text-accent font-semibold"
                    : "text-text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {adminActiveTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Approval Backlog Widget */}
              <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-accent" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                      Pending Maker-Checker Backlog ({admin.approvalBacklog.length})
                    </h3>
                  </div>
                  <Link
                    href="/approvals"
                    className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
                  >
                    Open Approvals Queue <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="divide-y divide-border/60">
                  {admin.approvalBacklog.length === 0 ? (
                    <div className="py-8 text-center text-xs text-text-muted italic">
                      Zero pending approval requests. All clear.
                    </div>
                  ) : (
                    admin.approvalBacklog.slice(0, 5).map((cr: any) => (
                      <div key={cr.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="font-semibold text-text capitalize">
                            {cr.type.replace(/_/g, " ")}
                          </div>
                          <p className="text-[11px] text-text-muted line-clamp-1">
                            "{cr.reason}"
                          </p>
                          <div className="text-[10px] text-text-muted">
                            Requested by {cr.requestedBy} • Requires {cr.approverRoleNeeded}
                          </div>
                        </div>
                        <Link
                          href="/approvals"
                          className="rounded bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25 transition-colors shrink-0"
                        >
                          Review
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Credit Risk Watchlist Widget */}
              <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-warning" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                      High Credit Utilization Watchlist (&gt;70%)
                    </h3>
                  </div>
                  <Link
                    href="/finance"
                    className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
                  >
                    Finance Hub <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="divide-y divide-border/60 font-mono text-xs">
                  {finance.creditWatchlist.length === 0 ? (
                    <div className="py-8 text-center text-xs text-text-muted italic">
                      No accounts above 70% credit utilization.
                    </div>
                  ) : (
                    finance.creditWatchlist.slice(0, 5).map((item: any) => (
                      <div key={item.workspaceId} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/accounts/${item.orgId}`}
                            className="font-sans font-semibold text-text hover:text-accent truncate block"
                          >
                            {item.workspaceName}
                          </Link>
                          <span className="text-[11px] text-text-muted font-sans">
                            {item.orgName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-text-muted text-[11px]">
                            {formatINR(item.creditUsed)} / {formatINR(item.creditLimit)}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              item.utilizationPct >= 85
                                ? "bg-danger/20 text-danger"
                                : "bg-warning/20 text-warning"
                            }`}
                          >
                            {item.utilizationPct}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACCOUNT MANAGER VIEW */}
      {(currentRole === "account_manager" || (currentRole === "admin" && adminActiveTab === "am")) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">My Portfolio</div>
              <div className="mt-1 text-2xl font-bold font-mono text-text">{am.myOrgsCount}</div>
              <div className="text-[11px] text-text-muted mt-1">Assigned enterprise accounts</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">Accounts At Risk</div>
              <div className="mt-1 text-2xl font-bold font-mono text-danger">{am.myAccountsAtRisk.length}</div>
              <div className="text-[11px] text-text-muted mt-1">Health critical or churn warning</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">Renewals (60 Days)</div>
              <div className="mt-1 text-2xl font-bold font-mono text-warning">{am.myUpcomingRenewals.length}</div>
              <div className="text-[11px] text-text-muted mt-1">Upcoming contract renewals</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* My Accounts at Risk */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-danger" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                    My Accounts Requiring Attention ({am.myAccountsAtRisk.length})
                  </h3>
                </div>
                <Link href="/accounts" className="text-xs text-accent hover:underline">
                  View All Accounts →
                </Link>
              </div>

              <div className="divide-y divide-border/60">
                {am.myAccountsAtRisk.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-muted italic">
                    Great news! None of your assigned accounts are currently flagged at risk.
                  </div>
                ) : (
                  am.myAccountsAtRisk.map((org: any) => (
                    <div key={org.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <Link href={`/accounts/${org.id}`} className="font-semibold text-text hover:text-accent">
                          {org.name}
                        </Link>
                        <div className="text-[11px] text-text-muted">{org.industry} • {org.city}</div>
                      </div>
                      <Link
                        href={`/accounts/${org.id}`}
                        className="rounded bg-surface-2 border border-border px-2.5 py-1 text-xs font-medium text-text hover:border-accent"
                      >
                        Open 360 →
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* My Action Items */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-accent" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                    My Action Items ({am.myPendingTasks.length})
                  </h3>
                </div>
                <Link href="/tasks" className="text-xs text-accent hover:underline">
                  All Tasks →
                </Link>
              </div>

              <div className="divide-y divide-border/60">
                {am.myPendingTasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-muted italic">
                    No pending tasks assigned to you.
                  </div>
                ) : (
                  am.myPendingTasks.map((t: any) => (
                    <div key={t.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="font-medium text-text">{t.title}</div>
                        <div className="text-[10px] text-text-muted">{t.orgName}</div>
                      </div>
                      <Link
                        href="/tasks"
                        className="rounded bg-surface-2 border border-border px-2 py-0.5 text-[10px] text-text"
                      >
                        View
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FINANCE VIEW */}
      {(currentRole === "finance" || currentRole === "finance_head" || (currentRole === "admin" && adminActiveTab === "finance")) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">Overdue Receivables</div>
              <div className="mt-1 text-2xl font-bold font-mono text-danger">
                {formatINR(finance.overdueInvoices.reduce((a: number, b: any) => a + b.amount, 0))}
              </div>
              <div className="text-[11px] text-text-muted mt-1">Across {finance.overdueInvoices.length} past-due invoices</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">Credit Watchlist (&gt;70%)</div>
              <div className="mt-1 text-2xl font-bold font-mono text-warning">
                {finance.creditWatchlist.length} Workspaces
              </div>
              <div className="text-[11px] text-text-muted mt-1">Potential traffic throttling candidates</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overdue Queue */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                  Overdue Invoices Queue
                </h3>
                <Link href="/finance" className="text-xs text-accent hover:underline">
                  Open Collections →
                </Link>
              </div>

              <div className="divide-y divide-border/60 text-xs">
                {finance.overdueInvoices.slice(0, 6).map((inv: any) => (
                  <div key={inv.invoiceId} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-text">{inv.orgName}</div>
                      <div className="text-[10px] text-text-muted font-mono">Invoice #{inv.invoiceId} • {inv.period}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-text">{formatINR(inv.amount)}</div>
                      <span className="rounded bg-danger/20 px-1.5 py-0.2 text-[9px] font-bold text-danger">
                        {inv.daysOverdue} days overdue
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Credit Utilization Watchlist */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                  Credit Watchlist (&gt;70%)
                </h3>
                <Link href="/finance" className="text-xs text-accent hover:underline">
                  Finance Hub →
                </Link>
              </div>

              <div className="divide-y divide-border/60 text-xs font-mono">
                {finance.creditWatchlist.slice(0, 6).map((item: any) => (
                  <div key={item.workspaceId} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="font-sans">
                      <div className="font-semibold text-text">{item.workspaceName}</div>
                      <div className="text-[10px] text-text-muted">{item.orgName}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-text-muted">
                        {formatINR(item.creditUsed)} / {formatINR(item.creditLimit)}
                      </span>
                      <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                        {item.utilizationPct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPLIANCE VIEW */}
      {(currentRole === "compliance" || (currentRole === "admin" && adminActiveTab === "compliance")) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">Pending KYC Reviews</div>
              <div className="mt-1 text-2xl font-bold font-mono text-text">{compliance.pendingKyc.length}</div>
              <div className="text-[11px] text-text-muted mt-1">Awaiting MCA / GST verification</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">Pending DLT Headers</div>
              <div className="mt-1 text-2xl font-bold font-mono text-text">{compliance.pendingSenders.length}</div>
              <div className="text-[11px] text-text-muted mt-1">Principal Entity sender IDs</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">SLA Breached Cases (&gt;48h)</div>
              <div className="mt-1 text-2xl font-bold font-mono text-danger">{compliance.slaBreachedCount}</div>
              <div className="text-[11px] text-text-muted mt-1">Critical compliance turnaround</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                  KYC Verification Queue
                </h3>
                <Link href="/compliance" className="text-xs text-accent hover:underline">
                  Compliance Hub →
                </Link>
              </div>

              <div className="divide-y divide-border/60 text-xs">
                {compliance.pendingKyc.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-muted italic">
                    All KYC cases have been processed.
                  </div>
                ) : (
                  compliance.pendingKyc.map((c: any) => (
                    <div key={c.caseId} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-text">{c.orgName}</div>
                        <div className="text-[10px] text-text-muted">{c.workspaceName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.isBreached && (
                          <span className="rounded bg-danger/20 px-1.5 py-0.2 text-[9px] font-bold text-danger">
                            SLA Breached (&gt;48h)
                          </span>
                        )}
                        <Link
                          href="/compliance"
                          className="rounded bg-accent/15 px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/25"
                        >
                          Review
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                  DLT Sender ID Queue
                </h3>
                <Link href="/compliance" className="text-xs text-accent hover:underline">
                  Review Headers →
                </Link>
              </div>

              <div className="divide-y divide-border/60 text-xs">
                {compliance.pendingSenders.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-muted italic">
                    No pending DLT sender IDs.
                  </div>
                ) : (
                  compliance.pendingSenders.map((s: any) => (
                    <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono font-bold text-accent">{s.header}</div>
                        <div className="text-[10px] text-text-muted">{s.orgName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.isBreached && (
                          <span className="rounded bg-danger/20 px-1.5 py-0.2 text-[9px] font-bold text-danger">
                            &gt;48h Delay
                          </span>
                        )}
                        <Link
                          href="/compliance"
                          className="rounded bg-surface-2 border border-border px-2 py-1 text-xs text-text"
                        >
                          Inspect
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SALES OPS VIEW */}
      {(currentRole === "sales_ops" || (currentRole === "admin" && adminActiveTab === "salesOps")) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">Organizations in Onboarding</div>
              <div className="mt-1 text-2xl font-bold font-mono text-accent">{salesOps.onboardingOrgs.length}</div>
              <div className="text-[11px] text-text-muted mt-1">Pending KYC or initial DLT setup</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">Onboarding Actions</div>
              <div className="mt-2">
                <Link
                  href="/accounts/new"
                  className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/80"
                >
                  <Plus className="h-3.5 w-3.5" /> Launch Onboarding Wizard
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text">
              Customer Onboarding Pipeline
            </h3>

            <div className="divide-y divide-border/60">
              {salesOps.onboardingOrgs.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted italic">
                  No accounts currently in onboarding.
                </div>
              ) : (
                salesOps.onboardingOrgs.map((org: any) => (
                  <div key={org.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <Link href={`/accounts/${org.id}`} className="font-semibold text-text hover:text-accent">
                        {org.name}
                      </Link>
                      <div className="text-[11px] text-text-muted">
                        {org.legalName} • {org.industry} • {org.billingModel}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-warning/20 px-2 py-0.5 text-[10px] font-bold text-warning capitalize">
                        {org.kycPending ? "KYC Pending" : "In Progress"}
                      </span>
                      <Link
                        href={`/accounts/${org.id}`}
                        className="rounded bg-surface-2 border border-border px-2.5 py-1 text-xs text-text hover:border-accent"
                      >
                        Resume Setup →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT VIEW */}
      {(currentRole === "support" || (currentRole === "admin" && adminActiveTab === "support")) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">Open Customer Tickets</div>
              <div className="mt-1 text-2xl font-bold font-mono text-text">{support.openTickets.length}</div>
              <div className="text-[11px] text-text-muted mt-1">Across all organizations</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-semibold text-text-muted uppercase">SLA Breached Tickets (&gt;4h)</div>
              <div className="mt-1 text-2xl font-bold font-mono text-danger">{support.breachedTicketsCount}</div>
              <div className="text-[11px] text-text-muted mt-1">First response window exceeded</div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text">
              Active Support Queue (Sorted by SLA Urgency)
            </h3>

            <div className="divide-y divide-border/60 text-xs">
              {support.openTickets.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted italic">
                  Zero open customer tickets!
                </div>
              ) : (
                support.openTickets.map((t: any) => (
                  <div key={t.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text">{t.subject}</span>
                        {t.isBreached && (
                          <span className="rounded bg-danger/20 border border-danger/40 px-1.5 py-0.2 text-[9px] font-bold text-danger">
                            &gt;4h SLA Breached
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        #{t.id} • {t.orgName} • Created {new Date(t.createdAt).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                    <Link
                      href={`/accounts/${t.orgId}`}
                      className="rounded bg-surface-2 border border-border px-2.5 py-1 text-xs text-text hover:border-accent shrink-0"
                    >
                      Open Ticket →
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
