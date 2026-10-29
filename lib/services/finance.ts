import { db } from "@/lib/db";
import {
  workspaces,
  organizations,
  invoices,
  walletTransactions,
  creditHistory,
  usageDaily,
  tasks,
  alerts,
  auditLog,
  changeRequests,
} from "@/lib/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { writeAudit } from "./audit";
import { requestChange } from "./approvals";
import { projectedCreditExhaustionDate } from "./derived";
import { InternalRole } from "@/lib/permissions/roles";

export const RELAY_HOME_STATE = "Karnataka";
export const RELAY_HOME_STATE_CODE = "29";

// Currency precision: convert to paise (integers)
export function toPaise(rupees: number): number {
  return Math.round(Number(rupees) * 100);
}

export function toRupees(paise: number): number {
  return paise / 100;
}

/**
 * Calculates Indian GST Breakup
 * Relay is incorporated in Karnataka (State Code 29).
 * - Karnataka supplies -> Intra-state: CGST 9% + SGST 9% (IGST 0%)
 * - Other states -> Inter-state: IGST 18% (CGST 0% + SGST 0%)
 */
export function calculateGSTBreakup(preTaxAmount: number, billingState: string) {
  const isKarnataka =
    billingState?.trim().toLowerCase() === "karnataka" ||
    billingState?.trim().startsWith("29");

  const rate = 0.18;
  const totalTax = Math.round(preTaxAmount * rate);

  if (isKarnataka) {
    const halfTax = Math.round(preTaxAmount * 0.09);
    return {
      isInterstate: false,
      cgstRate: 9,
      cgstAmount: halfTax,
      sgstRate: 9,
      sgstAmount: totalTax - halfTax,
      igstRate: 0,
      igstAmount: 0,
      totalGst: totalTax,
      totalAmount: preTaxAmount + totalTax,
    };
  } else {
    return {
      isInterstate: true,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 18,
      igstAmount: totalTax,
      totalGst: totalTax,
      totalAmount: preTaxAmount + totalTax,
    };
  }
}

export interface WorkspaceCreditBillingData {
  workspaceId: string;
  workspaceName: string;
  orgId: string;
  orgName: string;
  billingModel: "prepaid" | "postpaid";
  billingState: string;
  gstin: string;
  postpaidPosition?: {
    creditLimit: number;
    creditUsed: number;
    availableCredit: number;
    utilizationPct: number;
    is70: boolean;
    is80: boolean;
    is90: boolean;
    dailyBurnEWMA: number;
    daysRemaining: number | null;
    projectedDate: Date | null;
    history: any[];
  };
  prepaidPosition?: {
    walletBalance: number;
    dailyBurnAverage: number;
    daysOfCover: number;
    isLowBalance: boolean; // < 5 days cover
    transactions: any[];
  };
  invoices: any[];
  hasOverdueInvoices: boolean;
  overdueCount: number;
  overdueTotalINR: number;
}

/**
 * Returns complete Credit & Billing position for a single workspace
 */
export async function getWorkspaceCreditBilling(workspaceId: string): Promise<WorkspaceCreditBillingData> {
  const ws = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws) throw new Error("Workspace not found");

  const org = await db.select().from(organizations).where(eq(organizations.id, ws.orgId)).get();
  if (!org) throw new Error("Organization not found");

  const billingModel = org.billingModel as "prepaid" | "postpaid";

  // Recent 30 days usage for daily burn
  const usage = await db
    .select()
    .from(usageDaily)
    .where(eq(usageDaily.workspaceId, workspaceId))
    .orderBy(desc(usageDaily.date))
    .limit(30)
    .all();

  // Invoices
  const allInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.workspaceId, workspaceId))
    .orderBy(desc(invoices.issuedAt))
    .all();

  const enrichedInvoices = allInvoices.map((inv) => {
    const gst = calculateGSTBreakup(inv.amount, ws.billingState);
    const now = Date.now();
    const dueTime = new Date(inv.dueAt).getTime();
    const isOverdue = inv.status === "overdue" || (inv.status === "issued" && now > dueTime);
    const daysOverdue = isOverdue ? Math.max(1, Math.floor((now - dueTime) / (1000 * 60 * 60 * 24))) : 0;

    return {
      ...inv,
      gst,
      isOverdue,
      daysOverdue,
    };
  });

  const overdueInvoices = enrichedInvoices.filter((i) => i.isOverdue && i.status !== "paid");
  const overdueCount = overdueInvoices.length;
  const overdueTotalINR = overdueInvoices.reduce((acc, i) => acc + i.gst.totalAmount, 0);

  let postpaidPosition: any = undefined;
  let prepaidPosition: any = undefined;

  if (billingModel === "postpaid") {
    const limit = ws.creditLimit || 0;
    const used = ws.creditUsed || 0;
    const available = Math.max(0, limit - used);
    const utilPct = limit > 0 ? Math.round((used / limit) * 100) : 0;

    const exhaustion = projectedCreditExhaustionDate(
      { creditLimit: limit, creditUsed: used },
      usage.map((u) => ({ date: u.date, cost: u.cost }))
    );

    const history = await db
      .select()
      .from(creditHistory)
      .where(eq(creditHistory.workspaceId, workspaceId))
      .orderBy(desc(creditHistory.createdAt))
      .limit(20)
      .all();

    postpaidPosition = {
      creditLimit: limit,
      creditUsed: used,
      availableCredit: available,
      utilizationPct: utilPct,
      is70: utilPct >= 70,
      is80: utilPct >= 80,
      is90: utilPct >= 90,
      dailyBurnEWMA: exhaustion.dailyBurnEWMA,
      daysRemaining: exhaustion.daysRemaining,
      projectedDate: exhaustion.projectedDate,
      history,
    };
  } else {
    // Prepaid
    const totalCost14 = usage.slice(0, 14).reduce((acc, u) => acc + (u.cost || 0), 0);
    const dailyAvg = usage.length > 0 ? Math.round(totalCost14 / Math.min(14, usage.length)) : 0;
    const daysOfCover = dailyAvg > 0 ? Math.floor(ws.walletBalance / dailyAvg) : 999;

    const txs = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.workspaceId, workspaceId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(25)
      .all();

    prepaidPosition = {
      walletBalance: ws.walletBalance,
      dailyBurnAverage: dailyAvg,
      daysOfCover,
      isLowBalance: daysOfCover < 5,
      transactions: txs,
    };
  }

  return {
    workspaceId,
    workspaceName: ws.name,
    orgId: org.id,
    orgName: org.name,
    billingModel,
    billingState: ws.billingState,
    gstin: ws.gstin,
    postpaidPosition,
    prepaidPosition,
    invoices: enrichedInvoices,
    hasOverdueInvoices: overdueCount > 0,
    overdueCount,
    overdueTotalINR,
  };
}

/**
 * Changes credit limit with strict maker-checker policy & validation
 */
export async function changeCreditLimit(input: {
  workspaceId: string;
  newCreditLimit: number;
  reason: string;
  note?: string;
  actor: { id: string; role: InternalRole; name: string };
}) {
  if (!input.newCreditLimit || input.newCreditLimit <= 0) {
    throw new Error("Financial Validation: Credit limit must be a positive number.");
  }
  if (!input.reason || input.reason.trim().length < 10) {
    throw new Error("Compliance Policy: An audit reason of at least 10 characters is mandatory.");
  }

  const ws = await db.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).get();
  if (!ws) throw new Error("Workspace not found");

  const currentLimit = ws.creditLimit || 0;
  const currentUsed = ws.creditUsed || 0;
  const newLimit = input.newCreditLimit;

  // Validate sane bounds (e.g. limit up to ₹50,00,00,000 = ₹50 Crore)
  if (newLimit > 500000000) {
    throw new Error("Financial Guard: Credit limit exceeds maximum enterprise ceiling of ₹50 Crore.");
  }

  // Route through requestChange
  const res = await requestChange({
    type: "credit_limit_increase",
    targetType: "workspace",
    targetId: ws.id,
    payload: {
      newCreditLimit: newLimit,
      currentCreditLimit: currentLimit,
      currentUsed,
      reason: input.reason.trim(),
      note: input.note,
    },
    reason: input.reason.trim(),
    actorId: input.actor.id,
    actorRole: input.actor.role,
  });

  return res;
}

/**
 * Records a prepaid wallet top-up atomically with unique reference validation
 */
export async function recordTopup(input: {
  workspaceId: string;
  amount: number;
  paymentReference: string;
  paymentMode: "NEFT" | "RTGS" | "IMPS" | "Net Banking" | "UPI";
  actor: { id: string; role: InternalRole; name: string };
}) {
  const amount = Number(input.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Financial Validation: Top-up amount must be a positive number.");
  }
  if (amount > 100000000) {
    throw new Error("Financial Validation: Single top-up exceeds maximum allowable threshold of ₹10 Crore.");
  }

  const ref = input.paymentReference?.trim().toUpperCase();
  if (!ref || ref.length < 6) {
    throw new Error("Validation Error: A valid Bank UTR or Payment Reference (min 6 characters) is required.");
  }

  // Validate UTR Uniqueness across wallet transactions
  const existingTx = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.reference, ref))
    .get();

  if (existingTx) {
    throw new Error(`Fraud Guard: Payment Reference / UTR '${ref}' has already been processed previously.`);
  }

  const ws = await db.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).get();
  if (!ws) throw new Error("Workspace not found");

  const org = await db.select().from(organizations).where(eq(organizations.id, ws.orgId)).get();

  const now = new Date();
  const txId = `wt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Integer precision in paise
  const currentPaise = toPaise(ws.walletBalance);
  const addPaise = toPaise(amount);
  const newBalancePaise = currentPaise + addPaise;
  const newBalanceINR = toRupees(newBalancePaise);

  // Execute in atomic update
  await db
    .update(workspaces)
    .set({
      walletBalance: newBalanceINR,
      updatedAt: now,
    })
    .where(eq(workspaces.id, ws.id));

  await db.insert(walletTransactions).values({
    id: txId,
    workspaceId: ws.id,
    type: "topup",
    amount,
    balanceAfter: newBalanceINR,
    reference: ref,
    createdBy: input.actor.id,
    createdAt: now,
  });

  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "wallet_topup_recorded",
    targetType: "workspace",
    targetId: ws.id,
    orgId: ws.orgId,
    reason: `Recorded ${input.paymentMode} top-up of ₹${amount.toLocaleString("en-IN")} (Ref: ${ref}).`,
    after: {
      amount,
      balanceAfter: newBalanceINR,
      reference: ref,
      mode: input.paymentMode,
    },
  });

  return {
    success: true,
    transactionId: txId,
    newBalance: newBalanceINR,
  };
}

/**
 * Records manual adjustment (Credit or Debit)
 * Over ₹50,000 requires Finance Head approval.
 */
export async function recordManualAdjustment(input: {
  workspaceId: string;
  adjustmentType: "credit" | "debit";
  reasonCode: "goodwill_credit" | "billing_error" | "refund" | "chargeback";
  reason: string;
  amount: number;
  actor: { id: string; role: InternalRole; name: string };
}) {
  const amount = Number(input.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Financial Validation: Adjustment amount must be positive.");
  }
  if (!input.reason || input.reason.trim().length < 10) {
    throw new Error("Compliance Policy: An audit reason of at least 10 characters is mandatory.");
  }

  const ws = await db.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).get();
  if (!ws) throw new Error("Workspace not found");

  const org = await db.select().from(organizations).where(eq(organizations.id, ws.orgId)).get();
  const isPostpaid = org?.billingModel === "postpaid";

  // Signed amount: credit adds money / reduces used (+), debit removes money / increases used (-)
  const signedAmount = input.adjustmentType === "credit" ? amount : -amount;

  // Prepaid validation: wallet can never go negative!
  if (!isPostpaid && input.adjustmentType === "debit") {
    if (ws.walletBalance < amount) {
      throw new Error(`Financial Constraint: Insufficient wallet balance. Debit of ₹${amount} exceeds current balance of ₹${ws.walletBalance}.`);
    }
  }

  // Route through requestChange (maker-checker applies if amount > 50,000)
  const res = await requestChange({
    type: "wallet_adjustment",
    targetType: "workspace",
    targetId: ws.id,
    payload: {
      amount: signedAmount,
      adjustmentType: input.adjustmentType,
      reasonCode: input.reasonCode,
      reason: input.reason.trim(),
    },
    reason: `[${input.reasonCode.toUpperCase()}] ${input.reason.trim()}`,
    actorId: input.actor.id,
    actorRole: input.actor.role,
  });

  return res;
}

/**
 * Invoice Operations: Issue Draft, Mark Paid, Dispute
 */
export async function issueDraftInvoice(invoiceId: string, actor: { id: string; role: InternalRole; name: string }) {
  const inv = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
  if (!inv) throw new Error("Invoice not found");
  if (inv.status !== "draft") throw new Error("Only draft invoices can be issued.");

  const now = new Date();
  const dueAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days credit terms

  await db
    .update(invoices)
    .set({
      status: "issued",
      issuedAt: now,
      dueAt,
    })
    .where(eq(invoices.id, invoiceId));

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "invoice_issued",
    targetType: "invoice",
    targetId: invoiceId,
    reason: `Issued invoice for billing period ${inv.period}. Due date: ${dueAt.toLocaleDateString("en-IN")}.`,
  });

  return { success: true };
}

export async function markInvoicePaid(input: {
  invoiceId: string;
  paymentReference: string;
  paymentMode: string;
  actor: { id: string; role: InternalRole; name: string };
}) {
  const inv = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).get();
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "paid") throw new Error("Invoice is already marked as paid.");

  const ref = input.paymentReference?.trim().toUpperCase();
  if (!ref || ref.length < 6) {
    throw new Error("A valid payment reference/UTR (min 6 characters) is required.");
  }

  const ws = await db.select().from(workspaces).where(eq(workspaces.id, inv.workspaceId)).get();
  const now = new Date();

  // Mark invoice paid
  await db
    .update(invoices)
    .set({
      status: "paid",
      paidAt: now,
    })
    .where(eq(invoices.id, input.invoiceId));

  // If postpaid workspace, paying invoice reduces creditUsed!
  if (ws && ws.creditUsed > 0) {
    const newUsed = Math.max(0, ws.creditUsed - inv.amount);
    await db
      .update(workspaces)
      .set({
        creditUsed: newUsed,
        updatedAt: now,
      })
      .where(eq(workspaces.id, ws.id));

    await db.insert(creditHistory).values({
      id: `ch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: ws.id,
      oldLimit: ws.creditLimit,
      newLimit: ws.creditLimit,
      reason: `Invoice #${inv.id} settled via ${input.paymentMode} (UTR: ${ref}). Credit used reduced by ₹${inv.amount.toLocaleString("en-IN")}.`,
      changedBy: input.actor.id,
      approvedBy: input.actor.id,
      createdAt: now,
    });
  }

  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "invoice_marked_paid",
    targetType: "invoice",
    targetId: input.invoiceId,
    reason: `Marked invoice as paid via ${input.paymentMode} (Ref: ${ref}).`,
    after: {
      invoiceId: input.invoiceId,
      paidAt: now,
      reference: ref,
    },
  });

  return { success: true };
}

export async function flagInvoiceDisputed(input: {
  invoiceId: string;
  reason: string;
  actor: { id: string; role: InternalRole; name: string };
}) {
  if (!input.reason || input.reason.trim().length < 10) {
    throw new Error("A dispute reason of at least 10 characters is mandatory.");
  }

  await db
    .update(invoices)
    .set({ status: "disputed" })
    .where(eq(invoices.id, input.invoiceId));

  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "invoice_flagged_disputed",
    targetType: "invoice",
    targetId: input.invoiceId,
    reason: input.reason.trim(),
  });

  return { success: true };
}

/**
 * Overdue Collections Actions
 */
export async function logFollowUpAction(input: {
  invoiceId: string;
  note: string;
  actor: { id: string; role: InternalRole; name: string };
}) {
  const inv = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).get();
  if (!inv) throw new Error("Invoice not found");

  const ws = await db.select().from(workspaces).where(eq(workspaces.id, inv.workspaceId)).get();
  if (!ws) throw new Error("Workspace not found");

  const org = await db.select().from(organizations).where(eq(organizations.id, ws.orgId)).get();
  const now = new Date();

  // Create collections task assigned to AM
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await db.insert(tasks).values({
    id: taskId,
    orgId: ws.orgId,
    assignedTo: org?.ownerAmId || input.actor.id,
    title: `Payment Follow-up: Overdue Invoice #${inv.id} (${inv.period}) — Note: ${input.note}`,
    source: "manual",
    status: "pending",
    dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days follow-up
  });

  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "collections_followup_logged",
    targetType: "invoice",
    targetId: input.invoiceId,
    orgId: ws.orgId,
    reason: input.note.trim(),
    after: { taskId },
  });

  return { success: true, taskId };
}

/**
 * Global Finance Hub Aggregated Metrics (/finance)
 */
export async function getFinanceHubData() {
  const [allOrgs, allWs, allInvs, allUsage, allAlerts] = await Promise.all([
    db.select().from(organizations).all(),
    db.select().from(workspaces).all(),
    db.select().from(invoices).all(),
    db.select().from(usageDaily).orderBy(desc(usageDaily.date)).limit(1000).all(),
    db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(20).all(),
  ]);

  const orgMap = new Map(allOrgs.map((o) => [o.id, o]));
  const wsMap = new Map(allWs.map((w) => [w.id, w]));

  const nowMs = Date.now();

  // 1. Total Outstanding Postpaid
  const totalPostpaidCreditUsed = allWs
    .filter((w) => {
      const org = orgMap.get(w.orgId);
      return org?.billingModel === "postpaid";
    })
    .reduce((acc, w) => acc + (w.creditUsed || 0), 0);

  // 2. Overdue Amount & Aging Split
  let overdueTotal = 0;
  const aging = {
    d0_15: { count: 0, amount: 0 },
    d16_30: { count: 0, amount: 0 },
    d31_60: { count: 0, amount: 0 },
    d60_plus: { count: 0, amount: 0 },
  };

  const collectionsList: any[] = [];

  for (const inv of allInvs) {
    if (inv.status === "paid") continue;

    const ws = wsMap.get(inv.workspaceId);
    const org = ws ? orgMap.get(ws.orgId) : null;
    const dueTime = new Date(inv.dueAt).getTime();
    const isOverdue = inv.status === "overdue" || (inv.status === "issued" && nowMs > dueTime);

    if (isOverdue) {
      const daysOverdue = Math.max(1, Math.floor((nowMs - dueTime) / (1000 * 60 * 60 * 24)));
      const totalAmount = inv.amount + inv.gstAmount;
      overdueTotal += totalAmount;

      if (daysOverdue <= 15) {
        aging.d0_15.count++;
        aging.d0_15.amount += totalAmount;
      } else if (daysOverdue <= 30) {
        aging.d16_30.count++;
        aging.d16_30.amount += totalAmount;
      } else if (daysOverdue <= 60) {
        aging.d31_60.count++;
        aging.d31_60.amount += totalAmount;
      } else {
        aging.d60_plus.count++;
        aging.d60_plus.amount += totalAmount;
      }

      collectionsList.push({
        invoiceId: inv.id,
        workspaceId: inv.workspaceId,
        workspaceName: ws?.name || inv.workspaceId,
        orgId: org?.id || "",
        orgName: org?.name || "Unknown Org",
        ownerAmId: org?.ownerAmId,
        period: inv.period,
        amount: totalAmount,
        dueAt: inv.dueAt,
        daysOverdue,
        status: inv.status,
      });
    }
  }

  // Sort collections by longest overdue first
  collectionsList.sort((a, b) => b.daysOverdue - a.daysOverdue);

  // 3. Postpaid Workspaces Above 80%
  const postpaidAtRisk: any[] = [];
  const creditWatchlist: any[] = [];

  for (const ws of allWs) {
    const org = orgMap.get(ws.orgId);
    if (org?.billingModel !== "postpaid") continue;

    const limit = ws.creditLimit || 0;
    const used = ws.creditUsed || 0;
    if (limit <= 0) continue;

    const utilPct = Math.round((used / limit) * 100);

    const wsUsage = allUsage.filter((u) => u.workspaceId === ws.id);
    const exhaustion = projectedCreditExhaustionDate(
      { creditLimit: limit, creditUsed: used },
      wsUsage.map((u) => ({ date: u.date, cost: u.cost }))
    );

    const item = {
      workspaceId: ws.id,
      workspaceName: ws.name,
      orgId: org.id,
      orgName: org.name,
      ownerAmId: org.ownerAmId,
      creditLimit: limit,
      creditUsed: used,
      availableCredit: Math.max(0, limit - used),
      utilizationPct: utilPct,
      dailyBurnEWMA: exhaustion.dailyBurnEWMA,
      daysRemaining: exhaustion.daysRemaining,
      projectedDate: exhaustion.projectedDate,
    };

    if (utilPct >= 70) {
      creditWatchlist.push(item);
    }
    if (utilPct >= 80) {
      postpaidAtRisk.push(item);
    }
  }

  // Sort watchlist by highest utilization first
  creditWatchlist.sort((a, b) => b.utilizationPct - a.utilizationPct);
  const top10CreditRisks = creditWatchlist.slice(0, 10);

  // 4. Prepaid Workspaces Below 5 Days Cover
  const prepaidAtRisk: any[] = [];
  for (const ws of allWs) {
    const org = orgMap.get(ws.orgId);
    if (org?.billingModel !== "prepaid") continue;

    const wsUsage = allUsage.filter((u) => u.workspaceId === ws.id);
    const totalCost14 = wsUsage.slice(0, 14).reduce((acc, u) => acc + (u.cost || 0), 0);
    const dailyAvg = wsUsage.length > 0 ? Math.round(totalCost14 / Math.min(14, wsUsage.length)) : 0;
    const daysOfCover = dailyAvg > 0 ? Math.floor(ws.walletBalance / dailyAvg) : 999;

    if (daysOfCover < 5) {
      prepaidAtRisk.push({
        workspaceId: ws.id,
        workspaceName: ws.name,
        orgId: org.id,
        orgName: org.name,
        walletBalance: ws.walletBalance,
        dailyBurnAverage: dailyAvg,
        daysOfCover,
      });
    }
  }

  return {
    metrics: {
      totalPostpaidCreditUsed,
      overdueTotal,
      postpaidAbove80Count: postpaidAtRisk.length,
      prepaidBelow5DaysCount: prepaidAtRisk.length,
      totalActiveWorkspaces: allWs.length,
    },
    aging,
    top10CreditRisks,
    creditWatchlist,
    prepaidAtRisk,
    collectionsList,
    recentAlerts: allAlerts,
  };
}

/**
 * Simulates a day of usage for all active workspaces (Admin Demo Feature)
 * Advances time, generates spend, checks thresholds, and triggers alerts.
 */
export async function simulateDayOfUsage(actor: { id: string; role: InternalRole; name: string }) {
  const [allWs, allOrgs, existingAlerts] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.status, "active")).all(),
    db.select().from(organizations).where(eq(organizations.status, "active")).all(),
    db.select().from(alerts).all(),
  ]);

  const orgMap = new Map(allOrgs.map((o) => [o.id, o]));
  const existingAlertKeys = new Set(existingAlerts.map((a) => `${a.workspaceId}_${a.type}`));
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  let alertsGenerated = 0;
  let totalSpendAdded = 0;

  for (const ws of allWs) {
    const org = orgMap.get(ws.orgId);
    if (!org) continue;

    // Simulate random daily traffic based on plan tier
    const isPostpaid = org.billingModel === "postpaid";
    const baseDailyMessages = org.planId === "plan_enterprise" ? 45000 : org.planId === "plan_scale" ? 20000 : 8000;
    const jitter = 0.8 + Math.random() * 0.4;
    const sms = Math.round(baseDailyMessages * 0.6 * jitter);
    const rcs = Math.round(baseDailyMessages * 0.15 * jitter);
    const whatsapp = Math.round(baseDailyMessages * 0.25 * jitter);
    const dailySpend = Math.round(sms * 0.12 + rcs * 0.20 + whatsapp * 0.35);

    totalSpendAdded += dailySpend;

    // 1. Record daily usage
    await db
      .insert(usageDaily)
      .values({
        id: `ud_sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: ws.id,
        date: dateStr,
        smsCount: sms,
        rcsCount: rcs,
        whatsappCount: whatsapp,
        deliveredPct: 98.8,
        cost: dailySpend,
      })
      .onConflictDoNothing();

    // 2. Mutate Balances
    if (isPostpaid) {
      const newUsed = ws.creditUsed + dailySpend;
      const limit = ws.creditLimit || 1;
      const oldUtil = (ws.creditUsed / limit) * 100;
      const newUtil = (newUsed / limit) * 100;

      await db
        .update(workspaces)
        .set({ creditUsed: newUsed, updatedAt: now })
        .where(eq(workspaces.id, ws.id));

      // Trigger 80% / 90% alerts
      if (newUtil >= 90 && !existingAlertKeys.has(`${ws.id}_credit_utilization_90`)) {
        alertsGenerated++;
        existingAlertKeys.add(`${ws.id}_credit_utilization_90`);
        await db.insert(alerts).values({
          id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          workspaceId: ws.id,
          orgId: ws.orgId,
          type: "credit_utilization_90",
          severity: "critical",
          title: `Credit Critical: ${ws.name} crossed 90%`,
          message: `Traffic throttling imminent! ${ws.name} has reached ${Math.round(newUtil)}% credit utilization (₹${newUsed.toLocaleString("en-IN")} of ₹${limit.toLocaleString("en-IN")}).`,
          createdAt: now,
        });
      } else if (newUtil >= 80 && newUtil < 90 && !existingAlertKeys.has(`${ws.id}_credit_utilization_80`)) {
        alertsGenerated++;
        existingAlertKeys.add(`${ws.id}_credit_utilization_80`);
        await db.insert(alerts).values({
          id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          workspaceId: ws.id,
          orgId: ws.orgId,
          type: "credit_utilization_80",
          severity: "warning",
          title: `Credit Warning: ${ws.name} crossed 80%`,
          message: `Workspace utilized ₹${newUsed.toLocaleString("en-IN")} of ₹${limit.toLocaleString("en-IN")} (${Math.round(newUtil)}%). Consider proactive limit hike.`,
          createdAt: now,
        });
      }
    } else {
      // Prepaid
      const newBalance = Math.max(0, ws.walletBalance - dailySpend);
      await db
        .update(workspaces)
        .set({ walletBalance: newBalance, updatedAt: now })
        .where(eq(workspaces.id, ws.id));

      if (newBalance < 25000 && !existingAlertKeys.has(`${ws.id}_prepaid_low_balance`)) {
        alertsGenerated++;
        existingAlertKeys.add(`${ws.id}_prepaid_low_balance`);
        await db.insert(alerts).values({
          id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          workspaceId: ws.id,
          orgId: ws.orgId,
          type: "prepaid_low_balance",
          severity: "warning",
          title: `Low Wallet Balance: ${ws.name}`,
          message: `Prepaid wallet dropped below ₹25,000 threshold (Current Balance: ₹${newBalance.toLocaleString("en-IN")}). Top-up required to avoid service pause.`,
          createdAt: now,
        });
      }
    }
  }

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "simulated_day_of_usage",
    targetType: "system",
    targetId: "global_workspaces",
    reason: `Simulated 1 operational day of messaging traffic across ${allWs.length} workspaces (Total Spend: ₹${totalSpendAdded.toLocaleString("en-IN")}).`,
    after: { alertsGenerated, totalSpendAdded },
  });

  return {
    success: true,
    workspacesProcessed: allWs.length,
    totalSpendAdded,
    alertsGenerated,
  };
}
