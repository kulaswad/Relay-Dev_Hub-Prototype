import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { AIActivityClient } from "@/components/admin/AIActivityClient";
import { getAiRunsTelemetry } from "@/lib/ai/client";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";

export const dynamic = "force-dynamic";

export default async function AdminAIPage() {
  const [currentUser, allUsers] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
  ]);
  const approvalsCount = await getPendingApprovalsCountForRole(currentUser.role);
  const telemetry = await getAiRunsTelemetry(100);

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="space-y-6">
        <PageHeader
          title="AI Activity & Telemetry"
          description="Real-time monitoring of Gemini LLM and deterministic fallback inference runs, model latencies, input hashes, and human acceptance rates."
          badge={
            <span className="rounded bg-success/15 border border-success/30 px-2 py-0.5 text-xs font-mono text-success">
              Live Monitoring
            </span>
          }
          breadcrumbs={[
            { label: "Admin", href: "/admin/permissions" },
            { label: "AI Activity" },
          ]}
        />
        <AIActivityClient runs={telemetry.runs} stats={telemetry.stats} />
      </div>
    </AppShell>
  );
}
