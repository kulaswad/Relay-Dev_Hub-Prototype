import { db } from "@/lib/db";
import {
  organizations,
  workspaces,
  plans,
  internalUsers,
  workspaceUsers,
  subscriptions,
  addonCatalog,
  workspaceAddons,
  usageDaily,
  walletTransactions,
  invoices,
  creditHistory,
  tickets,
  kycCases,
  senderIds,
  templates,
  auditLog,
  tasks,
} from "@/lib/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { logAudit, writeAudit, getAuditLogs } from "./audit";
import { getOnboardingChecklist } from "./lifecycle";
import {
  healthScore,
  creditUtilization,
  seatUtilization,
  usageTrendPct,
  projectedCreditExhaustionDate,
  SeatUtilizationResult,
} from "./derived";

export interface AccountListItem {
  id: string;
  name: string;
  legalName: string;
  industry: string;
  city: string;
  status: "onboarding" | "active" | "at_risk" | "suspended" | "offboarded";
  billingModel: "prepaid" | "postpaid";
  planId: string;
  planName: string;
  ownerAmId: string;
  ownerAmName: string;
  ownerAmEmail: string;
  contractStart: Date | null;
  contractEnd: Date | null;
  tags: string[];
  workspacesCount: number;
  workspacesSummary: Array<{
    id: string;
    name: string;
    status: string;
    gstin: string;
    billingState: string;
  }>;
  health: {
    score: number;
    grade: "Healthy" | "At Risk" | "Critical";
    breakdown: {
      usageTrendScore: number;
      paymentScore: number;
      ticketScore: number;
      seatScore: number;
      complianceScore: number;
    };
  };
  financialPosition: {
    billingModel: "prepaid" | "postpaid";
    creditLimit: number;
    creditUsed: number;
    utilizationPct: number;
    walletBalance: number;
    hasOverdueInvoice: boolean;
  };
  usage: {
    sparkline: number[];
    trendPct: number;
    totalMessages30d: number;
    totalSpend30d: number;
  };
  openTicketsCount: number;
  urgentTicketsCount: number;
  complianceDot: "green" | "yellow" | "red";
  hasPendingKyc: boolean;
  needsAttention: boolean;
  attentionReasons: string[];
}

/**
 * Returns enriched list of all organizations with derived metrics,
 * health scores, 30d usage trends, financial positions, and compliance status.
 */
export async function getAccountsList(): Promise<AccountListItem[]> {
  const [
    allOrgs,
    allWorkspaces,
    allPlans,
    allUsers,
    allTickets,
    allInvoices,
    allUsage,
    allWUsers,
    allKyc,
  ] = await Promise.all([
    db.select().from(organizations).orderBy(desc(organizations.createdAt)).all(),
    db.select().from(workspaces).all(),
    db.select().from(plans).all(),
    db.select().from(internalUsers).all(),
    db.select().from(tickets).all(),
    db.select().from(invoices).all(),
    db.select().from(usageDaily).all(),
    db.select().from(workspaceUsers).all(),
    db.select().from(kycCases).all(),
  ]);

  const plansMap = new Map(allPlans.map((p) => [p.id, p]));
  const usersMap = new Map(allUsers.map((u) => [u.id, u]));

  // Index by orgId or workspaceId for fast lookups
  const wsByOrg = new Map<string, typeof allWorkspaces>();
  for (const ws of allWorkspaces) {
    const list = wsByOrg.get(ws.orgId) || [];
    list.push(ws);
    wsByOrg.set(ws.orgId, list);
  }

  const ticketsByOrg = new Map<string, typeof allTickets>();
  for (const t of allTickets) {
    const list = ticketsByOrg.get(t.orgId) || [];
    list.push(t);
    ticketsByOrg.set(t.orgId, list);
  }

  const invoicesByWs = new Map<string, typeof allInvoices>();
  for (const inv of allInvoices) {
    const list = invoicesByWs.get(inv.workspaceId) || [];
    list.push(inv);
    invoicesByWs.set(inv.workspaceId, list);
  }

  const usageByWs = new Map<string, typeof allUsage>();
  for (const u of allUsage) {
    const list = usageByWs.get(u.workspaceId) || [];
    list.push(u);
    usageByWs.set(u.workspaceId, list);
  }

  const wusersByWs = new Map<string, typeof allWUsers>();
  for (const wu of allWUsers) {
    const list = wusersByWs.get(wu.workspaceId) || [];
    list.push(wu);
    wusersByWs.set(wu.workspaceId, list);
  }

  const kycByWs = new Map<string, typeof allKyc>();
  for (const k of allKyc) {
    const list = kycByWs.get(k.workspaceId) || [];
    list.push(k);
    kycByWs.set(k.workspaceId, list);
  }

  const items: AccountListItem[] = [];

  for (const org of allOrgs) {
    const orgWs = wsByOrg.get(org.id) || [];
    const orgTickets = ticketsByOrg.get(org.id) || [];
    const plan = plansMap.get(org.planId);
    const ownerAm = usersMap.get(org.ownerAmId);

    // Aggregate usage across all workspaces of this org
    const orgUsage: typeof allUsage = [];
    const orgInvoices: typeof allInvoices = [];
    const orgWUsers: typeof allWUsers = [];
    const orgKyc: typeof allKyc = [];

    let totalCreditLimit = 0;
    let totalCreditUsed = 0;
    let totalWalletBalance = 0;

    for (const ws of orgWs) {
      totalCreditLimit += ws.creditLimit || 0;
      totalCreditUsed += ws.creditUsed || 0;
      totalWalletBalance += ws.walletBalance || 0;

      const wsUsage = usageByWs.get(ws.id) || [];
      orgUsage.push(...wsUsage);

      const wsInvoices = invoicesByWs.get(ws.id) || [];
      orgInvoices.push(...wsInvoices);

      const wsUsers = wusersByWs.get(ws.id) || [];
      orgWUsers.push(...wsUsers);

      const wsKycList = kycByWs.get(ws.id) || [];
      orgKyc.push(...wsKycList);
    }

    // Health score computation
    const health = healthScore({
      organization: { status: org.status },
      workspaces: orgWs.map((w) => ({ status: w.status, billingState: w.billingState })),
      usageHistory: orgUsage.map((u) => ({ date: u.date, cost: u.cost })),
      invoices: orgInvoices.map((i) => ({ status: i.status, amount: i.amount, dueAt: i.dueAt })),
      tickets: orgTickets.map((t) => ({ status: t.status, priority: t.priority })),
      workspaceUsers: orgWUsers.map((u) => ({
        seatActive: u.seatActive,
        isSeatPaid: u.isSeatPaid,
        lastLoginAt: u.lastLoginAt,
      })),
    });

    // 30-day sparkline and trend
    const sortedUsage = [...orgUsage].sort((a, b) => a.date.localeCompare(b.date));
    // Aggregate by date
    const dailyAgg = new Map<string, { cost: number; messages: number }>();
    for (const row of sortedUsage) {
      const prev = dailyAgg.get(row.date) || { cost: 0, messages: 0 };
      prev.cost += row.cost || 0;
      prev.messages += (row.smsCount || 0) + (row.rcsCount || 0) + (row.whatsappCount || 0);
      dailyAgg.set(row.date, prev);
    }

    const uniqueDates = Array.from(dailyAgg.keys()).sort();
    const last30Dates = uniqueDates.slice(-30);
    const sparkline = last30Dates.map((d) => Math.round(dailyAgg.get(d)!.cost));
    const trendPct = usageTrendPct(
      uniqueDates.map((d) => ({ date: d, cost: dailyAgg.get(d)!.cost })),
      30
    );

    let totalMessages30d = 0;
    let totalSpend30d = 0;
    for (const d of last30Dates) {
      const entry = dailyAgg.get(d)!;
      totalMessages30d += entry.messages;
      totalSpend30d += entry.cost;
    }

    // Open tickets
    const openTickets = orgTickets.filter(
      (t) => t.status === "open" || t.status === "in_progress" || t.status === "waiting_on_customer"
    );
    const urgentTickets = openTickets.filter((t) => t.priority === "urgent" || t.priority === "high");

    // Compliance dot
    const anySuspended = orgWs.some((w) => w.status === "suspended") || org.status === "suspended";
    const anyPendingKyc = orgWs.some((w) => w.status === "kyc_pending" || w.status === "kyc_in_review");
    const anyRejectedKyc = orgKyc.some((k) => k.status === "rejected");

    let complianceDot: "green" | "yellow" | "red" = "green";
    if (anySuspended || anyRejectedKyc) {
      complianceDot = "red";
    } else if (anyPendingKyc) {
      complianceDot = "yellow";
    }

    // Financial position
    const utilizationPct =
      totalCreditLimit > 0 ? Math.round((totalCreditUsed / totalCreditLimit) * 100) : 0;
    const hasOverdueInvoice = orgInvoices.some((inv) => inv.status === "overdue");

    // Needs attention logic
    const attentionReasons: string[] = [];
    if (org.status === "at_risk") attentionReasons.push("Marked as At Risk account");
    if (org.status === "suspended") attentionReasons.push("Account is Suspended");
    if (health.score < 70) attentionReasons.push(`Low health score (${health.score}/100)`);
    if (hasOverdueInvoice) attentionReasons.push("Overdue invoice awaiting payment");
    if (org.billingModel === "postpaid" && utilizationPct >= 80) {
      attentionReasons.push(`High credit utilization (${utilizationPct}%)`);
    }
    if (org.billingModel === "prepaid" && totalWalletBalance < 25000) {
      attentionReasons.push("Low prepaid wallet balance (< ₹25k)");
    }
    if (urgentTickets.length > 0) {
      attentionReasons.push(`${urgentTickets.length} urgent/high priority ticket(s)`);
    }
    if (anyPendingKyc) {
      attentionReasons.push("KYC verification in review or pending");
    }

    let parsedTags: string[] = [];
    if (org.tags) {
      try {
        parsedTags = JSON.parse(org.tags);
      } catch {
        parsedTags = [];
      }
    }

    items.push({
      id: org.id,
      name: org.name,
      legalName: org.legalName,
      industry: org.industry,
      city: org.city,
      status: org.status as any,
      billingModel: org.billingModel as any,
      planId: org.planId,
      planName: plan?.name || "Enterprise",
      ownerAmId: org.ownerAmId,
      ownerAmName: ownerAm?.name || "Unassigned",
      ownerAmEmail: ownerAm?.email || "",
      contractStart: org.contractStart,
      contractEnd: org.contractEnd,
      tags: parsedTags,
      workspacesCount: orgWs.length,
      workspacesSummary: orgWs.map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        gstin: w.gstin,
        billingState: w.billingState,
      })),
      health,
      financialPosition: {
        billingModel: org.billingModel as any,
        creditLimit: totalCreditLimit,
        creditUsed: totalCreditUsed,
        utilizationPct,
        walletBalance: totalWalletBalance,
        hasOverdueInvoice,
      },
      usage: {
        sparkline,
        trendPct,
        totalMessages30d,
        totalSpend30d: Math.round(totalSpend30d),
      },
      openTicketsCount: openTickets.length,
      urgentTicketsCount: urgentTickets.length,
      complianceDot,
      hasPendingKyc: anyPendingKyc,
      needsAttention: attentionReasons.length > 0,
      attentionReasons,
    });
  }

  return items;
}

/**
 * Returns comprehensive Account 360 data for a single organization
 */
export async function getAccount360(orgId: string) {
  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .get();

  if (!org) return null;

  const [
    allWs,
    plan,
    ownerAm,
    allInternalUsers,
    allTickets,
    allUsage,
    allWUsers,
    allSubscriptions,
    allWorkspaceAddons,
    allAddonsCatalog,
    allInvoices,
    allWalletTxns,
    allCreditHistory,
    allKyc,
    allSenderIds,
    allTemplates,
    allAudit,
    allTasks,
  ] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.orgId, orgId)).all(),
    db.select().from(plans).where(eq(plans.id, org.planId)).get(),
    db.select().from(internalUsers).where(eq(internalUsers.id, org.ownerAmId)).get(),
    db.select().from(internalUsers).all(),
    db.select().from(tickets).where(eq(tickets.orgId, orgId)).orderBy(desc(tickets.createdAt)).all(),
    db.select().from(usageDaily).all(),
    db.select().from(workspaceUsers).all(),
    db.select().from(subscriptions).all(),
    db.select().from(workspaceAddons).all(),
    db.select().from(addonCatalog).all(),
    db.select().from(invoices).all(),
    db.select().from(walletTransactions).all(),
    db.select().from(creditHistory).all(),
    db.select().from(kycCases).all(),
    db.select().from(senderIds).all(),
    db.select().from(templates).all(),
    getAuditLogs({ orgId, limit: 50 }),
    db.select().from(tasks).where(eq(tasks.orgId, orgId)).orderBy(desc(tasks.dueAt)).all(),
  ]);

  const wsIds = allWs.map((w) => w.id);
  const wsIdSet = new Set(wsIds);

  const orgUsage = allUsage.filter((u) => wsIdSet.has(u.workspaceId));
  const orgWUsers = allWUsers.filter((wu) => wsIdSet.has(wu.workspaceId));
  const orgSubs = allSubscriptions.filter((s) => wsIdSet.has(s.workspaceId));
  const orgWsAddons = allWorkspaceAddons.filter((wa) => wsIdSet.has(wa.workspaceId));
  const orgInvoices = allInvoices.filter((i) => wsIdSet.has(i.workspaceId));
  const orgWalletTxns = allWalletTxns.filter((wt) => wsIdSet.has(wt.workspaceId));
  const orgCreditHist = allCreditHistory.filter((ch) => wsIdSet.has(ch.workspaceId));
  const orgKyc = allKyc.filter((k) => wsIdSet.has(k.workspaceId));
  const orgSenderIds = allSenderIds.filter((sid) => wsIdSet.has(sid.workspaceId));
  const orgTemplates = allTemplates.filter((t) => wsIdSet.has(t.workspaceId));

  // 1. Health Score Calculation
  const health = healthScore({
    organization: { status: org.status },
    workspaces: allWs.map((w) => ({ status: w.status, billingState: w.billingState })),
    usageHistory: orgUsage.map((u) => ({ date: u.date, cost: u.cost })),
    invoices: orgInvoices.map((i) => ({ status: i.status, amount: i.amount, dueAt: i.dueAt })),
    tickets: allTickets.map((t) => ({ status: t.status, priority: t.priority })),
    workspaceUsers: orgWUsers.map((u) => ({
      seatActive: u.seatActive,
      isSeatPaid: u.isSeatPaid,
      lastLoginAt: u.lastLoginAt,
    })),
  });

  // 2. Health Narrative ("Why this score")
  const whyNarratives: string[] = [];
  const trend = usageTrendPct(orgUsage, 30);
  if (health.breakdown.usageTrendScore >= 26) {
    whyNarratives.push(`Usage trend is robust (+${trend}% over prior 30 days), contributing full 30-day expansion points.`);
  } else if (health.breakdown.usageTrendScore <= 10) {
    whyNarratives.push(`Severe usage drop detected (${trend}% delta over 30 days), penalizing health by ${30 - health.breakdown.usageTrendScore} pts.`);
  } else {
    whyNarratives.push(`Usage is moderately consistent (${trend >= 0 ? "+" : ""}${trend}% delta).`);
  }

  const overdueInvoices = orgInvoices.filter((i) => i.status === "overdue");
  const disputedInvoices = orgInvoices.filter((i) => i.status === "disputed");
  if (overdueInvoices.length > 0) {
    const totalOverdue = overdueInvoices.reduce((acc, i) => acc + i.amount + (i.gstAmount || 0), 0);
    whyNarratives.push(`${overdueInvoices.length} overdue invoice(s) totalling ₹${totalOverdue.toLocaleString("en-IN")}, deducting ${25 - health.breakdown.paymentScore} pts from payment score.`);
  } else if (disputedInvoices.length > 0) {
    whyNarratives.push(`${disputedInvoices.length} disputed invoice(s) under review.`);
  } else {
    whyNarratives.push("Zero payment defaults or overdue invoices across all workspaces.");
  }

  const seatStats = seatUtilization(orgWUsers);
  if (seatStats.hasSeatWaste) {
    whyNarratives.push(`${seatStats.wastedSeatPct}% paid seats are inactive (>45 days without login), signaling license waste.`);
  } else {
    whyNarratives.push(`Seat utilization is healthy at ${seatStats.utilizationPct}%.`);
  }

  const urgentTickets = allTickets.filter(
    (t) => (t.status === "open" || t.status === "in_progress") && (t.priority === "urgent" || t.priority === "high")
  );
  if (urgentTickets.length > 0) {
    whyNarratives.push(`${urgentTickets.length} urgent/high priority support ticket(s) currently open.`);
  }

  if (org.status === "suspended") {
    whyNarratives.push("Account is administratively SUSPENDED, forcing critical status grade.");
  } else if (org.status === "at_risk") {
    whyNarratives.push("Account is tagged 'At Risk' by relationship management.");
  }

  // 3. Attention Needed concrete items
  const attentionItems: Array<{
    id: string;
    type: "invoice" | "credit" | "seat" | "compliance" | "ticket" | "suspension";
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
    deepLinkTab: string;
    actionLabel: string;
  }> = [];

  if (org.status === "suspended") {
    attentionItems.push({
      id: "att_suspended",
      type: "suspension",
      severity: "critical",
      title: "Account Operationally Suspended",
      description: "Messaging gateways, template submission, and API traffic halted.",
      deepLinkTab: "activity",
      actionLabel: "View Audit Log",
    });
  }

  for (const inv of overdueInvoices) {
    const dueFormatted = inv.dueAt ? new Date(inv.dueAt).toLocaleDateString("en-IN") : "N/A";
    attentionItems.push({
      id: `att_inv_${inv.id}`,
      type: "invoice",
      severity: "critical",
      title: `Overdue Invoice #${inv.id}`,
      description: `₹${(inv.amount + (inv.gstAmount || 0)).toLocaleString("en-IN")} was due on ${dueFormatted}.`,
      deepLinkTab: "billing",
      actionLabel: "View Invoices",
    });
  }

  for (const ws of allWs) {
    if (ws.creditLimit > 0) {
      const util = Math.round((ws.creditUsed / ws.creditLimit) * 100);
      if (util >= 85) {
        attentionItems.push({
          id: `att_util_${ws.id}`,
          type: "credit",
          severity: util >= 95 ? "critical" : "warning",
          title: `High Credit Utilization: ${ws.name}`,
          description: `${util}% of ₹${(ws.creditLimit / 100000).toFixed(1)}L limit utilized. Risk of traffic throttling.`,
          deepLinkTab: "billing",
          actionLabel: "Increase Limit",
        });
      }
    }
  }

  if (seatStats.inactiveSeats > 0 && seatStats.wastedSeatPct >= 25) {
    attentionItems.push({
      id: "att_seat_waste",
      type: "seat",
      severity: "warning",
      title: `${seatStats.inactiveSeats} Unused Paid Seats`,
      description: `${seatStats.inactiveSeats} of ${seatStats.totalPaidSeats} paid seats have been inactive for over 45 days.`,
      deepLinkTab: "users",
      actionLabel: "Manage Seats",
    });
  }

  const pendingSenderIds = orgSenderIds.filter((s) => s.status === "submitted" || s.status === "in_review");
  for (const s of pendingSenderIds) {
    const daysWaiting = s.submittedAt ? Math.floor((Date.now() - new Date(s.submittedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    if (daysWaiting >= 3) {
      attentionItems.push({
        id: `att_sid_${s.id}`,
        type: "compliance",
        severity: daysWaiting >= 5 ? "critical" : "warning",
        title: `TRAI DLT Header Awaiting Approval: ${s.header}`,
        description: `Header '${s.header}' (${s.channel.toUpperCase()}) waiting for ${daysWaiting} days. SLA breached.`,
        deepLinkTab: "compliance",
        actionLabel: "Review Header",
      });
    }
  }

  for (const t of urgentTickets) {
    attentionItems.push({
      id: `att_tkt_${t.id}`,
      type: "ticket",
      severity: "critical",
      title: `Urgent Ticket: ${t.subject}`,
      description: `Category: ${t.category}. Ticket requires resolution.`,
      deepLinkTab: "tickets",
      actionLabel: "Open Ticket",
    });
  }

  // 4. Usage Aggregations (90 days, by channel & workspace)
  const usageSorted = [...orgUsage].sort((a, b) => a.date.localeCompare(b.date));
  const usageByDateWs = new Map<string, { date: string; wsId: string; sms: number; rcs: number; whatsapp: number; cost: number }>();
  
  for (const row of usageSorted) {
    const key = `${row.date}_${row.workspaceId}`;
    usageByDateWs.set(key, {
      date: row.date,
      wsId: row.workspaceId,
      sms: row.smsCount || 0,
      rcs: row.rcsCount || 0,
      whatsapp: row.whatsappCount || 0,
      cost: row.cost || 0,
    });
  }

  // Daily totals
  const dailyTotalsMap = new Map<string, { date: string; sms: number; rcs: number; whatsapp: number; totalMessages: number; cost: number }>();
  for (const row of usageSorted) {
    const prev = dailyTotalsMap.get(row.date) || { date: row.date, sms: 0, rcs: 0, whatsapp: 0, totalMessages: 0, cost: 0 };
    prev.sms += row.smsCount || 0;
    prev.rcs += row.rcsCount || 0;
    prev.whatsapp += row.whatsappCount || 0;
    prev.totalMessages += (row.smsCount || 0) + (row.rcsCount || 0) + (row.whatsappCount || 0);
    prev.cost += row.cost || 0;
    dailyTotalsMap.set(row.date, prev);
  }
  const dailyUsage = Array.from(dailyTotalsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // 30-day overview stats
  const last30DaysUsage = dailyUsage.slice(-30);
  const totalMessages30d = last30DaysUsage.reduce((acc, d) => acc + d.totalMessages, 0);
  const totalSpend30d = last30DaysUsage.reduce((acc, d) => acc + d.cost, 0);
  
  // Delivery rate estimate
  const avgDeliveryPct = orgUsage.length > 0
    ? Math.round((orgUsage.reduce((acc, u) => acc + (u.deliveredPct || 98.5), 0) / orgUsage.length) * 10) / 10
    : 98.5;

  // 5. Workspaces detail enrichment
  const enrichedWorkspaces = allWs.map((ws) => {
    const wsKycList = orgKyc.filter((k) => k.workspaceId === ws.id);
    const wsSenderList = orgSenderIds.filter((s) => s.workspaceId === ws.id);
    const wsTemplateList = orgTemplates.filter((t) => t.workspaceId === ws.id);
    const wsUsersList = orgWUsers.filter((u) => u.workspaceId === ws.id);
    const wsUsageList = orgUsage.filter((u) => u.workspaceId === ws.id);

    const exhaustion = projectedCreditExhaustionDate(
      { creditLimit: ws.creditLimit, creditUsed: ws.creditUsed },
      wsUsageList.map((u) => ({ date: u.date, cost: u.cost }))
    );

    return {
      ...ws,
      kyc: wsKycList[0] || null,
      senderIdsCount: wsSenderList.length,
      templatesCount: wsTemplateList.length,
      usersCount: wsUsersList.length,
      exhaustion,
    };
  });

  // 6. Users and Seats breakdown
  const nowMs = Date.now();
  const FORTY_FIVE_DAYS_MS = 45 * 24 * 60 * 60 * 1000;
  const enrichedUsers = orgWUsers.map((u) => {
    const ws = allWs.find((w) => w.id === u.workspaceId);
    let isInactive45Days = false;
    let daysSinceLogin: number | null = null;

    if (!u.lastLoginAt) {
      isInactive45Days = true;
    } else {
      const loginTime = u.lastLoginAt instanceof Date ? u.lastLoginAt.getTime() : new Date(u.lastLoginAt).getTime();
      daysSinceLogin = Math.floor((nowMs - loginTime) / (1000 * 60 * 60 * 24));
      if (daysSinceLogin >= 45) {
        isInactive45Days = true;
      }
    }

    return {
      ...u,
      workspaceName: ws?.name || u.workspaceId,
      isInactive45Days,
      daysSinceLogin,
    };
  });

  // Cost of wasted seats (at ₹1,500/seat/month standard price)
  const SEAT_MONTHLY_COST = 1500;
  const wastedSeatCostMonthly = seatStats.inactiveSeats * SEAT_MONTHLY_COST;

  // 7. Subscriptions & Pricing
  const defaultRateCard = plan?.perMessageRates ? JSON.parse(plan.perMessageRates) : { sms: 0.12, rcs: 0.18, whatsapp: 0.35 };
  const featuresList = plan?.features ? JSON.parse(plan.features) : [];

  const enrichedSubscriptions = orgSubs.map((s) => {
    const ws = allWs.find((w) => w.id === s.workspaceId);
    const overrides = s.customPriceOverrides ? JSON.parse(s.customPriceOverrides) : null;
    return {
      ...s,
      workspaceName: ws?.name || s.workspaceId,
      customRates: overrides,
    };
  });

  const enrichedAddons = orgWsAddons.map((wa) => {
    const catalogItem = allAddonsCatalog.find((c) => c.id === wa.addonId);
    const ws = allWs.find((w) => w.id === wa.workspaceId);
    return {
      ...wa,
      name: catalogItem?.name || wa.addonId,
      type: catalogItem?.type || "recurring",
      price: catalogItem?.price || 0,
      workspaceName: ws?.name || wa.workspaceId,
    };
  });

  // 8. Suspension info (if suspended)
  let suspensionDetails: { date: Date | null; reason: string } | null = null;
  if (org.status === "suspended") {
    const suspendAudit = allAudit.find((a) => a.action.includes("suspend"));
    suspensionDetails = {
      date: suspendAudit?.timestamp || org.updatedAt,
      reason: suspendAudit?.reason || "Account suspended due to outstanding dues and policy violation.",
    };
  }

  let parsedTags: string[] = [];
  if (org.tags) {
    try {
      parsedTags = JSON.parse(org.tags);
    } catch {
      parsedTags = [];
    }
  }

  return {
    organization: {
      ...org,
      tags: parsedTags,
    },
    plan,
    ownerAm,
    allInternalUsers,
    health,
    healthNarrative: whyNarratives,
    attentionItems,
    stats: {
      totalMessages30d,
      totalSpend30d: Math.round(totalSpend30d),
      avgDeliveryPct,
      activeWorkspacesCount: allWs.filter((w) => w.status === "active").length,
      totalWorkspacesCount: allWs.length,
      totalPaidSeats: seatStats.totalPaidSeats,
      activeSeats: seatStats.activeSeats,
      inactiveSeats: seatStats.inactiveSeats,
      wastedSeatCostMonthly,
      totalCreditLimit: allWs.reduce((acc, w) => acc + (w.creditLimit || 0), 0),
      totalCreditUsed: allWs.reduce((acc, w) => acc + (w.creditUsed || 0), 0),
      totalWalletBalance: allWs.reduce((acc, w) => acc + (w.walletBalance || 0), 0),
    },
    dailyUsage,
    usageByDateWs: Array.from(usageByDateWs.values()),
    workspaces: enrichedWorkspaces,
    users: enrichedUsers,
    seatStats,
    pricing: {
      plan,
      defaultRateCard,
      featuresList,
      subscriptions: enrichedSubscriptions,
      addons: enrichedAddons,
    },
    invoices: orgInvoices.sort((a, b) => (b.issuedAt ? new Date(b.issuedAt).getTime() : 0) - (a.issuedAt ? new Date(a.issuedAt).getTime() : 0)),
    walletTransactions: orgWalletTxns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    creditHistory: orgCreditHist.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    compliance: {
      kycCases: orgKyc.map((k) => {
        const docs = k.documents ? JSON.parse(k.documents) : [];
        const declared = k.declaredData ? JSON.parse(k.declaredData) : {};
        const daysWaiting = k.submittedAt ? Math.floor((nowMs - new Date(k.submittedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return {
          ...k,
          documentsList: docs,
          declaredDataObj: declared,
          daysWaiting,
        };
      }),
      senderIds: orgSenderIds.map((s) => {
        const daysWaiting = s.submittedAt ? Math.floor((nowMs - new Date(s.submittedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return {
          ...s,
          daysWaiting,
        };
      }),
      templates: orgTemplates,
    },
    tickets: allTickets,
    auditLogs: allAudit,
    tasks: allTasks,
    suspensionDetails,
    onboardingChecklist: await getOnboardingChecklist(orgId),
  };
}

/**
 * Audit-logged CSV export for accounts list
 */
export async function exportAccountsCsv(actor: { id: string; role: string; name: string }) {
  const accounts = await getAccountsList();

  const isSupport = actor.role === "support";

  // Build CSV header
  const headers = [
    "Organization ID",
    "Organization Name",
    "Legal Name",
    "Industry",
    "City",
    "Status",
    "Billing Model",
    "Plan",
    "Health Score",
    "Health Grade",
    ...(isSupport ? [] : ["Credit Limit", "Credit Used", "Utilization %", "Wallet Balance"]),
    "30d Trend %",
    "Open Tickets",
    "Compliance Dot",
    "Owner AM",
    "Contract End",
  ];

  const rows = accounts.map((a) => {
    const endStr = a.contractEnd ? new Date(a.contractEnd).toLocaleDateString("en-IN") : "";
    const fields = [
      `"${a.id}"`,
      `"${a.name.replace(/"/g, '""')}"`,
      `"${a.legalName.replace(/"/g, '""')}"`,
      `"${a.industry}"`,
      `"${a.city}"`,
      `"${a.status}"`,
      `"${a.billingModel}"`,
      `"${a.planName}"`,
      a.health.score,
      `"${a.health.grade}"`,
      ...(isSupport
        ? []
        : [
            a.financialPosition.creditLimit,
            a.financialPosition.creditUsed,
            `${a.financialPosition.utilizationPct}%`,
            a.financialPosition.walletBalance,
          ]),
      `${a.usage.trendPct}%`,
      a.openTicketsCount,
      `"${a.complianceDot}"`,
      `"${a.ownerAmName.replace(/"/g, '""')}"`,
      `"${endStr}"`,
    ];
    return fields.join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");

  // Audit log export action
  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "accounts_list_exported_csv",
    targetType: "export",
    targetId: "accounts_list",
    reason: `Exported ${accounts.length} organization records to CSV format.`,
    after: { totalRecords: accounts.length, isSupportRestricted: isSupport },
  });

  return csvContent;
}

/**
 * Updates support ticket status directly from the Account 360 Tickets tab
 */
export async function updateTicketStatus(input: {
  ticketId: string;
  orgId: string;
  status: "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
  actorId: string;
  actorRole: string;
  note?: string;
}) {
  const currentTicket = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, input.ticketId))
    .get();

  if (!currentTicket) {
    throw new Error(`Ticket '${input.ticketId}' not found.`);
  }

  const resolvedAt = input.status === "resolved" || input.status === "closed" ? new Date() : null;

  await db
    .update(tickets)
    .set({
      status: input.status,
      resolvedAt,
    })
    .where(eq(tickets.id, input.ticketId));

  await writeAudit({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: `ticket_status_changed_to_${input.status}`,
    targetType: "ticket",
    targetId: input.ticketId,
    orgId: input.orgId,
    before: { status: currentTicket.status },
    after: { status: input.status, note: input.note },
    reason: input.note?.trim() || `Ticket status transitioned from ${currentTicket.status} to ${input.status}.`,
  });

  return { success: true };
}

/**
 * Creates an operational task for an account
 */
export async function createOrgTask(input: {
  orgId: string;
  assignedTo: string;
  title: string;
  dueAt?: Date | null;
  actorId: string;
  actorRole: string;
}) {
  const id = `tsk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  await db.insert(tasks).values({
    id,
    orgId: input.orgId,
    assignedTo: input.assignedTo,
    title: input.title.trim(),
    source: "manual",
    status: "pending",
    dueAt: input.dueAt || null,
  });

  await writeAudit({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "task_created",
    targetType: "organization",
    targetId: input.orgId,
    orgId: input.orgId,
    reason: `Assigned task: "${input.title}"`,
    after: { taskId: id, assignedTo: input.assignedTo },
  });

  return { success: true, taskId: id };
}

export async function getAllOrganizations() {
  return await db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.createdAt));
}

export async function getOrganizationById(id: string) {
  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);

  if (!org || org.length === 0) return null;

  const orgWorkspaces = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.orgId, id));

  return {
    ...org[0],
    workspaces: orgWorkspaces,
  };
}

export async function getPlatformOverviewStats() {
  const orgs = await db.select().from(organizations);
  const allWs = await db.select().from(workspaces);
  const recentUsage = await db.select().from(usageDaily);

  const totalCost = recentUsage.reduce((acc, u) => acc + (u.cost || 0), 0);
  const totalMRR = Math.round(totalCost / 3);

  const totalCreditLimit = allWs.reduce((acc, w) => acc + (w.creditLimit || 0), 0);
  const totalCreditUsed = allWs.reduce((acc, w) => acc + (w.creditUsed || 0), 0);
  const totalPrepaidWallet = allWs.reduce((acc, w) => acc + (w.walletBalance > 0 ? w.walletBalance : 0), 0);
  const atRiskCount = orgs.filter((o) => o.status === "at_risk").length;
  const activeWorkspacesCount = allWs.filter((w) => w.status === "active").length;

  return {
    totalMRR,
    totalCreditLimit,
    totalCreditUsed,
    totalPrepaidWallet,
    atRiskCount,
    totalOrganizations: orgs.length,
    activeWorkspacesCount,
    totalWorkspaces: allWs.length,
  };
}
