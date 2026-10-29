import React from "react";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { ApprovalsClient, ChangeRequestItem } from "@/components/approvals/ApprovalsClient";
import { db } from "@/lib/db";
import { changeRequests, workspaces, organizations, internalUsers } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const [currentUser, allUsers] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
  ]);

  const [rawRequests, allWorkspaces, allOrganizations, approvalsCount] = await Promise.all([
    db.select().from(changeRequests).orderBy(desc(changeRequests.createdAt)).all(),
    db.select().from(workspaces).all(),
    db.select().from(organizations).all(),
    getPendingApprovalsCountForRole(currentUser.role),
  ]);

  // Enrich change requests with names and roles
  const requestsList: ChangeRequestItem[] = rawRequests.map((cr) => {
    const requester = allUsers.find((u) => u.id === cr.requestedBy);
    let targetName = cr.targetId;

    if (cr.targetType === "workspace") {
      const ws = allWorkspaces.find((w) => w.id === cr.targetId);
      if (ws) targetName = ws.name;
    } else if (cr.targetType === "organization") {
      const org = allOrganizations.find((o) => o.id === cr.targetId);
      if (org) targetName = org.name;
    }

    return {
      id: cr.id,
      type: cr.type,
      targetType: cr.targetType,
      targetId: cr.targetId,
      payload: cr.payload,
      status: cr.status,
      requestedBy: cr.requestedBy,
      approverRoleNeeded: cr.approverRoleNeeded,
      approvedBy: cr.approvedBy,
      reason: cr.reason,
      decisionNote: cr.decisionNote,
      createdAt: cr.createdAt,
      decidedAt: cr.decidedAt,
      expiresAt: cr.expiresAt,
      requesterName: requester ? requester.name : cr.requestedBy,
      requesterRole: requester ? requester.role.replace("_", " ").toUpperCase() : "STAFF",
      targetName,
    };
  });

  const availableWorkspaces = allWorkspaces
    .filter((w) => w.creditLimit > 0)
    .map((w) => ({
      id: w.id,
      name: w.name,
      creditLimit: w.creditLimit,
      creditUsed: w.creditUsed,
    }));

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <ApprovalsClient
        currentUser={currentUser}
        requestsList={requestsList}
        availableWorkspaces={availableWorkspaces}
      />
    </AppShell>
  );
}
