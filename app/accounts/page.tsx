import React from "react";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAccountsList } from "@/lib/services/accounts";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import { AccountsTable } from "@/components/accounts/AccountsTable";
import Link from "next/link";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [currentUser, allUsers] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
  ]);

  const [accounts, approvalsCount] = await Promise.all([
    getAccountsList(),
    getPendingApprovalsCountForRole(currentUser.role),
  ]);

  const atRiskCount = accounts.filter(
    (a) => a.status === "at_risk" || a.health.grade === "Critical"
  ).length;

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="space-y-6">
        <PageHeader
          title="Customer Accounts"
          description="Central portfolio management across all 42 enterprise and growth organizations. Real-time health scores, credit positions, 30-day traffic momentum, and compliance states."
          badge={
            atRiskCount > 0 ? (
              <StatusBadge
                status="at_risk"
                label={`${atRiskCount} Accounts Need Attention`}
                size="sm"
              />
            ) : (
              <StatusBadge status="healthy" label="Portfolio Healthy" size="sm" />
            )
          }
          breadcrumbs={[
            { label: "Relay BMP", href: "/" },
            { label: "Accounts" },
          ]}
          actions={
            <Link
              href="/accounts/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 transition-colors shadow-accent-glow"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Onboard Account</span>
            </Link>
          }
        />

        <AccountsTable initialAccounts={accounts} currentUser={currentUser} />
      </div>
    </AppShell>
  );
}
