"use client";

import React, { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { MoneyText } from "@/components/ui/MoneyText";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { toast } from "@/components/ui/Toaster";
import {
  TrendingUp,
  CreditCard,
  Building2,
  AlertTriangle,
  RefreshCw,
  Plus,
} from "lucide-react";
import type { Organization } from "@/lib/db/schema";

interface DashboardClientProps {
  stats: {
    totalMRR: number;
    totalCreditLimit: number;
    totalCreditUsed: number;
    totalPrepaidWallet: number;
    atRiskCount: number;
    totalOrganizations: number;
    activeWorkspacesCount: number;
    totalWorkspaces: number;
  };
  organizationsList: Organization[];
  auditLogsList: Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    actorName: string;
    actorRole: string;
    reason: string;
    createdAt: Date | string | number;
  }>;
}

export function DashboardClient({
  stats,
  organizationsList,
  auditLogsList,
}: DashboardClientProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  // DataTable Column Definitions for 42 organizations
  const columns: ColumnDef<Organization>[] = [
    {
      accessorKey: "name",
      header: "Organization",
      cell: ({ row }) => {
        const org = row.original;
        const isHero = org.id === "org_meridian_finserv";
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-surface-2 border border-border text-xs font-mono font-semibold text-text">
              {org.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-text hover:text-accent transition-colors">
                  {org.name}
                </span>
                {isHero && (
                  <span className="rounded bg-accent/20 px-1 py-0.2 font-mono text-[9px] uppercase font-bold text-accent border border-accent/40">
                    Hero Demo
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px] text-text-muted truncate max-w-[220px]">
                {org.legalName}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "industry",
      header: "Industry",
      cell: ({ row }) => (
        <span className="text-xs text-text-muted font-medium">
          {row.getValue("industry")}
        </span>
      ),
    },
    {
      accessorKey: "city",
      header: "City",
      cell: ({ row }) => (
        <span className="text-xs text-text-muted">
          {row.getValue("city")}
        </span>
      ),
    },
    {
      accessorKey: "billingModel",
      header: "Billing Model",
      cell: ({ row }) => {
        const model = row.getValue("billingModel") as string;
        return (
          <span className="font-mono text-xs capitalize text-text">
            {model}
          </span>
        );
      },
    },
    {
      accessorKey: "planId",
      header: "Plan Tier",
      cell: ({ row }) => {
        const plan = (row.getValue("planId") as string).replace("plan_", "");
        return (
          <StatusBadge
            status={plan}
            size="sm"
            className="uppercase tracking-wider font-mono text-[10px]"
          />
        );
      },
    },
    {
      accessorKey: "status",
      header: "Account Health",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return <StatusBadge status={status} size="sm" />;
      },
    },
    {
      accessorKey: "ownerAmId",
      header: "Account Manager",
      cell: ({ row }) => {
        const amId = row.getValue("ownerAmId") as string;
        const name = amId.replace("usr_am_", "").replace(/_/g, " ").toUpperCase();
        return (
          <span className="text-xs text-text-muted font-mono">
            {name}
          </span>
        );
      },
    },
  ];

  // Convert audit logs to Timeline format
  const timelineItems: TimelineItem[] = auditLogsList.map((log) => ({
    id: log.id,
    title: log.action.replace(/_/g, " ").toUpperCase(),
    actorName: log.actorName.replace("usr_", "").replace(/_/g, " "),
    actorRole: log.actorRole,
    timestamp: log.createdAt,
    reason: log.reason,
    badge: (
      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-muted border border-border">
        {log.entityType}
      </span>
    ),
  }));

  const mrrSpark = [28, 30, 31, 33, 34, 38, 42];
  const creditSpark = [65, 70, 72, 75, 78, 82, 85];
  const wsSpark = [45, 48, 50, 52, 54, 56, 58];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Internal Business Management"
        description="Single pane of glass for Relay account managers, finance, and compliance teams to monitor 400+ B2B customer accounts."
        badge={<StatusBadge status="active" label="Live Seeded DB" size="sm" />}
        breadcrumbs={[
          { label: "Relay BMP", href: "/" },
          { label: "Executive Overview" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                toast.info("Database re-synced", {
                  description: "Refreshed live organization and workspace records from SQLite.",
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-hover transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setReasonOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover shadow-accent-glow transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Audit Action Demo</span>
            </button>
          </div>
        }
      />

      {/* KPI Metric StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Monthly Revenue (MRR Est.)"
          value={<MoneyText amount={stats.totalMRR} compact />}
          subtitle="90d messaging volume run-rate"
          change={{ value: "+18.4% MoM", trend: "up" }}
          sparklineData={mrrSpark}
          icon={<TrendingUp className="h-4 w-4" />}
        />

        <StatCard
          title="Postpaid Credit Exposure"
          value={<MoneyText amount={stats.totalCreditUsed} compact />}
          subtitle={`Limit: ${stats.totalCreditLimit ? (stats.totalCreditLimit / 10000000).toFixed(1) : 0}Cr (${Math.round((stats.totalCreditUsed / (stats.totalCreditLimit || 1)) * 100)}% used)`}
          change={{ value: "5 near limit", trend: "neutral" }}
          sparklineData={creditSpark}
          icon={<CreditCard className="h-4 w-4" />}
        />

        <StatCard
          title="Active Workspaces"
          value={
            <span className="font-mono tabular-nums">
              {stats.activeWorkspacesCount} / {stats.totalWorkspaces}
            </span>
          }
          subtitle={`Prepaid Pool: ₹${(stats.totalPrepaidWallet / 100000).toFixed(1)}L`}
          change={{ value: "58 Total WS", trend: "up" }}
          sparklineData={wsSpark}
          icon={<Building2 className="h-4 w-4" />}
        />

        <StatCard
          title="Accounts At Risk"
          value={
            <span className="font-mono tabular-nums text-warning">
              {stats.atRiskCount}
            </span>
          }
          subtitle="Churn or credit ceiling alerts"
          change={{ value: "Includes Meridian", trend: "down" }}
          icon={<AlertTriangle className="h-4 w-4 text-warning" />}
        />
      </div>

      {/* Organization Accounts Table */}
      <div className="space-y-3" id="organizations">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-text">
              Customer Organizations ({organizationsList.length})
            </h2>
            <p className="text-xs text-text-muted">
              Live records persisted in SQLite across BFSI, Insurance, D2C, Edtech, and Logistics.
            </p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={organizationsList}
          searchPlaceholder="Search customer by name, legal name, or industry..."
          onRowClick={(org) => {
            setSelectedOrg(org);
            setConfirmOpen(true);
          }}
        />
      </div>

      {/* Audit Log Timeline & Environment Specs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Recent Audit Events */}
        <div className="lg:col-span-2 space-y-3" id="audit">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-text">
              Audit Trail (Who, What, Why)
            </h3>
            <span className="text-[11px] font-mono text-text-muted">
              Immutable log entries
            </span>
          </div>

          <Timeline items={timelineItems} />
        </div>

        {/* System & Design Specifications */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold tracking-tight text-text">
            System & Currency Standards
          </h3>
          <KeyValueList
            items={[
              { key: "Database", value: "SQLite WAL (better-sqlite3)", isMono: true },
              { key: "Organizations Seeded", value: "42 (23 Pre, 19 Post)", isMono: true },
              { key: "Workspaces Total", value: "58 workspaces", isMono: true },
              { key: "Currency Standard", value: "INR (en-IN Intl grouping)", isMono: true },
              { key: "Timezone", value: "Asia/Kolkata (IST)", isMono: true },
              { key: "Hero Account", value: "Meridian Finserv", isMono: false },
            ]}
          />

          <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
            <h4 className="text-xs font-semibold text-text">
              Dual-Approval Guardrails
            </h4>
            <p className="text-xs text-text-muted leading-relaxed">
              Credit hikes over threshold, custom discounts, and suspensions mandate two-party review via <code>change_requests</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Reusable Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Inspect ${selectedOrg?.name || "Account"}`}
        description={`Selected ${selectedOrg?.name} (${selectedOrg?.legalName}). City: ${selectedOrg?.city}, Industry: ${selectedOrg?.industry}, Model: ${selectedOrg?.billingModel}.`}
        confirmLabel="Open Account 360"
        variant="primary"
        onConfirm={() => {
          toast.success("Account 360 preview confirmed", {
            description: `Viewing details for ${selectedOrg?.name}.`,
          });
        }}
      />

      {/* Reusable Reason Dialog */}
      <ReasonDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        title="Audit-Logged Parameter Change"
        description="Every critical parameter or credit update at Relay requires an explicit justification for the compliance audit log."
        actionLabel="Record Audit Justification"
        placeholder="E.g. Approved temporary credit buffer increase due to Amazon Great Indian Festival campaign surge..."
        onSubmit={(reason) => {
          toast.success("Audit Log Recorded", {
            description: `Justification saved: "${reason}"`,
          });
        }}
      />
    </div>
  );
}
