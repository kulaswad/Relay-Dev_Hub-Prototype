import { db } from "@/lib/db";
import {
  changeRequests,
  approvalPolicies,
  workspaces,
  organizations,
  invoices,
  subscriptions,
  creditHistory,
  walletTransactions,
  kycCases,
  plans,
} from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "./audit";
import { InternalRole } from "@/lib/permissions/roles";

export type ChangeRequestType =
  | "credit_limit_increase"
  | "wallet_adjustment"
  | "custom_discount"
  | "account_suspension"
  | "account_reactivation"
  | "account_offboarding"
  | "plan_upgrade"
  | "kyc_approval";

export interface RequestChangeInput {
  type: ChangeRequestType;
  targetType: "workspace" | "organization";
  targetId: string;
  payload: Record<string, any>;
  reason: string;
  actorId: string;
  actorRole: InternalRole;
}

export interface PolicyEvaluationResult {
  needsApproval: boolean;
  policyId?: string;
  policyName?: string;
  policyDescription?: string;
  approverRoleNeeded?: InternalRole;
}

/**
 * Evaluates configured approval policies from database (fallback to defaults)
 */
export async function evaluatePolicy(
  type: ChangeRequestType,
  payload: Record<string, any>,
  targetType: "workspace" | "organization",
  targetId: string
): Promise<PolicyEvaluationResult> {
  const policies = await db.select().from(approvalPolicies).where(eq(approvalPolicies.isActive, true));

  // 1. Credit Limit Increase
  if (type === "credit_limit_increase") {
    const ws = await db.select().from(workspaces).where(eq(workspaces.id, targetId)).get();
    const currentLimit = ws ? ws.creditLimit : Number(payload.currentCreditLimit || 0);
    const currentUsed = ws ? ws.creditUsed : 0;
    const newLimit = Number(payload.newCreditLimit || 0);
    const diff = newLimit - currentLimit;
    const pctIncrease = currentLimit > 0 ? (diff / currentLimit) * 100 : 100;

    // Hard rule: Limit cannot be set below current used without explicit Finance Head approval
    if (newLimit < currentUsed) {
      return {
        needsApproval: true,
        policyId: "pol_credit_limit_below_used",
        policyName: "Limit Below Current Used",
        policyDescription: `Proposed credit limit (₹${newLimit.toLocaleString("en-IN")}) is less than current utilized credit (₹${currentUsed.toLocaleString("en-IN")}). Requires explicit Finance Head approval.`,
        approverRoleNeeded: "finance_head",
      };
    }

    // Check overdue invoices for workspace or organization
    const orgId = ws ? ws.orgId : targetId;
    const wsInOrg = await db.select().from(workspaces).where(eq(workspaces.orgId, orgId)).all();
    const wsIds = wsInOrg.map((w) => w.id);
    const allInvoices = await db.select().from(invoices).all();
    const hasOverdue = allInvoices.some(
      (inv) => wsIds.includes(inv.workspaceId) && inv.status === "overdue"
    );

    if (hasOverdue) {
      return {
        needsApproval: true,
        policyId: "pol_credit_overdue_invoice",
        policyName: "Overdue Invoice Guard",
        policyDescription: "Any credit limit increase for an account with overdue invoices requires Finance Head approval.",
        approverRoleNeeded: "finance_head",
      };
    }

    if (diff > 500000) {
      return {
        needsApproval: true,
        policyId: "pol_credit_limit_amount",
        policyName: "Credit Hike > ₹5,00,000",
        policyDescription: `Credit limit increase of ₹${diff.toLocaleString("en-IN")} exceeds the ₹5,00,000 auto-approval ceiling.`,
        approverRoleNeeded: "finance_head",
      };
    }

    if (pctIncrease > 25) {
      return {
        needsApproval: true,
        policyId: "pol_credit_limit_pct",
        policyName: "Credit Hike > 25%",
        policyDescription: `Credit limit expansion of ${pctIncrease.toFixed(1)}% exceeds the 25% single-step policy limit.`,
        approverRoleNeeded: "finance_head",
      };
    }

    return { needsApproval: false };
  }

  // 2. Manual Wallet Adjustment
  if (type === "wallet_adjustment") {
    const amount = Math.abs(Number(payload.amount || 0));
    if (amount > 50000) {
      return {
        needsApproval: true,
        policyId: "pol_wallet_adjustment",
        policyName: "Manual Adjustment > ₹50,000",
        policyDescription: `Manual adjustment of ₹${amount.toLocaleString("en-IN")} exceeds ₹50,000 threshold.`,
        approverRoleNeeded: "finance_head",
      };
    }
    return { needsApproval: false };
  }

  // 3. Custom Discount & Price Floors
  if (type === "custom_discount") {
    const discountPct = Number(payload.discountPct || 0);
    let floorBreached = false;
    let floorBreachReason = "";

    // Check price floors if custom overrides provided
    if (payload.customPriceOverrides) {
      const overrides = typeof payload.customPriceOverrides === "string" 
        ? JSON.parse(payload.customPriceOverrides) 
        : payload.customPriceOverrides;
      
      const sub = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, targetId)).get();
      const planId = payload.planId || sub?.planId || "plan_growth";
      const plan = await db.select().from(plans).where(eq(plans.id, planId)).get();
      if (plan && plan.priceFloors) {
        try {
          const floors = JSON.parse(plan.priceFloors);
          for (const channel of ["sms", "rcs", "whatsapp"] as const) {
            if (overrides[channel] !== undefined && Number(overrides[channel]) < Number(floors[channel])) {
              floorBreached = true;
              floorBreachReason = `Proposed ${channel.toUpperCase()} rate (₹${Number(overrides[channel]).toFixed(2)}) is below the regulatory floor of ₹${Number(floors[channel]).toFixed(2)}.`;
              break;
            }
          }
        } catch {}
      }
    }

    if (discountPct > 15 || floorBreached) {
      return {
        needsApproval: true,
        policyId: floorBreached ? "pol_price_floor_breach" : "pol_discount_pct",
        policyName: floorBreached ? "Rate Below Price Floor" : "Discount > 15%",
        policyDescription: floorBreached 
          ? floorBreachReason 
          : `Proposed commercial discount of ${discountPct}% requires Sales Ops Manager approval.`,
        approverRoleNeeded: "sales_ops",
      };
    }
    return { needsApproval: false };
  }

  // 4. Account Suspension
  if (type === "account_suspension") {
    const org = await db.select().from(organizations).where(eq(organizations.id, targetId)).get();
    if (org && org.billingModel === "postpaid") {
      const orgWs = await db.select().from(workspaces).where(eq(workspaces.orgId, org.id)).all();
      const hasDues = orgWs.some((w) => w.creditUsed > 0);
      if (hasDues) {
        return {
          needsApproval: true,
          policyId: "pol_suspension_postpaid_due",
          policyName: "Postpaid Suspension with Dues",
          policyDescription: "Postpaid account has outstanding credit usage. Finance Head approval required before suspension.",
          approverRoleNeeded: "finance_head",
        };
      }
    }

    return {
      needsApproval: true,
      policyId: "pol_suspension_standard",
      policyName: "Account Suspension Review",
      policyDescription: "Suspending customer services requires Admin authorization.",
      approverRoleNeeded: "admin",
    };
  }

  // 5. Account Offboarding
  if (type === "account_offboarding") {
    return {
      needsApproval: true,
      policyId: "pol_offboarding",
      policyName: "Customer Offboarding Approval",
      policyDescription: "Full customer contract termination and de-provisioning always requires Admin sign-off.",
      approverRoleNeeded: "admin",
    };
  }

  // 6. Plan Upgrade
  if (type === "plan_upgrade") {
    return {
      needsApproval: true,
      policyId: "pol_plan_change",
      policyName: "Plan Tier Modification",
      policyDescription: "Contractual plan modifications require Admin / Sales Ops approval.",
      approverRoleNeeded: "admin",
    };
  }

  // 7. KYC Approval
  if (type === "kyc_approval") {
    return {
      needsApproval: true,
      policyId: "pol_kyc_approval",
      policyName: "KYC Compliance Sign-off",
      policyDescription: "Regulatory documents must be validated by Compliance officer (maker != checker).",
      approverRoleNeeded: "compliance",
    };
  }

  return { needsApproval: false };
}

/**
 * Direct execution helper for mutations
 */
export async function executeMutation(
  type: ChangeRequestType,
  targetType: "workspace" | "organization",
  targetId: string,
  payload: Record<string, any>,
  actorId: string
) {
  const now = new Date();

  if (type === "credit_limit_increase") {
    const currentWs = await db.select().from(workspaces).where(eq(workspaces.id, targetId)).get();
    const oldLimit = currentWs ? currentWs.creditLimit : 0;
    const newLimit = Number(payload.newCreditLimit);

    await db
      .update(workspaces)
      .set({ creditLimit: newLimit, updatedAt: now })
      .where(eq(workspaces.id, targetId));

    await db.insert(creditHistory).values({
      id: `ch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: targetId,
      oldLimit,
      newLimit,
      reason: payload.reason || "Approved credit limit adjustment",
      changedBy: payload.requestedBy || actorId,
      approvedBy: actorId,
      createdAt: now,
    });

    return { oldLimit, newLimit };
  }

  if (type === "wallet_adjustment") {
    const currentWs = await db.select().from(workspaces).where(eq(workspaces.id, targetId)).get();
    if (!currentWs) throw new Error("Workspace not found");

    const org = await db.select().from(organizations).where(eq(organizations.id, currentWs.orgId)).get();
    const isPostpaid = org?.billingModel === "postpaid";
    const adjustmentAmount = Number(payload.amount);

    if (isPostpaid) {
      const currentUsed = currentWs.creditUsed;
      const newUsed = Math.max(0, currentUsed - adjustmentAmount);

      await db
        .update(workspaces)
        .set({ creditUsed: newUsed, updatedAt: now })
        .where(eq(workspaces.id, targetId));

      await db.insert(creditHistory).values({
        id: `ch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: targetId,
        oldLimit: currentWs.creditLimit,
        newLimit: currentWs.creditLimit,
        reason: `[ADJUSTMENT - ${payload.reasonCode || "OPERATIONAL"}] ${payload.reason || "Approved adjustment"}: credit used changed from ₹${currentUsed.toLocaleString("en-IN")} to ₹${newUsed.toLocaleString("en-IN")}`,
        changedBy: payload.requestedBy || actorId,
        approvedBy: actorId,
        createdAt: now,
      });

      return { oldUsed: currentUsed, newUsed };
    } else {
      const currentBalance = currentWs.walletBalance;
      const newBalance = currentBalance + adjustmentAmount;
      if (newBalance < 0) {
        throw new Error("Financial Constraint: Wallet balance cannot become negative from an adjustment.");
      }

      await db
        .update(workspaces)
        .set({ walletBalance: newBalance, updatedAt: now })
        .where(eq(workspaces.id, targetId));

      await db.insert(walletTransactions).values({
        id: `wt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: targetId,
        type: "adjustment",
        amount: adjustmentAmount,
        balanceAfter: newBalance,
        reference: `ADJUSTMENT_${payload.reasonCode ? payload.reasonCode.toUpperCase() : "OPS"}_${actorId}`,
        createdBy: actorId,
        createdAt: now,
      });

      return { oldBalance: currentBalance, newBalance };
    }
  }

  if (type === "custom_discount") {
    const discountPct = Number(payload.discountPct || 0);
    const updates: any = {
      discountPct,
      discountReason: payload.reason || "Approved custom discount",
    };
    if (payload.planId) updates.planId = payload.planId;
    if (payload.customPriceOverrides !== undefined) {
      updates.customPriceOverrides = typeof payload.customPriceOverrides === "string"
        ? payload.customPriceOverrides
        : JSON.stringify(payload.customPriceOverrides);
    }
    if (payload.discountEndDate) {
      updates.discountEndDate = new Date(payload.discountEndDate);
    }
    await db
      .update(subscriptions)
      .set(updates)
      .where(eq(subscriptions.workspaceId, targetId));

    if (payload.planId) {
      const ws = await db.select().from(workspaces).where(eq(workspaces.id, targetId)).get();
      if (ws) {
        await db
          .update(organizations)
          .set({ planId: payload.planId, updatedAt: now })
          .where(eq(organizations.id, ws.orgId));
      }
    }

    return { discountPct, planId: payload.planId, customPriceOverrides: payload.customPriceOverrides };
  }

  if (type === "account_suspension") {
    await db
      .update(organizations)
      .set({ status: "suspended", updatedAt: now })
      .where(eq(organizations.id, targetId));

    await db
      .update(workspaces)
      .set({ status: "suspended", updatedAt: now })
      .where(eq(workspaces.orgId, targetId));

    return { status: "suspended" };
  }

  if (type === "account_reactivation") {
    await db
      .update(organizations)
      .set({ status: "active", updatedAt: now })
      .where(eq(organizations.id, targetId));

    await db
      .update(workspaces)
      .set({ status: "active", updatedAt: now })
      .where(eq(workspaces.orgId, targetId));

    return { status: "active" };
  }

  if (type === "kyc_approval") {
    await db
      .update(kycCases)
      .set({ status: "approved" })
      .where(eq(kycCases.id, targetId));

    const kyc = await db.select().from(kycCases).where(eq(kycCases.id, targetId)).get();
    if (kyc) {
      await db
        .update(workspaces)
        .set({ status: "active", updatedAt: now })
        .where(eq(workspaces.id, kyc.workspaceId));
    }
    return { status: "approved" };
  }

  return { success: true };
}

/**
 * Universal maker-checker audited mutation entrypoint.
 * Every critical change in BMP goes through this pipeline.
 */
export async function requestChange(input: RequestChangeInput): Promise<{
  status: "executed" | "pending";
  changeRequestId?: string;
  approverRole?: InternalRole;
  policyName?: string;
  executionResult?: any;
  message: string;
}> {
  if (!input.reason || input.reason.trim().length < 10) {
    throw new Error("Compliance Policy: An audit reason of at least 10 characters is mandatory.");
  }

  // 1. Evaluate Maker-Checker Policy
  const policy = await evaluatePolicy(input.type, input.payload, input.targetType, input.targetId);

  // Case A: Below threshold -> Executes immediately
  if (!policy.needsApproval) {
    const result = await executeMutation(input.type, input.targetType, input.targetId, input.payload, input.actorId);

    await writeAudit({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: `${input.type}_direct_executed`,
      targetType: input.targetType,
      targetId: input.targetId,
      orgId: input.targetType === "organization" ? input.targetId : null,
      before: input.payload.currentCreditLimit ? { creditLimit: input.payload.currentCreditLimit } : null,
      after: result,
      reason: input.reason.trim(),
    });

    return {
      status: "executed",
      executionResult: result,
      message: "Action executed immediately within authorized operational thresholds.",
    };
  }

  // Case B: Requires second-person approval -> Creates change_request
  const requestId = `cr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours SLA expiry

  const payloadWithMeta = {
    ...input.payload,
    policyId: policy.policyId,
    policyName: policy.policyName,
    policyDescription: policy.policyDescription,
  };

  await db.insert(changeRequests).values({
    id: requestId,
    type: input.type,
    targetType: input.targetType,
    targetId: input.targetId,
    payload: JSON.stringify(payloadWithMeta),
    status: "pending",
    requestedBy: input.actorId,
    approverRoleNeeded: policy.approverRoleNeeded!,
    reason: input.reason.trim(),
    createdAt: now,
    expiresAt,
  });

  await writeAudit({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: `${input.type}_approval_requested`,
    targetType: input.targetType,
    targetId: input.targetId,
    changeRequestId: requestId,
    before: null,
    after: payloadWithMeta,
    reason: input.reason.trim(),
  });

  return {
    status: "pending",
    changeRequestId: requestId,
    approverRole: policy.approverRoleNeeded,
    policyName: policy.policyName,
    message: `Triggered policy '${policy.policyName}'. Pending maker-checker approval from ${policy.approverRoleNeeded}.`,
  };
}

/**
 * Approve pending change request (Checker)
 */
export async function approveChangeRequest(input: {
  requestId: string;
  actorId: string;
  actorRole: InternalRole;
  note?: string;
}) {
  const cr = await db.select().from(changeRequests).where(eq(changeRequests.id, input.requestId)).get();

  if (!cr) throw new Error("Change request not found.");
  if (cr.status !== "pending") throw new Error(`Change request is already ${cr.status}.`);

  // Maker-checker rule: Requester cannot approve their own request
  if (cr.requestedBy === input.actorId) {
    try {
      await writeAudit({
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: "maker_checker_violation",
        targetType: cr.targetType,
        targetId: cr.targetId,
        changeRequestId: cr.id,
        reason: "Maker-checker violation: Requester attempted to self-approve their own change request.",
        isDenied: true,
      });
    } catch {}
    throw new Error("Maker-Checker Violation: You cannot approve your own request. A second team member must review.");
  }

  // Role validation
  if (input.actorRole !== "admin" && input.actorRole !== cr.approverRoleNeeded) {
    try {
      await writeAudit({
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: "permission_denied",
        targetType: cr.targetType,
        targetId: cr.targetId,
        changeRequestId: cr.id,
        reason: `Unauthorized: This request requires role '${cr.approverRoleNeeded}'. You are '${input.actorRole}'.`,
        isDenied: true,
      });
    } catch {}
    throw new Error(`Unauthorized: This request requires role '${cr.approverRoleNeeded}'. You are '${input.actorRole}'.`);
  }

  // Expiry check
  if (cr.expiresAt && cr.expiresAt.getTime() < Date.now()) {
    await db.update(changeRequests).set({ status: "cancelled", decisionNote: "Expired (72h SLA passed)" }).where(eq(changeRequests.id, cr.id));
    throw new Error("Change request has expired (>72 hours). Please submit a fresh request.");
  }

  const payload = JSON.parse(cr.payload);
  const decisionNote = input.note?.trim() || "Approved as per operational guidelines.";

  // Execute mutation
  const execResult = await executeMutation(
    cr.type as ChangeRequestType,
    cr.targetType as any,
    cr.targetId,
    { ...payload, requestedBy: cr.requestedBy, reason: cr.reason },
    input.actorId
  );

  const now = new Date();
  await db
    .update(changeRequests)
    .set({
      status: "approved",
      approvedBy: input.actorId,
      decisionNote,
      decidedAt: now,
    })
    .where(eq(changeRequests.id, cr.id));

  // Audit entry with both actors
  await writeAudit({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: `${cr.type}_approved_and_executed`,
    targetType: cr.targetType,
    targetId: cr.targetId,
    changeRequestId: cr.id,
    before: { maker: cr.requestedBy, status: "pending" },
    after: { checker: input.actorId, executionResult: execResult, decisionNote },
    reason: `Checker approved request originally made by ${cr.requestedBy}. Note: ${decisionNote}`,
  });

  return { success: true, executionResult: execResult };
}

/**
 * Reject pending change request
 */
export async function rejectChangeRequest(input: {
  requestId: string;
  actorId: string;
  actorRole: InternalRole;
  note: string;
}) {
  if (!input.note || input.note.trim().length < 5) {
    throw new Error("A rejection reason of at least 5 characters is required.");
  }

  const cr = await db.select().from(changeRequests).where(eq(changeRequests.id, input.requestId)).get();
  if (!cr) throw new Error("Change request not found.");
  if (cr.status !== "pending") throw new Error(`Change request is already ${cr.status}.`);

  if (input.actorRole !== "admin" && input.actorRole !== cr.approverRoleNeeded) {
    try {
      await writeAudit({
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: "permission_denied",
        targetType: cr.targetType,
        targetId: cr.targetId,
        changeRequestId: cr.id,
        reason: `Unauthorized: Role '${input.actorRole}' cannot reject this request. Requires '${cr.approverRoleNeeded}'.`,
        isDenied: true,
      });
    } catch {}
    throw new Error(`Unauthorized: Role '${input.actorRole}' cannot review this request. Requires '${cr.approverRoleNeeded}'.`);
  }

  const now = new Date();
  await db
    .update(changeRequests)
    .set({
      status: "rejected",
      approvedBy: input.actorId,
      decisionNote: input.note.trim(),
      decidedAt: now,
    })
    .where(eq(changeRequests.id, cr.id));

  await writeAudit({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: `${cr.type}_rejected`,
    targetType: cr.targetType,
    targetId: cr.targetId,
    changeRequestId: cr.id,
    before: { status: "pending" },
    after: { status: "rejected", decisionNote: input.note.trim() },
    reason: input.note.trim(),
  });

  return { success: true };
}

/**
 * Cancel own pending change request
 */
export async function cancelChangeRequest(input: {
  requestId: string;
  actorId: string;
}) {
  const cr = await db.select().from(changeRequests).where(eq(changeRequests.id, input.requestId)).get();
  if (!cr) throw new Error("Change request not found.");
  if (cr.status !== "pending") throw new Error("Can only cancel pending requests.");

  if (cr.requestedBy !== input.actorId) {
    try {
      await writeAudit({
        actorId: input.actorId,
        actorRole: "requester",
        action: "permission_denied",
        targetType: cr.targetType,
        targetId: cr.targetId,
        changeRequestId: cr.id,
        reason: "Unauthorized attempt to cancel change request: Only the original requester can cancel.",
        isDenied: true,
      });
    } catch {}
    throw new Error("Only the original requester can cancel this pending request.");
  }

  const now = new Date();
  await db
    .update(changeRequests)
    .set({
      status: "cancelled",
      decidedAt: now,
      decisionNote: "Cancelled by requester.",
    })
    .where(eq(changeRequests.id, cr.id));

  await writeAudit({
    actorId: input.actorId,
    actorRole: "requester",
    action: `${cr.type}_cancelled_by_maker`,
    targetType: cr.targetType,
    targetId: cr.targetId,
    changeRequestId: cr.id,
    reason: "Maker cancelled pending change request before review.",
  });

  return { success: true };
}

export async function getAllChangeRequests() {
  const now = new Date();
  const all = await db.select().from(changeRequests).orderBy(desc(changeRequests.createdAt)).all();
  
  for (const cr of all) {
    if (cr.status === "pending" && cr.expiresAt && cr.expiresAt.getTime() < now.getTime()) {
      await db
        .update(changeRequests)
        .set({ status: "cancelled", decisionNote: "Expired (72h SLA passed)" })
        .where(eq(changeRequests.id, cr.id));
      cr.status = "cancelled";
      cr.decisionNote = "Expired (72h SLA passed)";
    }
  }

  return all;
}

/**
 * Query pending approvals count for a specific role
 */
export async function getPendingApprovalsCountForRole(role: InternalRole): Promise<number> {
  const all = await getAllChangeRequests();
  const pending = all.filter((cr) => cr.status === "pending");

  if (role === "admin") return pending.length;
  return pending.filter((cr) => cr.approverRoleNeeded === role).length;
}

export async function getPendingApprovalsCount(): Promise<number> {
  return await getPendingApprovalsCountForRole("admin");
}
