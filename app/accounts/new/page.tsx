import React from "react";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OnboardingWizard } from "@/components/accounts/OnboardingWizard";
import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import { can } from "@/lib/permissions/can";
import { ShieldAlert, PlusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const [currentUser, allUsers] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
  ]);

  const [allPlans, approvalsCount] = await Promise.all([
    db.select().from(plans).all(),
    getPendingApprovalsCountForRole(currentUser.role),
  ]);

  const canCreate = can(currentUser.role, "account:create_or_onboard").allowed;

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="space-y-6">
        <PageHeader
          title="Onboard Customer Account"
          description="5-step multi-workspace onboarding wizard. Configures corporate entity, Indian GSTIN validation, commercial plans, and customer administrator invites."
          badge={<StatusBadge status="verified" label="Maker-Checker Audited" size="sm" />}
          breadcrumbs={[
            { label: "Relay BMP", href: "/" },
            { label: "Accounts", href: "/accounts" },
            { label: "New Onboarding" },
          ]}
        />

        {!canCreate ? (
          <div className="rounded-lg border border-warning/40 bg-surface p-8 text-center max-w-xl mx-auto space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-warning/30 bg-warning/10 text-warning">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">Sales Operations Required</h2>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">
                Creating new customer organizations is restricted to the <strong>Sales Operations</strong> or <strong>Admin</strong> role. You are currently acting as{" "}
                <strong className="text-text">{currentUser.name}</strong> ({currentUser.role}).
              </p>
            </div>
            <div className="rounded border border-border bg-surface-2 p-3 text-xs text-text-muted">
              Use the top-bar <strong>"Act As"</strong> dropdown to switch to{" "}
              <strong className="text-accent">Amit Bansal (Sales Ops)</strong> or{" "}
              <strong className="text-accent">Kabir Anand (Admin)</strong>.
            </div>
          </div>
        ) : (
          <OnboardingWizard
            currentUser={currentUser}
            availablePlans={allPlans.map((p) => ({
              id: p.id,
              name: p.name,
              billingModel: p.billingModel,
              baseFeeMonthly: p.baseFeeMonthly,
              includedSeats: p.includedSeats,
              throughputMps: p.throughputMps,
            }))}
          />
        )}
      </div>
    </AppShell>
  );
}
