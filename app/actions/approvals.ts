"use server";

import { revalidatePath } from "next/cache";
import { getActiveUser } from "@/lib/auth";
import { assertPermission } from "@/lib/permissions/guard";
import {
  requestChange,
  approveChangeRequest,
  rejectChangeRequest,
  cancelChangeRequest,
} from "@/lib/services/approvals";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Server action to request a credit limit change on a workspace.
 * Evaluates policies and either executes directly or creates a pending change request.
 */
export async function requestCreditLimitIncreaseAction(input: {
  workspaceId: string;
  newCreditLimit: number;
  reason: string;
}) {
  const actor = await getActiveUser();

  // Server-side permission assertion
  await assertPermission(actor.id, "credit:request_limit_change");

  const ws = await db.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).get();
  if (!ws) {
    throw new Error("Workspace not found.");
  }

  const result = await requestChange({
    type: "credit_limit_increase",
    targetType: "workspace",
    targetId: input.workspaceId,
    payload: {
      workspaceName: ws.name,
      currentCreditLimit: ws.creditLimit,
      newCreditLimit: input.newCreditLimit,
      requestedCreditLimit: input.newCreditLimit,
    },
    reason: input.reason,
    actorId: actor.id,
    actorRole: actor.role,
  });

  revalidatePath("/", "layout");
  revalidatePath("/approvals");
  return result;
}

/**
 * Server action to approve a pending change request (Checker)
 */
export async function approveChangeRequestAction(input: {
  requestId: string;
  note?: string;
}) {
  const actor = await getActiveUser();

  const result = await approveChangeRequest({
    requestId: input.requestId,
    actorId: actor.id,
    actorRole: actor.role,
    note: input.note,
  });

  revalidatePath("/", "layout");
  revalidatePath("/approvals");
  return result;
}

/**
 * Server action to reject a pending change request
 */
export async function rejectChangeRequestAction(input: {
  requestId: string;
  note: string;
}) {
  const actor = await getActiveUser();

  const result = await rejectChangeRequest({
    requestId: input.requestId,
    actorId: actor.id,
    actorRole: actor.role,
    note: input.note,
  });

  revalidatePath("/", "layout");
  revalidatePath("/approvals");
  return result;
}

/**
 * Server action to cancel own pending request (Maker)
 */
export async function cancelChangeRequestAction(input: {
  requestId: string;
}) {
  const actor = await getActiveUser();

  const result = await cancelChangeRequest({
    requestId: input.requestId,
    actorId: actor.id,
  });

  revalidatePath("/", "layout");
  revalidatePath("/approvals");
  return result;
}
