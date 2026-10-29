import { db } from "@/lib/db";
import {
  organizations,
  workspaces,
  plans,
  internalUsers,
  workspaceUsers,
  subscriptions,
  kycCases,
  senderIds,
  templates,
  invoices,
  usageDaily,
  auditLog,
  changeRequests,
  Organization,
  Workspace,
} from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { requestChange } from "./approvals";
import { writeAudit } from "./audit";
import { InternalRole } from "@/lib/permissions/roles";

import {
  INDIAN_STATE_GST_CODES,
  GSTIN_REGEX,
  validateGSTIN,
} from "@/lib/validation/gstin";
export { INDIAN_STATE_GST_CODES, GSTIN_REGEX, validateGSTIN };

export type OrgLifecycleStatus =
  | "onboarding"
  | "active"
  | "at_risk"
  | "suspended"
  | "offboarded";

export interface OnboardingChecklistStep {
  id: string;
  title: string;
  description: string;
  ownerRole: string;
  status: "completed" | "in_progress" | "pending" | "failed";
  completedAt?: Date | null;
  deepLink?: string;
}

/**
 * Evaluates the 9-step onboarding checklist for an organization
 */
export async function getOnboardingChecklist(orgId: string): Promise<{
  allCompleted: boolean;
  canGoLive: boolean;
  completionPct: number;
  steps: OnboardingChecklistStep[];
}> {
  const org = await db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  if (!org) {
    throw new Error(`Organization '${orgId}' not found.`);
  }

  const [allWs, allWUsers, allKyc, allSenderIds, allTemplates, allUsage] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.orgId, orgId)).all(),
    db.select().from(workspaceUsers).all(),
    db.select().from(kycCases).all(),
    db.select().from(senderIds).all(),
    db.select().from(templates).all(),
    db.select().from(usageDaily).all(),
  ]);

  const wsIds = new Set(allWs.map((w) => w.id));
  const orgWUsers = allWUsers.filter((u) => wsIds.has(u.workspaceId));
  const orgKyc = allKyc.filter((k) => wsIds.has(k.workspaceId));
  const orgSenderIds = allSenderIds.filter((s) => wsIds.has(s.workspaceId));
  const orgTemplates = allTemplates.filter((t) => wsIds.has(t.workspaceId));
  const orgUsage = allUsage.filter((u) => wsIds.has(u.workspaceId));

  const hasOwner = orgWUsers.some((u) => u.tier === "owner");
  const kycSubmitted = orgKyc.some((k) => k.status !== "not_started");
  const kycApproved = orgKyc.some((k) => k.status === "approved");
  const senderIdApproved = orgSenderIds.some((s) => s.status === "approved");
  const templateApproved = orgTemplates.some((t) => t.status === "approved");
  const firstMessageSent = orgUsage.length > 0;
  const isGoLive = org.status === "active";

  const canGoLive = kycApproved && senderIdApproved && templateApproved;

  const steps: OnboardingChecklistStep[] = [
    {
      id: "org_created",
      title: "Organization & Workspaces Created",
      description: "Organization entity created with legal details and billing entities.",
      ownerRole: "Sales Ops",
      status: "completed",
      completedAt: org.createdAt,
    },
    {
      id: "plan_assigned",
      title: "Subscription Plan Assigned",
      description: "Base tariff card, monthly fee, and included seats configured.",
      ownerRole: "Sales Ops",
      status: org.planId ? "completed" : "pending",
      completedAt: org.createdAt,
    },
    {
      id: "owner_invited",
      title: "Customer Owner Invited",
      description: "Primary administrator workspace user provisioned.",
      ownerRole: "Sales Ops",
      status: hasOwner ? "completed" : "pending",
      completedAt: org.createdAt,
    },
    {
      id: "kyc_submitted",
      title: "KYC Documents Submitted",
      description: "Certificate of Incorporation, GST certificate, and PAN submitted.",
      ownerRole: "Customer",
      status: kycApproved ? "completed" : kycSubmitted ? "in_progress" : "pending",
      deepLink: "compliance",
    },
    {
      id: "kyc_approved",
      title: "Compliance KYC Verification",
      description: "MCA records and GSTIN active status verified by Compliance.",
      ownerRole: "Compliance",
      status: kycApproved ? "completed" : kycSubmitted ? "in_progress" : "pending",
      deepLink: "compliance",
    },
    {
      id: "sender_id_approved",
      title: "TRAI DLT Sender ID Approved",
      description: "6-character registered header verified on telecommunications registry.",
      ownerRole: "Compliance",
      status: senderIdApproved ? "completed" : orgSenderIds.length > 0 ? "in_progress" : "pending",
      deepLink: "compliance",
    },
    {
      id: "template_approved",
      title: "DLT Content Template Approved",
      description: "Transactional or service message template approved with variables.",
      ownerRole: "Compliance",
      status: templateApproved ? "completed" : orgTemplates.length > 0 ? "in_progress" : "pending",
      deepLink: "compliance",
    },
    {
      id: "first_message",
      title: "First Live Message Dispatched",
      description: "Customer integration test verified via API gateway or portal broadcast.",
      ownerRole: "Customer",
      status: firstMessageSent ? "completed" : "pending",
    },
    {
      id: "go_live",
      title: "Go-Live & Production Activation",
      description: "Account status transitioned to Active with full gateway throughput.",
      ownerRole: "Sales Ops / AM",
      status: isGoLive ? "completed" : canGoLive ? "in_progress" : "pending",
    },
  ];

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const completionPct = Math.round((completedCount / steps.length) * 100);

  return {
    allCompleted: completedCount === steps.length,
    canGoLive,
    completionPct,
    steps,
  };
}

/**
 * Validates state transitions adhering strictly to the Relay BMP State Machine
 */
export async function validateStateTransition(
  orgId: string,
  targetStatus: OrgLifecycleStatus,
  context?: {
    suspensionReason?: string;
    overrideDues?: boolean;
    actorRole?: string;
  }
): Promise<{ valid: boolean; error?: string }> {
  const org = await db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  if (!org) return { valid: false, error: "Organization not found." };

  const current = org.status as OrgLifecycleStatus;

  // 1. Same status is a no-op
  if (current === targetStatus) {
    return { valid: false, error: `Account is already in '${targetStatus}' status.` };
  }

  // 2. Offboarded is terminal (cannot transition out)
  if (current === "offboarded") {
    return { valid: false, error: "Account has been offboarded. De-provisioned accounts cannot be reactivated." };
  }

  // 3. ONBOARDING -> ACTIVE
  if (current === "onboarding" && targetStatus === "active") {
    const checklist = await getOnboardingChecklist(orgId);
    if (!checklist.canGoLive) {
      return {
        valid: false,
        error: "Cannot activate account: Mandatory regulatory prerequisites missing. At least one verified KYC case, one approved DLT sender ID, and one approved message template are required before activation.",
      };
    }
    return { valid: true };
  }

  // 4. SUSPENDED -> ACTIVE (Reactivation)
  if (current === "suspended" && targetStatus === "active") {
    // Check if previous suspension was due to non-payment
    const lastSuspensionCr = await db
      .select()
      .from(changeRequests)
      .where(and(eq(changeRequests.targetId, orgId), eq(changeRequests.type, "account_suspension")))
      .orderBy(desc(changeRequests.createdAt))
      .get();

    let isNonPaymentSuspension = false;
    if (lastSuspensionCr) {
      try {
        const payload = JSON.parse(lastSuspensionCr.payload || "{}");
        if (payload.category === "non_payment" || lastSuspensionCr.reason.includes("non_payment")) {
          isNonPaymentSuspension = true;
        }
      } catch {}
    }

    if (org.billingModel === "postpaid") {
      const allWs = await db.select().from(workspaces).where(eq(workspaces.orgId, orgId)).all();
      const wsIds = allWs.map((w) => w.id);
      const allInvoices = await db.select().from(invoices).all();
      const orgInvoices = allInvoices.filter((i) => wsIds.includes(i.workspaceId));
      const overdue = orgInvoices.filter((i) => i.status === "overdue");

      if ((isNonPaymentSuspension || overdue.length > 0) && !context?.overrideDues) {
        return {
          valid: false,
          error: `Cannot reactivate account suspended for non-payment (${overdue.length} overdue invoice(s)). Proof of dues clearance or a Finance Head override is mandatory.`,
        };
      }
    } else if (isNonPaymentSuspension && !context?.overrideDues) {
      return {
        valid: false,
        error: "Cannot reactivate account suspended for non-payment without proof of dues clearance or Finance override.",
      };
    }
    return { valid: true };
  }

  // 5. ANY -> SUSPENDED
  if (targetStatus === "suspended") {
    if (!context?.suspensionReason || context.suspensionReason.trim().length < 10) {
      return { valid: false, error: "A suspension justification of at least 10 characters is mandatory." };
    }
    return { valid: true };
  }

  // 6. ANY -> OFFBOARDED (Admin only)
  if (targetStatus === "offboarded") {
    if (context?.actorRole !== "admin") {
      return { valid: false, error: "Account offboarding requires Platform Administrator authorization." };
    }
    return { valid: true };
  }

  // 7. ACTIVE <-> AT_RISK
  if ((current === "active" && targetStatus === "at_risk") || (current === "at_risk" && targetStatus === "active")) {
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Creates and onboards a new organization via the 5-step wizard
 */
export async function createAndOnboardAccount(input: {
  // Step 1: Org Details
  name: string;
  legalName: string;
  industry: "BFSI" | "Insurance" | "D2C" | "Edtech" | "Fintech" | "Healthcare" | "Travel" | "Logistics";
  city: string;
  billingModel: "prepaid" | "postpaid";
  // Step 2: Workspaces
  workspacesList: Array<{
    name: string;
    gstin: string;
    billingState: string;
  }>;
  // Step 3: Plan & Pricing
  planId: string;
  discountPct?: number;
  discountReason?: string;
  // Step 4: Owner Invite
  ownerName: string;
  ownerEmail: string;
  ownerAmId?: string;
  // Actor
  actor: {
    id: string;
    name: string;
    role: InternalRole;
  };
}) {
  const orgId = `org_${input.name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 16)}_${Math.random().toString(36).substring(2, 6)}`;
  const baseSlug = input.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  let slug = baseSlug;
  const existingOrg = await db.select().from(organizations).where(eq(organizations.slug, slug)).get();
  if (existingOrg) {
    slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
  }

  const now = new Date();
  const contractEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const assignedAm = input.ownerAmId || (input.actor.role === "account_manager" ? input.actor.id : "usr_am_ananya");

  // 1. Insert Organization (Status: onboarding)
  await db.insert(organizations).values({
    id: orgId,
    name: input.name.trim(),
    legalName: input.legalName.trim().toUpperCase(),
    slug,
    industry: input.industry,
    city: input.city.trim(),
    ownerAmId: assignedAm,
    status: "onboarding",
    billingModel: input.billingModel,
    planId: input.planId,
    contractStart: now,
    contractEnd,
    tags: JSON.stringify(["new_onboard", input.industry.toLowerCase()]),
    createdAt: now,
    updatedAt: now,
  });

  const createdWorkspaces: string[] = [];

  // 2. Insert Workspaces (Status: kyc_pending)
  for (let i = 0; i < input.workspacesList.length; i++) {
    const ws = input.workspacesList[i];
    const wsId = `ws_${orgId.replace("org_", "")}_${i + 1}`;
    const wsSlug = `${slug}-${ws.billingState.toLowerCase().replace(/\s+/g, "")}`;

    await db.insert(workspaces).values({
      id: wsId,
      orgId,
      name: ws.name.trim(),
      slug: wsSlug,
      status: "kyc_pending",
      gstin: ws.gstin.trim().toUpperCase(),
      billingState: ws.billingState,
      walletBalance: input.billingModel === "prepaid" ? 10000 : 0, // Initial welcome credit
      creditLimit: input.billingModel === "postpaid" ? 500000 : 0, // Initial base limit
      creditUsed: 0,
      createdAt: now,
      updatedAt: now,
    });

    createdWorkspaces.push(wsId);

    // Insert Subscription
    await db.insert(subscriptions).values({
      workspaceId: wsId,
      planId: input.planId,
      discountPct: input.discountPct || 0,
      discountReason: input.discountReason || null,
      effectiveFrom: now,
    });

    // Insert Owner User
    await db.insert(workspaceUsers).values({
      id: `usr_ws_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: wsId,
      name: input.ownerName.trim(),
      email: input.ownerEmail.trim().toLowerCase(),
      tier: "owner",
      seatActive: true,
      isSeatPaid: true,
      createdAt: now,
    });
  }

  // Audit Log
  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "organization_onboarded",
    targetType: "organization",
    targetId: orgId,
    orgId,
    reason: `Created and onboarded new customer entity '${input.name}' with ${createdWorkspaces.length} workspace(s).`,
    after: {
      orgId,
      planId: input.planId,
      billingModel: input.billingModel,
      workspaces: createdWorkspaces,
    },
  });

  return { success: true, orgId, workspaces: createdWorkspaces };
}

/**
 * Executes or routes an Account Lifecycle Transition
 */
export async function transitionOrgStatus(input: {
  orgId: string;
  targetStatus: OrgLifecycleStatus;
  reason: string;
  suspensionCategory?: "non_payment" | "compliance_violation" | "customer_request" | "fraud_suspicion";
  overrideDues?: boolean;
  actor: {
    id: string;
    role: InternalRole;
    name: string;
  };
}) {
  const check = await validateStateTransition(input.orgId, input.targetStatus, {
    suspensionReason: input.reason,
    overrideDues: input.overrideDues,
    actorRole: input.actor.role,
  });

  if (!check.valid) {
    throw new Error(check.error || "Invalid state transition.");
  }

  const org = await db.select().from(organizations).where(eq(organizations.id, input.orgId)).get();
  if (!org) throw new Error("Organization not found");

  const now = new Date();

  // If transition is to SUSPENDED, use requestChange maker-checker pipeline
  if (input.targetStatus === "suspended") {
    return await requestChange({
      type: "account_suspension",
      targetType: "organization",
      targetId: input.orgId,
      payload: {
        category: input.suspensionCategory,
        requestedBy: input.actor.id,
      },
      reason: `[${input.suspensionCategory || "operational"}] ${input.reason}`,
      actorId: input.actor.id,
      actorRole: input.actor.role,
    });
  }

  // If transition is to ACTIVE from suspended
  if (org.status === "suspended" && input.targetStatus === "active") {
    return await requestChange({
      type: "account_reactivation",
      targetType: "organization",
      targetId: input.orgId,
      payload: {
        overrideDues: input.overrideDues ?? false,
      },
      reason: input.reason,
      actorId: input.actor.id,
      actorRole: input.actor.role,
    });
  }

  // Direct state updates for onboarding -> active or active <-> at_risk
  await db
    .update(organizations)
    .set({ status: input.targetStatus, updatedAt: now })
    .where(eq(organizations.id, input.orgId));

  if (input.targetStatus === "active") {
    await db
      .update(workspaces)
      .set({ status: "active", updatedAt: now })
      .where(eq(workspaces.orgId, input.orgId));
  }

  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: `organization_status_${org.status}_to_${input.targetStatus}`,
    targetType: "organization",
    targetId: input.orgId,
    orgId: input.orgId,
    before: { status: org.status },
    after: { status: input.targetStatus },
    reason: input.reason,
  });

  return { status: "executed", message: `Account status updated to ${input.targetStatus}.` };
}

/**
 * Calculates Plan Proration and Seat Downgrade Warnings
 */
export async function calculatePlanChangeProration(input: {
  orgId: string;
  targetPlanId: string;
  effectiveWhen: "immediate" | "next_cycle";
}) {
  const org = await db.select().from(organizations).where(eq(organizations.id, input.orgId)).get();
  if (!org) throw new Error("Organization not found");

  const [currentPlan, targetPlan, allWUsers] = await Promise.all([
    db.select().from(plans).where(eq(plans.id, org.planId)).get(),
    db.select().from(plans).where(eq(plans.id, input.targetPlanId)).get(),
    db.select().from(workspaceUsers).all(),
  ]);

  if (!currentPlan || !targetPlan) throw new Error("Invalid plan selection.");

  const allWs = await db.select().from(workspaces).where(eq(workspaces.orgId, input.orgId)).all();
  const wsIds = new Set(allWs.map((w) => w.id));
  const orgUsers = allWUsers.filter((u) => wsIds.has(u.workspaceId));
  const activeSeats = orgUsers.filter((u) => u.seatActive).length;

  const isDowngrade = targetPlan.baseFeeMonthly < currentPlan.baseFeeMonthly;
  const isSeatExceeded = activeSeats > targetPlan.includedSeats;

  // Proration calculation (assuming 30-day billing cycle, 15 days remaining)
  const daysRemainingInCycle = 15;
  const dailyRateDiff = (targetPlan.baseFeeMonthly - currentPlan.baseFeeMonthly) / 30;
  const prorationAmount = input.effectiveWhen === "immediate" ? Math.round(dailyRateDiff * daysRemainingInCycle) : 0;

  const warnings: string[] = [];
  if (isSeatExceeded) {
    warnings.push(
      `Seat Capacity Warning: Target plan '${targetPlan.name}' includes ${targetPlan.includedSeats} seats, but customer currently has ${activeSeats} active seats. Extra seats will be billed at ₹1,500/seat/month.`
    );
  }

  // Model migration warning
  if (targetPlan.billingModel !== "both" && targetPlan.billingModel !== org.billingModel) {
    warnings.push(
      `Billing Model Transition: Target plan requires '${targetPlan.billingModel}', migrating account from '${org.billingModel}'. Postpaid migration mandates Finance Head approval.`
    );
  }

  return {
    currentPlanName: currentPlan.name,
    targetPlanName: targetPlan.name,
    currentBaseFee: currentPlan.baseFeeMonthly,
    targetBaseFee: targetPlan.baseFeeMonthly,
    prorationAmount,
    isDowngrade,
    activeSeats,
    targetIncludedSeats: targetPlan.includedSeats,
    warnings,
  };
}
