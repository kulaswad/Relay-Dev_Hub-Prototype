import React from "react";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { db } from "@/lib/db";
import { approvalPolicies } from "@/lib/db/schema";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import { Sliders, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const [currentUser, allUsers] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
  ]);

  const [approvalsCount, policiesList] = await Promise.all([
    getPendingApprovalsCountForRole(currentUser.role),
    db.select().from(approvalPolicies).all(),
  ]);

  const isAdmin = currentUser.role === "admin";

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="space-y-6">
        <PageHeader
          title="Maker-Checker Approval Policies"
          description="Configured operational guardrails. Critical mutations exceeding these financial or lifecycle thresholds are halted and routed for secondary sign-off."
          badge={<StatusBadge status="active" label="Dual-Approval Enforced" size="sm" />}
          breadcrumbs={[
            { label: "Relay BMP", href: "/" },
            { label: "Governance" },
            { label: "Approval Policies" },
          ]}
        />

        {!isAdmin ? (
          <div className="rounded-lg border border-warning/40 bg-surface p-8 text-center max-w-2xl mx-auto space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-warning/30 bg-warning/10 text-warning">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">
                Admin-Restricted Policy Configuration
              </h2>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">
                Viewing or editing maker-checker approval thresholds requires the Platform Admin role.
                You are currently acting as <strong className="text-text">{currentUser.name}</strong> ({currentUser.role}).
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {policiesList.map((pol) => (
                <div
                  key={pol.id}
                  className="rounded-lg border border-border bg-surface p-4 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
                        {pol.actionType}
                      </span>
                      <StatusBadge
                        status={pol.isActive ? "active" : "neutral"}
                        label={pol.isActive ? "Enforced" : "Disabled"}
                        size="sm"
                      />
                    </div>
                    <h4 className="text-xs font-semibold text-text">
                      {pol.name}
                    </h4>
                    <p className="mt-1 text-xs text-text-muted leading-relaxed">
                      {pol.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                    <span className="text-text-muted text-[11px]">Required Checker:</span>
                    <span className="font-mono font-medium rounded bg-surface-2 px-2 py-0.5 text-accent border border-accent/20">
                      {pol.approverRole.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-success shrink-0" />
                <p className="text-xs text-text-muted">
                  <strong>Strict Maker-Checker Rule:</strong> Requesters are programmatically prevented from approving their own submissions. All pending change requests expire after 72 hours.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
