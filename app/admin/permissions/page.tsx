import React from "react";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PERMISSION_MATRIX } from "@/lib/permissions/matrix";
import { INTERNAL_ROLES, InternalRole } from "@/lib/permissions/roles";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import { Shield, ShieldAlert, Check, X, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  const [currentUser, allUsers] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
  ]);

  const approvalsCount = await getPendingApprovalsCountForRole(currentUser.role);

  const isAdmin = currentUser.role === "admin";

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="space-y-6">
        <PageHeader
          title="Security & Permission Matrix"
          description="Single typed source of truth (/lib/permissions/matrix.ts). Enforces strict role-based access control across all BMP UI views and server mutations."
          badge={<StatusBadge status="verified" label="RBAC Active" size="sm" />}
          breadcrumbs={[
            { label: "Relay BMP", href: "/" },
            { label: "Governance" },
            { label: "Roles & Permissions" },
          ]}
        />

        {!isAdmin ? (
          <div className="rounded-lg border border-warning/40 bg-surface p-8 text-center max-w-2xl mx-auto space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-warning/30 bg-warning/10 text-warning">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">
                Restricted Governance View
              </h2>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">
                You are currently evaluating Relay BMP as{" "}
                <strong className="text-text">{currentUser.name}</strong> (
                <span className="capitalize">{currentUser.role.replace("_", " ")}</span>
                ). The security matrix configuration is restricted to Platform Admins.
              </p>
            </div>
            <div className="rounded border border-border bg-surface-2 p-3 text-xs text-text-muted">
              Use the top-bar <strong>"Act As"</strong> dropdown to switch to{" "}
              <strong className="text-accent">Kabir Anand (Admin)</strong> or{" "}
              <strong className="text-accent">Meera Joshi (Admin)</strong> to inspect this view.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs text-text-muted font-medium">Defined Matrix Rules</span>
                <div className="mt-1 text-2xl font-mono font-semibold text-text">
                  {PERMISSION_MATRIX.length} Actions
                </div>
                <span className="text-[11px] text-text-muted">Single typed definition</span>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs text-text-muted font-medium">Internal Roles</span>
                <div className="mt-1 text-2xl font-mono font-semibold text-text">
                  {INTERNAL_ROLES.length} Roles
                </div>
                <span className="text-[11px] text-text-muted">AM, Support, Fin, Ops, Comp, FinHead, Admin</span>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs text-text-muted font-medium">Server Enforcement</span>
                <div className="mt-1 text-2xl font-mono font-semibold text-success flex items-center gap-1.5">
                  <Shield className="h-5 w-5" />
                  <span>100% Guarded</span>
                </div>
                <span className="text-[11px] text-text-muted">assertPermission() on all server actions</span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface-2/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text">
                    Role-Based Access Control (RBAC) Matrix
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    Read-only reference of all operational capabilities per internal role.
                  </p>
                </div>
                <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[10px] text-accent font-medium border border-accent/30">
                  Strict Type Safety
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-table text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/70 text-text-muted text-xs">
                      <th className="px-4 py-2.5 font-medium whitespace-nowrap min-w-[240px]">
                        Capability / Action
                      </th>
                      <th className="px-3 py-2.5 font-medium whitespace-nowrap">
                        Category
                      </th>
                      {INTERNAL_ROLES.map((r) => (
                        <th
                          key={r.id}
                          className="px-2.5 py-2.5 font-medium text-center whitespace-nowrap"
                        >
                          <div className="flex flex-col items-center">
                            <span
                              className="h-1.5 w-1.5 rounded-full mb-1"
                              style={{ backgroundColor: r.badgeColor }}
                            />
                            <span className="text-[11px] font-semibold text-text">
                              {r.label}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {PERMISSION_MATRIX.map((rule) => (
                      <tr
                        key={rule.action}
                        className="hover:bg-surface-hover/70 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col">
                            <span className="font-medium text-xs text-text">
                              {rule.name}
                            </span>
                            <span className="text-[11px] text-text-muted leading-tight">
                              {rule.description}
                            </span>
                            <span className="font-mono text-[10px] text-accent/80 mt-0.5">
                              {rule.action}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-text-muted border border-border">
                            {rule.category}
                          </span>
                        </td>

                        {INTERNAL_ROLES.map((role) => {
                          const isAllowed = rule.allowedRoles.includes(role.id);
                          return (
                            <td
                              key={role.id}
                              className="px-2.5 py-2.5 text-center whitespace-nowrap"
                            >
                              {isAllowed ? (
                                <span
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success border border-success/30 mx-auto"
                                  title={`Allowed for ${role.label}`}
                                >
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </span>
                              ) : (
                                <span
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-text-muted/40 mx-auto"
                                  title={`Denied for ${role.label}: ${rule.requiredRoleName}`}
                                >
                                  <X className="h-3 w-3" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
