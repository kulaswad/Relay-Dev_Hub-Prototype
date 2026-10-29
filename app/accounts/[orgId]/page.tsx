import React from "react";
import { notFound } from "next/navigation";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { getAccount360 } from "@/lib/services/accounts";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import { getPlansCatalog } from "@/lib/services/plans";
import {
  calculateOrgChurnRisk,
  analyzeUnusedSeats,
  generateAMRecommendations,
} from "@/lib/services/churn-seats";
import { Account360Client } from "@/components/accounts/Account360Client";

export const dynamic = "force-dynamic";

interface AccountPageProps {
  params: {
    orgId: string;
  };
}

export default async function AccountDetailPage({ params }: AccountPageProps) {
  const [currentUser, allUsers, plans] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
    getPlansCatalog(),
  ]);

  const [accountData, approvalsCount] = await Promise.all([
    getAccount360(params.orgId),
    getPendingApprovalsCountForRole(currentUser.role),
  ]);

  if (!accountData) {
    notFound();
  }

  const churn = calculateOrgChurnRisk(params.orgId);
  const seats = analyzeUnusedSeats(params.orgId);
  const recommendations = generateAMRecommendations(params.orgId);

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <Account360Client
        data={accountData}
        currentUser={currentUser}
        availablePlans={plans}
        churn={churn}
        seats={seats}
        recommendations={recommendations}
      />
    </AppShell>
  );
}
