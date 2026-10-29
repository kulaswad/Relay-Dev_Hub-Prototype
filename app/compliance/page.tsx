import React from "react";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getComplianceQueue } from "@/lib/services/compliance";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import { ComplianceQueueClient } from "@/components/compliance/ComplianceQueueClient";
import { db } from "@/lib/db";
import { workspaces, organizations } from "@/lib/db/schema";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const [currentUser, allUsers] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
  ]);

  const [queueData, approvalsCount, allWs, allOrgs] = await Promise.all([
    getComplianceQueue(),
    getPendingApprovalsCountForRole(currentUser.role),
    db.select().from(workspaces).all(),
    db.select().from(organizations).all(),
  ]);

  const orgMap = new Map(allOrgs.map((o) => [o.id, o.name]));
  const formattedWorkspaces = allWs.map((w) => ({
    id: w.id,
    name: w.name,
    orgId: w.orgId,
    orgName: orgMap.get(w.orgId) || "Unknown",
  }));

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="space-y-6">
        <PageHeader
          title="Compliance & Regulatory Queue"
          description="MCA KYC document verification, TRAI DLT 6-character header authorizations, and template compliance triage with live SLA tracking."
          badge={
            queueData.stats.slaBreachedCount > 0 ? (
              <StatusBadge
                status="overdue"
                label={`${queueData.stats.slaBreachedCount} SLA Breached`}
                size="sm"
              />
            ) : (
              <StatusBadge status="verified" label="SLA Healthy" size="sm" />
            )
          }
          breadcrumbs={[
            { label: "Relay BMP", href: "/" },
            { label: "Compliance & DLT" },
          ]}
        />

        <ComplianceQueueClient
          initialItems={queueData.items}
          stats={queueData.stats}
          allWorkspaces={formattedWorkspaces}
          currentUser={currentUser}
        />
      </div>
    </AppShell>
  );
}
