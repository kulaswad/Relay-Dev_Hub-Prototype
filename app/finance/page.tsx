import React from "react";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import { getFinanceHubData } from "@/lib/services/finance";
import { AppShell } from "@/components/layout/AppShell";
import { FinanceHubClient } from "@/components/finance/FinanceHubClient";

export const metadata = {
  title: "Finance & Credit Hub | Relay BMP",
  description: "Enterprise billing, credit line management, prepaid balances, aging collections, and risk monitoring.",
};

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const [currentUser, allUsers, data] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
    getFinanceHubData(),
  ]);

  const approvalsCount = await getPendingApprovalsCountForRole(currentUser.role);

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="container mx-auto p-6 max-w-7xl">
        <FinanceHubClient initialData={data} />
      </div>
    </AppShell>
  );
}
