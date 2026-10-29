import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleAwareDashboardClient } from "@/components/dashboard/RoleAwareDashboardClient";
import { getRoleDashboardData } from "@/lib/services/dashboard";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";

export const metadata = {
  title: "Dashboard & Mission Control | Relay BMP",
  description: "Role-tailored operations dashboard for B2B telecommunication accounts, financial positions, compliance, and SLAs.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [currentUser, allUsers] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
  ]);

  const [dashboardData, approvalsCount] = await Promise.all([
    getRoleDashboardData(currentUser),
    getPendingApprovalsCountForRole(currentUser.role),
  ]);

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="container mx-auto p-6 max-w-7xl">
        <RoleAwareDashboardClient data={dashboardData} />
      </div>
    </AppShell>
  );
}
