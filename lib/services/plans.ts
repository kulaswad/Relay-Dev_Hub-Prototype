import { db } from "@/lib/db";
import {
  plans,
  subscriptions,
  addonCatalog,
  workspaceAddons,
  workspaces,
  organizations,
  workspaceUsers,
  usageDaily,
  walletTransactions,
  invoices,
  auditLog,
  changeRequests,
} from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { writeAudit } from "./audit";
import { requestChange } from "./approvals";
import { InternalRole } from "@/lib/permissions/roles";

export interface PlanCatalogItem {
  id: string;
  name: string;
  billingModel: "prepaid" | "postpaid" | "both";
  baseFeeMonthly: number;
  includedSeats: number;
  throughputMps: number;
  perMessageRates: {
    sms: number;
    rcs: number;
    whatsapp: number;
  };
  priceFloors: {
    sms: number;
    rcs: number;
    whatsapp: number;
  };
  features: string[];
  workspaceCount: number;
}

export interface WorkspacePricingSummary {
  workspaceId: string;
  workspaceName: string;
  orgId: string;
  orgName: string;
  billingModel: "prepaid" | "postpaid";
  plan: PlanCatalogItem;
  subscription: {
    planId: string;
    discountPct: number;
    discountReason?: string | null;
    discountEndDate?: Date | null;
    customPriceOverrides?: {
      sms?: number;
      rcs?: number;
      whatsapp?: number;
      baseFeeMonthly?: number;
    } | null;
  };
  effectiveRates: {
    sms: { list: number; custom?: number; effective: number; floor: number; discountPct: number };
    rcs: { list: number; custom?: number; effective: number; floor: number; discountPct: number };
    whatsapp: { list: number; custom?: number; effective: number; floor: number; discountPct: number };
    baseFee: { list: number; custom?: number; effective: number };
  };
  usage30d: {
    smsCount: number;
    rcsCount: number;
    whatsappCount: number;
    totalMessages: number;
    currentMonthlySpend: number;
  };
  activeAddons: Array<{
    id: string;
    addonId: string;
    name: string;
    type: "one_time" | "recurring";
    unitPrice: number;
    quantity: number;
    monthlyTotal: number;
    startDate: Date;
    endDate?: Date | null;
  }>;
  seatReconciliation: {
    seatsBilled: number;
    seatsProvisioned: number;
    seatsActive: number;
    seatWasteCount: number;
    seatWasteMonthlyINR: number;
    mismatchDetected: boolean;
    mismatchType: "over_provisioned" | "under_utilized" | "in_sync";
    mismatchMessage: string;
  };
}

/**
 * Returns all pricing plans enriched with live subscribed workspace counts
 */
export async function getPlansCatalog(): Promise<PlanCatalogItem[]> {
  const allPlans = await db.select().from(plans).all();
  const allSubs = await db.select().from(subscriptions).all();

  const countByPlan = new Map<string, number>();
  for (const s of allSubs) {
    countByPlan.set(s.planId, (countByPlan.get(s.planId) || 0) + 1);
  }

  return allPlans.map((p) => {
    let rates = { sms: 0.14, rcs: 0.22, whatsapp: 0.38 };
    let floors = { sms: 0.11, rcs: 0.18, whatsapp: 0.30 };
    let features: string[] = [];

    try {
      if (p.perMessageRates) rates = JSON.parse(p.perMessageRates);
    } catch {}

    try {
      if (p.priceFloors) floors = JSON.parse(p.priceFloors);
    } catch {}

    try {
      if (p.features) features = JSON.parse(p.features);
    } catch {}

    return {
      id: p.id,
      name: p.name,
      billingModel: p.billingModel as "prepaid" | "postpaid" | "both",
      baseFeeMonthly: p.baseFeeMonthly,
      includedSeats: p.includedSeats,
      throughputMps: p.throughputMps,
      perMessageRates: rates,
      priceFloors: floors,
      features,
      workspaceCount: countByPlan.get(p.id) || 0,
    };
  });
}

/**
 * Updates a plan catalog entry (Admin & Sales Ops only)
 */
export async function updatePlanCatalogEntry(input: {
  planId: string;
  baseFeeMonthly?: number;
  includedSeats?: number;
  throughputMps?: number;
  billingModel?: "prepaid" | "postpaid" | "both";
  perMessageRates?: { sms: number; rcs: number; whatsapp: number };
  priceFloors?: { sms: number; rcs: number; whatsapp: number };
  features?: string[];
  reason: string;
  actor: { id: string; role: InternalRole; name: string };
}) {
  if (!input.reason || input.reason.trim().length < 10) {
    throw new Error("Audit Policy: A justification reason of at least 10 characters is mandatory.");
  }

  const existing = await db.select().from(plans).where(eq(plans.id, input.planId)).get();
  if (!existing) throw new Error("Plan not found");

  const updates: any = {};
  if (input.baseFeeMonthly !== undefined) updates.baseFeeMonthly = input.baseFeeMonthly;
  if (input.includedSeats !== undefined) updates.includedSeats = input.includedSeats;
  if (input.throughputMps !== undefined) updates.throughputMps = input.throughputMps;
  if (input.billingModel !== undefined) updates.billingModel = input.billingModel;
  if (input.perMessageRates) updates.perMessageRates = JSON.stringify(input.perMessageRates);
  if (input.priceFloors) updates.priceFloors = JSON.stringify(input.priceFloors);
  if (input.features) updates.features = JSON.stringify(input.features);

  await db.update(plans).set(updates).where(eq(plans.id, input.planId));

  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "plan_catalog_entry_updated",
    targetType: "system",
    targetId: input.planId,
    reason: input.reason.trim(),
    before: existing,
    after: { ...existing, ...updates },
  });

  return { success: true };
}

/**
 * Returns the Addon catalog
 */
export async function getAddonCatalog() {
  return await db.select().from(addonCatalog).all();
}

/**
 * Comprehensive workspace pricing, subscriptions, add-ons, and seat reconciliation single source of truth
 */
export async function getWorkspacePricingAndSeats(workspaceId: string): Promise<WorkspacePricingSummary> {
  const ws = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) throw new Error("Workspace not found");

  const org = await db.select().from(organizations).where(eq(organizations.id, ws.orgId)).get();
  if (!org) throw new Error("Organization not found");

  let sub = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).get();
  if (!sub) {
    // Fallback if subscription missing
    sub = {
      workspaceId,
      planId: org.planId || "plan_growth",
      customPriceOverrides: null,
      discountPct: 0,
      discountReason: null,
      discountEndDate: null,
      effectiveFrom: new Date(),
    };
  }

  const allPlans = await getPlansCatalog();
  const plan = allPlans.find((p) => p.id === sub!.planId) || allPlans[1] || allPlans[0];

  let customOverrides: any = null;
  try {
    if (sub.customPriceOverrides) {
      customOverrides = JSON.parse(sub.customPriceOverrides);
    }
  } catch {}

  const discountPct = Number(sub.discountPct || 0);

  // Compute effective rates per channel
  const smsList = plan.perMessageRates.sms;
  const smsCustom = customOverrides?.sms !== undefined ? Number(customOverrides.sms) : undefined;
  const smsBase = smsCustom !== undefined ? smsCustom : smsList;
  const smsEffective = Math.round(smsBase * (1 - discountPct / 100) * 1000) / 1000;

  const rcsList = plan.perMessageRates.rcs;
  const rcsCustom = customOverrides?.rcs !== undefined ? Number(customOverrides.rcs) : undefined;
  const rcsBase = rcsCustom !== undefined ? rcsCustom : rcsList;
  const rcsEffective = Math.round(rcsBase * (1 - discountPct / 100) * 1000) / 1000;

  const waList = plan.perMessageRates.whatsapp;
  const waCustom = customOverrides?.whatsapp !== undefined ? Number(customOverrides.whatsapp) : undefined;
  const waBase = waCustom !== undefined ? waCustom : waList;
  const waEffective = Math.round(waBase * (1 - discountPct / 100) * 1000) / 1000;

  const baseFeeList = plan.baseFeeMonthly;
  const baseFeeCustom = customOverrides?.baseFeeMonthly !== undefined ? Number(customOverrides.baseFeeMonthly) : undefined;
  const baseFeeEffective = baseFeeCustom !== undefined ? baseFeeCustom : baseFeeList;

  // 30-day usage numbers
  const recentUsage = await db
    .select()
    .from(usageDaily)
    .where(eq(usageDaily.workspaceId, workspaceId))
    .orderBy(desc(usageDaily.date))
    .limit(30)
    .all();

  const smsCount = recentUsage.reduce((acc, u) => acc + (u.smsCount || 0), 0);
  const rcsCount = recentUsage.reduce((acc, u) => acc + (u.rcsCount || 0), 0);
  const whatsappCount = recentUsage.reduce((acc, u) => acc + (u.whatsappCount || 0), 0);
  const totalMessages = smsCount + rcsCount + whatsappCount;

  const currentMonthlySpend =
    baseFeeEffective +
    smsCount * smsEffective +
    rcsCount * rcsEffective +
    whatsappCount * waEffective;

  // Active Add-ons
  const allAddons = await db.select().from(addonCatalog).all();
  const addonMap = new Map(allAddons.map((a) => [a.id, a]));

  const wsAddonRecords = await db
    .select()
    .from(workspaceAddons)
    .where(and(eq(workspaceAddons.workspaceId, workspaceId), eq(workspaceAddons.status, "active")))
    .all();

  const activeAddons = wsAddonRecords.map((rec) => {
    const meta = addonMap.get(rec.addonId);
    const unitPrice = meta ? meta.price : 0;
    return {
      id: rec.id,
      addonId: rec.addonId,
      name: meta?.name || rec.addonId,
      type: (meta?.type || "recurring") as "one_time" | "recurring",
      unitPrice,
      quantity: rec.quantity,
      monthlyTotal: unitPrice * rec.quantity,
      startDate: rec.startDate,
      endDate: rec.endDate,
    };
  });

  // Seat Reconciliation: Single Source of Truth
  // 1. Seats billed = Plan included + Active Additional Seat add-ons
  const seatAddons = activeAddons.filter((a) => a.addonId === "addon_seat");
  const extraSeatsBilled = seatAddons.reduce((acc, a) => acc + a.quantity, 0);
  const seatsBilled = plan.includedSeats + extraSeatsBilled;

  // 2. Seats provisioned = workspace users with seatActive = true
  const users = await db
    .select()
    .from(workspaceUsers)
    .where(eq(workspaceUsers.workspaceId, workspaceId))
    .all();

  const seatsProvisioned = users.filter((u) => u.seatActive).length;

  // 3. Seats active = users who logged in within past 30 days
  const nowMs = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const seatsActive = users.filter((u) => {
    if (!u.seatActive) return false;
    if (!u.lastLoginAt) return false;
    return nowMs - new Date(u.lastLoginAt).getTime() <= THIRTY_DAYS_MS;
  }).length;

  const seatWasteCount = Math.max(0, seatsBilled - seatsActive);
  const seatWasteMonthlyINR = seatWasteCount * 1200;

  let mismatchType: "over_provisioned" | "under_utilized" | "in_sync" = "in_sync";
  let mismatchMessage = "Seats billed match seats provisioned.";

  if (seatsProvisioned > seatsBilled) {
    mismatchType = "over_provisioned";
    const over = seatsProvisioned - seatsBilled;
    mismatchMessage = `Revenue Leakage: ${seatsProvisioned} seats provisioned but only ${seatsBilled} seats billed (${over} unbilled user licenses).`;
  } else if (seatsBilled > seatsProvisioned) {
    mismatchType = "under_utilized";
    const unassigned = seatsBilled - seatsProvisioned;
    mismatchMessage = `${unassigned} paid license seat(s) unassigned. (${seatWasteCount} ghost seats inactive >30 days).`;
  }

  return {
    workspaceId,
    workspaceName: ws.name,
    orgId: org.id,
    orgName: org.name,
    billingModel: org.billingModel as "prepaid" | "postpaid",
    plan,
    subscription: {
      planId: sub.planId,
      discountPct,
      discountReason: sub.discountReason,
      discountEndDate: sub.discountEndDate,
      customPriceOverrides: customOverrides,
    },
    effectiveRates: {
      sms: {
        list: smsList,
        custom: smsCustom,
        effective: smsEffective,
        floor: plan.priceFloors.sms,
        discountPct: smsBase > 0 ? Math.round(((smsList - smsEffective) / smsList) * 1000) / 10 : 0,
      },
      rcs: {
        list: rcsList,
        custom: rcsCustom,
        effective: rcsEffective,
        floor: plan.priceFloors.rcs,
        discountPct: rcsBase > 0 ? Math.round(((rcsList - rcsEffective) / rcsList) * 1000) / 10 : 0,
      },
      whatsapp: {
        list: waList,
        custom: waCustom,
        effective: waEffective,
        floor: plan.priceFloors.whatsapp,
        discountPct: waBase > 0 ? Math.round(((waList - waEffective) / waList) * 1000) / 10 : 0,
      },
      baseFee: {
        list: baseFeeList,
        custom: baseFeeCustom,
        effective: baseFeeEffective,
      },
    },
    usage30d: {
      smsCount,
      rcsCount,
      whatsappCount,
      totalMessages,
      currentMonthlySpend: Math.round(currentMonthlySpend),
    },
    activeAddons,
    seatReconciliation: {
      seatsBilled,
      seatsProvisioned,
      seatsActive,
      seatWasteCount,
      seatWasteMonthlyINR,
      mismatchDetected: seatsBilled !== seatsProvisioned,
      mismatchType,
      mismatchMessage,
    },
  };
}

/**
 * Calculates live estimated monthly bill impact and approval requirements
 */
export async function calculateCustomPricingImpact(input: {
  workspaceId: string;
  proposedPlanId?: string;
  customOverrides?: {
    sms?: number;
    rcs?: number;
    whatsapp?: number;
    baseFeeMonthly?: number;
  };
  discountPct?: number;
}) {
  const current = await getWorkspacePricingAndSeats(input.workspaceId);
  const allPlans = await getPlansCatalog();
  const targetPlan = input.proposedPlanId
    ? allPlans.find((p) => p.id === input.proposedPlanId) || current.plan
    : current.plan;

  const discountPct = Number(input.discountPct || 0);

  // Compute proposed channel rates
  const proposedSmsBase =
    input.customOverrides?.sms !== undefined ? Number(input.customOverrides.sms) : targetPlan.perMessageRates.sms;
  const proposedSmsEffective = Math.round(proposedSmsBase * (1 - discountPct / 100) * 1000) / 1000;

  const proposedRcsBase =
    input.customOverrides?.rcs !== undefined ? Number(input.customOverrides.rcs) : targetPlan.perMessageRates.rcs;
  const proposedRcsEffective = Math.round(proposedRcsBase * (1 - discountPct / 100) * 1000) / 1000;

  const proposedWaBase =
    input.customOverrides?.whatsapp !== undefined
      ? Number(input.customOverrides.whatsapp)
      : targetPlan.perMessageRates.whatsapp;
  const proposedWaEffective = Math.round(proposedWaBase * (1 - discountPct / 100) * 1000) / 1000;

  const proposedBaseFee =
    input.customOverrides?.baseFeeMonthly !== undefined
      ? Number(input.customOverrides.baseFeeMonthly)
      : targetPlan.baseFeeMonthly;

  // Bill impact based on 30d usage
  const proposedMonthlySpend =
    proposedBaseFee +
    current.usage30d.smsCount * proposedSmsEffective +
    current.usage30d.rcsCount * proposedRcsEffective +
    current.usage30d.whatsappCount * proposedWaEffective;

  const deltaINR = Math.round(proposedMonthlySpend - current.usage30d.currentMonthlySpend);
  const deltaPct =
    current.usage30d.currentMonthlySpend > 0
      ? Math.round((deltaINR / current.usage30d.currentMonthlySpend) * 1000) / 10
      : 0;

  // Policy Checks:
  // 1. Discount above 15%
  const discountExceeded = discountPct > 15;

  // 2. Any rate below price floor
  const floorBreaches: string[] = [];
  if (proposedSmsBase < targetPlan.priceFloors.sms) {
    floorBreaches.push(`SMS rate ₹${proposedSmsBase} is below floor ₹${targetPlan.priceFloors.sms}`);
  }
  if (proposedRcsBase < targetPlan.priceFloors.rcs) {
    floorBreaches.push(`RCS rate ₹${proposedRcsBase} is below floor ₹${targetPlan.priceFloors.rcs}`);
  }
  if (proposedWaBase < targetPlan.priceFloors.whatsapp) {
    floorBreaches.push(`WhatsApp rate ₹${proposedWaBase} is below floor ₹${targetPlan.priceFloors.whatsapp}`);
  }

  const requiresApproval = discountExceeded || floorBreaches.length > 0;
  let approvalNotice = "";
  if (requiresApproval) {
    if (floorBreaches.length > 0 && discountExceeded) {
      approvalNotice = `This will need Sales Ops Manager approval (Discount >15% and ${floorBreaches.join(", ")}).`;
    } else if (discountExceeded) {
      approvalNotice = `This will need Sales Ops Manager approval (Commercial discount of ${discountPct}% exceeds the 15% threshold).`;
    } else {
      approvalNotice = `This will need Sales Ops Manager approval (${floorBreaches.join("; ")}).`;
    }
  }

  return {
    currentSpend: current.usage30d.currentMonthlySpend,
    proposedSpend: Math.round(proposedMonthlySpend),
    deltaINR,
    deltaPct,
    requiresApproval,
    approverRole: "sales_ops" as const,
    approvalNotice,
    table: {
      sms: {
        list: targetPlan.perMessageRates.sms,
        custom: proposedSmsBase,
        effective: proposedSmsEffective,
        floor: targetPlan.priceFloors.sms,
        isBelowFloor: proposedSmsBase < targetPlan.priceFloors.sms,
        discountPct: Math.round(((targetPlan.perMessageRates.sms - proposedSmsEffective) / targetPlan.perMessageRates.sms) * 1000) / 10,
      },
      rcs: {
        list: targetPlan.perMessageRates.rcs,
        custom: proposedRcsBase,
        effective: proposedRcsEffective,
        floor: targetPlan.priceFloors.rcs,
        isBelowFloor: proposedRcsBase < targetPlan.priceFloors.rcs,
        discountPct: Math.round(((targetPlan.perMessageRates.rcs - proposedRcsEffective) / targetPlan.perMessageRates.rcs) * 1000) / 10,
      },
      whatsapp: {
        list: targetPlan.perMessageRates.whatsapp,
        custom: proposedWaBase,
        effective: proposedWaEffective,
        floor: targetPlan.priceFloors.whatsapp,
        isBelowFloor: proposedWaBase < targetPlan.priceFloors.whatsapp,
        discountPct: Math.round(((targetPlan.perMessageRates.whatsapp - proposedWaEffective) / targetPlan.perMessageRates.whatsapp) * 1000) / 10,
      },
      baseFee: {
        list: targetPlan.baseFeeMonthly,
        custom: proposedBaseFee,
        effective: proposedBaseFee,
      },
    },
  };
}

/**
 * Updates workspace pricing or submits change request for maker-checker approval
 */
export async function updateWorkspacePricing(input: {
  workspaceId: string;
  planId?: string;
  customOverrides?: {
    sms?: number;
    rcs?: number;
    whatsapp?: number;
    baseFeeMonthly?: number;
  };
  discountPct?: number;
  discountReason?: string;
  discountEndDate?: string | null;
  reason: string;
  actor: { id: string; role: InternalRole; name: string };
}) {
  if (!input.reason || input.reason.trim().length < 10) {
    throw new Error("Audit Policy: A justification reason of at least 10 characters is mandatory.");
  }

  const impact = await calculateCustomPricingImpact({
    workspaceId: input.workspaceId,
    proposedPlanId: input.planId,
    customOverrides: input.customOverrides,
    discountPct: input.discountPct,
  });

  const payload = {
    planId: input.planId,
    customPriceOverrides: input.customOverrides,
    discountPct: input.discountPct || 0,
    discountReason: input.discountReason || input.reason,
    discountEndDate: input.discountEndDate,
    deltaINR: impact.deltaINR,
  };

  // Route through requestChange
  const result = await requestChange({
    type: "custom_discount",
    targetType: "workspace",
    targetId: input.workspaceId,
    payload,
    reason: input.reason.trim(),
    actorId: input.actor.id,
    actorRole: input.actor.role,
  });

  return {
    status: result.status,
    changeRequestId: result.changeRequestId,
    message: result.message,
    requiresApproval: result.status === "pending",
  };
}

/**
 * Attaches a one-time or recurring add-on to a workspace
 */
export async function attachWorkspaceAddon(input: {
  workspaceId: string;
  addonId: string;
  quantity: number;
  startDate?: Date;
  endDate?: Date | null;
  actor: { id: string; role: InternalRole; name: string };
}) {
  const ws = await db.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).get();
  if (!ws) throw new Error("Workspace not found");

  const org = await db.select().from(organizations).where(eq(organizations.id, ws.orgId)).get();
  const addon = await db.select().from(addonCatalog).where(eq(addonCatalog.id, input.addonId)).get();
  if (!addon) throw new Error("Add-on not found in catalog");

  const qty = Math.max(1, input.quantity || 1);
  const now = new Date();
  const startDate = input.startDate || now;
  const isOneTime = addon.type === "one_time";
  const totalCost = addon.price * qty;

  const addonRecordId = `wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // 1. If ONE-TIME add-on
  if (isOneTime) {
    if (org?.billingModel === "prepaid") {
      // Immediate wallet deduction
      const currentBalance = ws.walletBalance;
      const balanceAfter = currentBalance - totalCost;

      await db
        .update(workspaces)
        .set({ walletBalance: balanceAfter, updatedAt: now })
        .where(eq(workspaces.id, ws.id));

      await db.insert(walletTransactions).values({
        id: `wt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: ws.id,
        type: "usage",
        amount: -totalCost,
        balanceAfter,
        reference: `ONE_TIME_ADDON_${addon.name.toUpperCase().replace(/\s+/g, "_")}`,
        createdBy: input.actor.id,
        createdAt: now,
      });
    } else {
      // Postpaid: record invoice line item or append to latest draft invoice
      const openInvoices = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.workspaceId, ws.id), eq(invoices.status, "issued")))
        .limit(1)
        .all();

      if (openInvoices.length > 0) {
        const inv = openInvoices[0];
        let lines: any[] = [];
        try {
          if (inv.lineItems) lines = JSON.parse(inv.lineItems);
        } catch {}

        lines.push({
          description: `One-Time Add-on: ${addon.name} (Qty: ${qty})`,
          amount: totalCost,
          category: "addon",
        });

        const newAmount = inv.amount + totalCost;
        const newGst = Math.round(newAmount * 0.18);

        await db
          .update(invoices)
          .set({
            amount: newAmount,
            gstAmount: newGst,
            lineItems: JSON.stringify(lines),
          })
          .where(eq(invoices.id, inv.id));
      }
    }
  }

  // 2. Insert into workspace_addons table
  await db.insert(workspaceAddons).values({
    id: addonRecordId,
    workspaceId: ws.id,
    addonId: addon.id,
    quantity: qty,
    status: "active",
    startDate,
    endDate: input.endDate || null,
  });

  // 3. Write Audit
  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: isOneTime ? "one_time_addon_purchased" : "recurring_addon_attached",
    targetType: "workspace",
    targetId: ws.id,
    orgId: ws.orgId,
    reason: `Attached add-on '${addon.name}' (qty: ${qty}, total: ₹${totalCost.toLocaleString("en-IN")}) to workspace.`,
    after: {
      addonId: addon.id,
      name: addon.name,
      type: addon.type,
      quantity: qty,
      totalCost,
      isOneTime,
    },
  });

  return { success: true, addonRecordId, totalCost };
}

/**
 * Cancels a recurring add-on (effective end of current billing cycle)
 */
export async function cancelWorkspaceAddon(input: {
  workspaceAddonId: string;
  reason: string;
  actor: { id: string; role: InternalRole; name: string };
}) {
  if (!input.reason || input.reason.trim().length < 10) {
    throw new Error("Audit Policy: A justification reason of at least 10 characters is mandatory.");
  }

  const record = await db
    .select()
    .from(workspaceAddons)
    .where(eq(workspaceAddons.id, input.workspaceAddonId))
    .get();

  if (!record) throw new Error("Workspace add-on not found");

  const endOfCycle = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db
    .update(workspaceAddons)
    .set({
      status: "cancelled",
      endDate: endOfCycle,
    })
    .where(eq(workspaceAddons.id, input.workspaceAddonId));

  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "recurring_addon_cancelled",
    targetType: "workspace",
    targetId: record.workspaceId,
    reason: input.reason.trim(),
    before: record,
    after: { ...record, status: "cancelled", endDate: endOfCycle },
  });

  return { success: true, effectiveEndDate: endOfCycle };
}

/**
 * Creates an audited seat reconciliation correction request
 */
export async function createSeatCorrectionRequest(input: {
  workspaceId: string;
  actionType: "true_up_billing" | "deprovision_inactive";
  actor: { id: string; role: InternalRole; name: string };
  reason: string;
}) {
  const wsPricing = await getWorkspacePricingAndSeats(input.workspaceId);
  const recon = wsPricing.seatReconciliation;

  if (input.actionType === "true_up_billing") {
    // Over-provisioned seats: attach missing addon_seat licenses to align billing with reality
    const seatsToAdd = recon.seatsProvisioned - recon.seatsBilled;
    if (seatsToAdd > 0) {
      await attachWorkspaceAddon({
        workspaceId: input.workspaceId,
        addonId: "addon_seat",
        quantity: seatsToAdd,
        actor: input.actor,
      });

      return {
        success: true,
        message: `Successfully trued up billing: Added ${seatsToAdd} Additional Seat add-on(s). Total billed seats now align with provisioned seats (${recon.seatsProvisioned}).`,
      };
    }
  }

  // Generic seat correction audit & task
  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "seat_correction_request_created",
    targetType: "workspace",
    targetId: input.workspaceId,
    orgId: wsPricing.orgId,
    reason: input.reason.trim(),
    after: {
      actionType: input.actionType,
      seatsBilled: recon.seatsBilled,
      seatsProvisioned: recon.seatsProvisioned,
      seatsActive: recon.seatsActive,
      monthlyWaste: recon.seatWasteMonthlyINR,
    },
  });

  return {
    success: true,
    message: `Seat reconciliation request logged. Account Manager and Ops notified to resolve license mismatch.`,
  };
}
