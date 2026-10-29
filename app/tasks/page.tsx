import React from "react";
import { getActiveUser, getAllInternalUsers } from "@/lib/auth";
import { getPendingApprovalsCountForRole } from "@/lib/services/approvals";
import { getAllOrganizations } from "@/lib/services/accounts";
import { getTasksList } from "@/lib/services/tasks";
import { AppShell } from "@/components/layout/AppShell";
import { TasksClient } from "@/components/tasks/TasksClient";

export const metadata = {
  title: "Operational Tasks | Relay BMP",
  description: "Action items, collections follow-ups, and AI recommendations assigned across internal teams.",
};

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [currentUser, allUsers, orgs, tasks] = await Promise.all([
    getActiveUser(),
    getAllInternalUsers(),
    getAllOrganizations(),
    getTasksList(),
  ]);

  const approvalsCount = await getPendingApprovalsCountForRole(currentUser.role);

  const orgSummary = orgs.map((o) => ({ id: o.id, name: o.name }));
  const userSummary = allUsers.map((u) => ({ id: u.id, name: u.name, role: u.role }));

  return (
    <AppShell
      initialUser={currentUser}
      allUsers={allUsers}
      initialApprovalsCount={approvalsCount}
    >
      <div className="container mx-auto p-6 max-w-7xl">
        <TasksClient
          initialTasks={tasks}
          allOrganizations={orgSummary}
          allUsers={userSummary}
        />
      </div>
    </AppShell>
  );
}
