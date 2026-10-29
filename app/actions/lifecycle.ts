"use server";

import { revalidatePath } from "next/cache";
import { getActiveUser } from "@/lib/auth";
import { assertPermission } from "@/lib/permissions/guard";
import {
  createAndOnboardAccount,
  transitionOrgStatus,
  calculatePlanChangeProration,
  OrgLifecycleStatus,
} from "@/lib/services/lifecycle";
import { requestChange } from "@/lib/services/approvals";
import { db } from "@/lib/db";
import { organizations, subscriptions, workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/services/audit";

/**
 * Multi-Step Create & Onboard Server Action (Sales Ops)
 */
export async function createAndOnboardAccountAction(input: {
  name: string;
  legalName: string;
  industry: any;
  city: string;
  billingModel: "prepaid" | "postpaid";
  workspacesList: Array<{
    name: string;
    gstin: string;
    billingState: string;
  }>;
  planId: string;
  discountPct?: number;
  discountReason?: string;
  ownerName: string;
  ownerEmail: string;
}) {
  try {
    const user = await getActiveUser();
    await assertPermission(user.id, "account:create_or_onboard");

    const result = await createAndOnboardAccount({
      ...input,
      actor: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    revalidatePath("/accounts");
    return { success: true, orgId: result.orgId };
  } catch (err: any) {
    console.error("Onboarding error:", err);
    return { success: false, error: err.message || "Failed to onboard organization" };
  }
}

/**
 * Account Lifecycle State Transition Action
 */
export async function transitionOrgStatusAction(input: {
  orgId: string;
  targetStatus: OrgLifecycleStatus;
  reason: string;
  suspensionCategory?: "non_payment" | "compliance_violation" | "customer_request" | "fraud_suspicion";
  overrideDues?: boolean;
}) {
  try {
    const user = await getActiveUser();

    // Permission guard based on target status
    if (input.targetStatus === "suspended") {
      await assertPermission(user.id, "account:request_suspension");
    } else if (input.targetStatus === "offboarded") {
      await assertPermission(user.id, "account:request_offboarding");
    }

    const result = await transitionOrgStatus({
      ...input,
      actor: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    revalidatePath(`/accounts/${input.orgId}`);
    revalidatePath("/accounts");
    revalidatePath("/approvals");

    return {
      success: true,
      status: result.status,
      message: result.message,
    };
  } catch (err: any) {
    console.error("Transition status error:", err);
    return { success: false, error: err.message || "State transition failed" };
  }
}

/**
 * Plan Change Calculation Action
 */
export async function calculatePlanChangeProrationAction(input: {
  orgId: string;
  targetPlanId: string;
  effectiveWhen: "immediate" | "next_cycle";
}) {
  try {
    const result = await calculatePlanChangeProration(input);
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Plan Change Request Action (Maker-checker enforced)
 */
export async function changePlanAction(input: {
  orgId: string;
  targetPlanId: string;
  effectiveWhen: "immediate" | "next_cycle";
  reason: string;
}) {
  try {
    const user = await getActiveUser();
    await assertPermission(user.id, "account:request_plan_change");

    const now = new Date();
    const result = await requestChange({
      type: "plan_upgrade",
      targetType: "organization",
      targetId: input.orgId,
      payload: {
        targetPlanId: input.targetPlanId,
        effectiveWhen: input.effectiveWhen,
      },
      reason: input.reason,
      actorId: user.id,
      actorRole: user.role,
    });

    // If executed directly, update DB
    if (result.status === "executed") {
      await db
        .update(organizations)
        .set({ planId: input.targetPlanId, updatedAt: now })
        .where(eq(organizations.id, input.orgId));

      const orgWs = await db.select().from(workspaces).where(eq(workspaces.orgId, input.orgId)).all();
      for (const ws of orgWs) {
        await db
          .update(subscriptions)
          .set({ planId: input.targetPlanId })
          .where(eq(subscriptions.workspaceId, ws.id));
      }
    }

    revalidatePath(`/accounts/${input.orgId}`);
    revalidatePath("/accounts");
    return { success: true, status: result.status, message: result.message };
  } catch (err: any) {
    console.error("Change plan error:", err);
    return { success: false, error: err.message || "Failed to change plan" };
  }
}
