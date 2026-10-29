import React from "react";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import { getAuditLogs } from "@/lib/services/audit";
import { AppShell } from "@/components/layout/AppShell";
import { AuditLogViewer } from "@/components/audit/AuditLogViewer";

export const metadata = {
  title: "Audit Log & Tamper-Evident Trail | Relay BMP",
  description: "Cryptographically chained immutable operational audit trail with role visibility and integrity verification.",
};

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const [currentUser, allUsers] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
  ]);

  const [approvalsCount, logs] = await Promise.all([
    getPendingApprovalsCountForRole(currentUser.role),
    getAuditLogs({}, currentUser),
  ]);

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="container mx-auto p-6 max-w-7xl">
        <AuditLogViewer initialLogs={logs} />
      </div>
    </AppShell>
  );
}
