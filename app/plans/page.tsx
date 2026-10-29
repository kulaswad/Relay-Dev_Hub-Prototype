import React from "react";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import { getPlansCatalog, getAddonCatalog } from "@/lib/services/plans";
import { AppShell } from "@/components/layout/AppShell";
import { PlansCatalogClient } from "@/components/plans/PlansCatalogClient";

export const metadata = {
  title: "Plans & Add-ons Catalog | Relay BMP",
  description: "Standard commercial plans, channel rate cards, price floors, and modular enterprise add-ons.",
};

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const [currentUser, allUsers, plans, addons] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
    getPlansCatalog(),
    getAddonCatalog(),
  ]);

  const approvalsCount = await getPendingApprovalsCountForRole(currentUser.role);

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="container mx-auto p-6 max-w-7xl">
        <PlansCatalogClient initialPlans={plans} addonsCatalog={addons} />
      </div>
    </AppShell>
  );
}
