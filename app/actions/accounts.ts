"use server";

import { revalidatePath } from "next/cache";
import { getActiveUser } from "@/lib/auth";
import { assertPermission } from "@/lib/permissions/guard";
import { can } from "@/lib/permissions/can";
import {
  exportAccountsCsv,
  updateTicketStatus,
  createOrgTask,
} from "@/lib/services/accounts";
import { requestChange } from "@/lib/services/approvals";

/**
 * Audit-logged CSV export Server Action
 */
export async function exportAccountsCsvAction(): Promise<{
  success: boolean;
  csv?: string;
  error?: string;
}> {
  try {
    const user = await getActiveUser();
    const csv = await exportAccountsCsv({
      id: user.id,
      role: user.role,
      name: user.name,
    });
    return { success: true, csv };
  } catch (err: any) {
    console.error("Export CSV error:", err);
    return { success: false, error: err.message || "Failed to export accounts CSV" };
  }
}

/**
 * Support / Admin ticket status change
 */
export async function updateTicketStatusAction(input: {
  ticketId: string;
  orgId: string;
  status: "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
  note?: string;
}) {
  try {
    const user = await getActiveUser();
    await assertPermission(user.id, "tickets:manage");

    const result = await updateTicketStatus({
      ...input,
      actorId: user.id,
      actorRole: user.role,
    });

    revalidatePath(`/accounts/${input.orgId}`);
    return { success: true };
  } catch (err: any) {
    console.error("Update ticket status error:", err);
    return { success: false, error: err.message || "Failed to update ticket status" };
  }
}

/**
 * Create task for organization
 */
export async function createOrgTaskAction(input: {
  orgId: string;
  assignedTo: string;
  title: string;
  dueAt?: string;
}) {
  try {
    const user = await getActiveUser();
    await assertPermission(user.id, "tasks:create");

    const result = await createOrgTask({
      orgId: input.orgId,
      assignedTo: input.assignedTo,
      title: input.title,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      actorId: user.id,
      actorRole: user.role,
    });

    revalidatePath(`/accounts/${input.orgId}`);
    return { success: true, taskId: result.taskId };
  } catch (err: any) {
    console.error("Create task error:", err);
    return { success: false, error: err.message || "Failed to create task" };
  }
}

/**
 * Suspend account through maker-checker pipeline
 */
export async function requestOrgSuspensionAction(input: {
  orgId: string;
  reason: string;
}) {
  try {
    const user = await getActiveUser();
    await assertPermission(user.id, "account:request_suspension");

    const result = await requestChange({
      type: "account_suspension",
      targetType: "organization",
      targetId: input.orgId,
      payload: {
        suspendedBy: user.id,
      },
      reason: input.reason,
      actorId: user.id,
      actorRole: user.role,
    });

    revalidatePath(`/accounts/${input.orgId}`);
    revalidatePath("/accounts");
    revalidatePath("/approvals");

    return {
      success: true,
      status: result.status,
      message: result.message,
      changeRequestId: result.changeRequestId,
    };
  } catch (err: any) {
    console.error("Suspend org error:", err);
    return { success: false, error: err.message || "Failed to request suspension" };
  }
}
