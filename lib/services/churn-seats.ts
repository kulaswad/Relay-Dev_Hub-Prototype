import { db } from "@/lib/db";
import {
  organizations,
  workspaces,
  workspaceUsers,
  invoices,
  usageDaily,
  tickets,
  plans,
  subscriptions,
  internalUsers,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export interface ChurnSignal {
  category: "usage" | "delivery" | "activity" | "tickets" | "payments" | "contract";
  title: string;
  valueDisplay: string;
  pointsAdded: number;
  description: string;
  isTriggered: boolean;
}

export interface ChurnAnalysis {
  orgId: string;
  orgName: string;
  totalScore: number; // 0-100
  riskBand: "Low" | "Medium" | "High";
  signals: ChurnSignal[];
  summaryText: string;
}

export interface UnusedSeatAnalysis {
  orgId: string;
  totalPurchasedSeats: number;
  activeSeats: number;
  inactiveSeatsCount: number;
  estimatedMonthlyWasteInr: number;
  costPerSeatMonthlyInr: number;
  inactiveUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    lastLoginAt: string | null;
    daysInactive: number;
    isProtectedOwner: boolean;
  }>;
  recommendedAction: string;
  disclaimer: string;
}

export interface ChurnRecommendation {
  id: string;
  title: string;
  description: string;
  type: "meeting" | "credit" | "seats" | "delivery" | "collections";
  impactScore: number;
  suggestedActionTitle: string;
}

/**
 * Calculates transparent, weighted Churn Risk Score (0-100) per organization
 * DELIBERATELY DETERMINISTIC (NO LLM) to avoid numerical hallucination.
 */
export function calculateOrgChurnRisk(orgId: string): ChurnAnalysis {
  const org = db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  if (!org) throw new Error(`Organization ${orgId} not found`);

  const orgWorkspaces = db
    .select()
    .from(workspaces)
    .where(eq(workspaces.orgId, orgId))
    .all();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);

  // 1. Usage Decline vs Prior 30 Days
  let spend30d = 0;
  let spendPrior30d = 0;
  let totalVol30d = 0;
  let totalDelivered30d = 0;

  for (const ws of orgWorkspaces) {
    const daily = db
      .select()
      .from(usageDaily)
      .where(eq(usageDaily.workspaceId, ws.id))
      .all();

    for (const d of daily) {
      const dDate = new Date(d.date);
      if (dDate >= thirtyDaysAgo) {
        spend30d += d.cost || 0;
        const vol = (d.smsCount || 0) + (d.rcsCount || 0) + (d.whatsappCount || 0);
        totalVol30d += vol;
        totalDelivered30d += Math.round(vol * ((d.deliveredPct || 98.5) / 100));
      } else if (dDate >= sixtyDaysAgo) {
        spendPrior30d += d.cost || 0;
      }
    }
  }

  const usageDeltaPct =
    spendPrior30d > 0
      ? Math.round(((spend30d - spendPrior30d) / spendPrior30d) * 100)
      : 0;

  let usagePoints = 0;
  let usageVal = `${usageDeltaPct >= 0 ? "+" : ""}${usageDeltaPct}% vs prior 30d`;
  if (usageDeltaPct < -30) {
    usagePoints = 28;
  } else if (usageDeltaPct < -15) {
    usagePoints = 15;
  } else if (usageDeltaPct < -5) {
    usagePoints = 8;
  }

  // 2. Delivery Rate Drop
  const deliveryRate =
    totalVol30d > 0 ? Math.round((totalDelivered30d / totalVol30d) * 1000) / 10 : 98.2;

  let deliveryPoints = 0;
  if (deliveryRate < 85) {
    deliveryPoints = 22;
  } else if (deliveryRate < 92) {
    deliveryPoints = 12;
  } else if (deliveryRate < 96) {
    deliveryPoints = 5;
  }

  // 3. Login Activity of Owner / Admins
  let adminLastLoginDays = 5;
  const wsUsers = db
    .select()
    .from(workspaceUsers)
    .innerJoin(workspaces, eq(workspaceUsers.workspaceId, workspaces.id))
    .where(eq(workspaces.orgId, orgId))
    .all();

  const keyUsers = wsUsers.filter(
    (u) => u.workspace_users.tier === "owner" || u.workspace_users.tier === "admin"
  );

  let minKeyUserDaysInactive = 999;
  for (const u of keyUsers) {
    if (u.workspace_users.lastLoginAt) {
      const days = Math.floor(
        (now.getTime() - new Date(u.workspace_users.lastLoginAt).getTime()) / 86400000
      );
      if (days < minKeyUserDaysInactive) minKeyUserDaysInactive = days;
    }
  }
  if (minKeyUserDaysInactive === 999) minKeyUserDaysInactive = 45;
  adminLastLoginDays = minKeyUserDaysInactive;

  let loginPoints = 0;
  if (adminLastLoginDays > 30) {
    loginPoints = 18;
  } else if (adminLastLoginDays > 14) {
    loginPoints = 10;
  }

  // 4. Ticket Sentiment Proxy (Escalated & Open Tickets)
  const orgTickets = db
    .select()
    .from(tickets)
    .where(eq(tickets.orgId, orgId))
    .all();

  const escalatedOrUrgent = orgTickets.filter(
    (t) => t.priority === "urgent" || (t.status !== "resolved" && t.status !== "closed" && t.category === "billing")
  ).length;

  const ticketPoints = Math.min(20, escalatedOrUrgent * 7);

  // 5. Payment Delays & Overdue Invoices
  let maxOverdueDays = 0;
  let totalOverdueAmount = 0;

  for (const ws of orgWorkspaces) {
    const invs = db.select().from(invoices).where(eq(invoices.workspaceId, ws.id)).all();
    for (const inv of invs) {
      if (inv.status === "issued" || inv.status === "overdue") {
        const dueDate = new Date(inv.dueAt);
        if (dueDate < now) {
          totalOverdueAmount += (inv.amount || 0) + (inv.gstAmount || 0);
          const days = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
          if (days > maxOverdueDays) maxOverdueDays = days;
        }
      }
    }
  }

  let paymentPoints = 0;
  if (maxOverdueDays > 30) {
    paymentPoints = 20;
  } else if (maxOverdueDays > 7) {
    paymentPoints = 12;
  } else if (maxOverdueDays > 0) {
    paymentPoints = 6;
  }

  // 6. Contract End within 60 Days
  let daysToContractEnd = 180;
  if (org.contractEnd) {
    daysToContractEnd = Math.floor((new Date(org.contractEnd).getTime() - now.getTime()) / 86400000);
  }

  let contractPoints = 0;
  if (daysToContractEnd <= 30 && daysToContractEnd > 0) {
    contractPoints = 18;
  } else if (daysToContractEnd <= 60 && daysToContractEnd > 0) {
    contractPoints = 10;
  }

  // Total Score Calculation
  const totalScore = Math.min(
    100,
    usagePoints + deliveryPoints + loginPoints + ticketPoints + paymentPoints + contractPoints
  );

  let riskBand: "Low" | "Medium" | "High" = "Low";
  if (totalScore >= 60) riskBand = "High";
  else if (totalScore >= 30) riskBand = "Medium";

  const signals: ChurnSignal[] = [
    {
      category: "usage",
      title: "30-Day Platform Spend Decline",
      valueDisplay: usageVal,
      pointsAdded: usagePoints,
      description:
        usagePoints > 0
          ? `Spend declined by ${Math.abs(usageDeltaPct)}% compared to the prior 30-day period.`
          : "Message volume and spend trajectory remain steady or growing.",
      isTriggered: usagePoints > 0,
    },
    {
      category: "delivery",
      title: "Carrier Route Delivery Rate",
      valueDisplay: `${deliveryRate}%`,
      pointsAdded: deliveryPoints,
      description:
        deliveryPoints > 0
          ? `Delivery rate dropped to ${deliveryRate}%, below normal 95% SLA baseline.`
          : "Delivery rate meets or exceeds the 95% enterprise SLA target.",
      isTriggered: deliveryPoints > 0,
    },
    {
      category: "activity",
      title: "Admin / Owner Login Frequency",
      valueDisplay: `${adminLastLoginDays}d since last login`,
      pointsAdded: loginPoints,
      description:
        loginPoints > 0
          ? `Primary account owners have been inactive on the portal for ${adminLastLoginDays} days.`
          : "Account administrators actively access the portal.",
      isTriggered: loginPoints > 0,
    },
    {
      category: "tickets",
      title: "Escalated or Billing Ticket Load",
      valueDisplay: `${escalatedOrUrgent} urgent ticket(s)`,
      pointsAdded: ticketPoints,
      description:
        ticketPoints > 0
          ? `${escalatedOrUrgent} escalated support tickets indicating technical or billing friction.`
          : "Support queues are clear with no urgent escalations.",
      isTriggered: ticketPoints > 0,
    },
    {
      category: "payments",
      title: "Overdue Receivables & Delays",
      valueDisplay: totalOverdueAmount > 0 ? `₹${totalOverdueAmount.toLocaleString("en-IN")} (${maxOverdueDays}d)` : "Current",
      pointsAdded: paymentPoints,
      description:
        paymentPoints > 0
          ? `Overdue unpaid balance outstanding past due date by ${maxOverdueDays} days.`
          : "All invoices are settled within standard commercial terms.",
      isTriggered: paymentPoints > 0,
    },
    {
      category: "contract",
      title: "Commercial Contract Expiry",
      valueDisplay: `${daysToContractEnd} days left`,
      pointsAdded: contractPoints,
      description:
        contractPoints > 0
          ? `Commercial contract renewal due in ${daysToContractEnd} days.`
          : "Contract renewal window is safe (>60 days).",
      isTriggered: contractPoints > 0,
    },
  ];

  return {
    orgId,
    orgName: org.name,
    totalScore,
    riskBand,
    signals,
    summaryText:
      riskBand === "High"
        ? `High churn probability (${totalScore}/100) triggered by ${signals.filter((s) => s.isTriggered).length} operational friction indicators.`
        : riskBand === "Medium"
        ? `Moderate churn risk (${totalScore}/100). Monitor renewals and delivery metrics closely.`
        : `Healthy relationship profile (${totalScore}/100). Engagement across all key pillars is stable.`,
  };
}

/**
 * Unused Seat Detection Engine
 * Finds seats paid but with no login in 45 days, computes monthly waste,
 * and recommends pre-filled seat reduction.
 * PROTECTS THE OWNER (Owner is NEVER recommended for removal).
 */
export function analyzeUnusedSeats(orgId: string): UnusedSeatAnalysis {
  const org = db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  if (!org) throw new Error(`Organization ${orgId} not found`);

  const orgWorkspaces = db.select().from(workspaces).where(eq(workspaces.orgId, orgId)).all();
  const now = new Date();
  const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 86400000);

  const costPerSeatMonthlyInr = 1500; // Standard additional seat price
  const inactiveUsers: any[] = [];
  let totalPurchased = 0;
  let activeUsersCount = 0;

  for (const ws of orgWorkspaces) {
    const users = db.select().from(workspaceUsers).where(eq(workspaceUsers.workspaceId, ws.id)).all();
    totalPurchased += users.length;

    for (const u of users) {
      if (u.seatActive) activeUsersCount++;
      const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt) : null;
      const isInactive = !lastLogin || lastLogin < fortyFiveDaysAgo;

      if (isInactive) {
        const daysInactive = lastLogin
          ? Math.floor((now.getTime() - lastLogin.getTime()) / 86400000)
          : 60;
        const isOwner = u.tier === "owner";

        inactiveUsers.push({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.tier,
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().split("T")[0] : null,
          daysInactive,
          isProtectedOwner: isOwner,
        });
      }
    }
  }

  // Filter out protected owner from removable seats count
  const removableInactiveSeats = inactiveUsers.filter((u) => !u.isProtectedOwner);
  const inactiveSeatsCount = removableInactiveSeats.length;
  const estimatedMonthlyWasteInr = inactiveSeatsCount * costPerSeatMonthlyInr;

  const recommendedAction =
    inactiveSeatsCount > 0
      ? `Remove ${inactiveSeatsCount} seat(s), saves ₹${estimatedMonthlyWasteInr.toLocaleString("en-IN")}/month`
      : "No inactive seats detected. Seat licensing is optimal.";

  return {
    orgId,
    totalPurchasedSeats: totalPurchased,
    activeSeats: activeUsersCount,
    inactiveSeatsCount,
    estimatedMonthlyWasteInr,
    costPerSeatMonthlyInr,
    inactiveUsers,
    recommendedAction,
    disclaimer:
      "Removing seats may affect users that are inactive but important. The Workspace Owner account is protected and will never be recommended for de-allocation.",
  };
}

/**
 * Generate Actionable Recommendations for AMs
 */
export function generateAMRecommendations(orgId: string): ChurnRecommendation[] {
  const churn = calculateOrgChurnRisk(orgId);
  const seats = analyzeUnusedSeats(orgId);
  const recs: ChurnRecommendation[] = [];

  // Check usage drop
  const usageSignal = churn.signals.find((s) => s.category === "usage");
  if (usageSignal && usageSignal.isTriggered) {
    recs.push({
      id: `rec_usage_${orgId}`,
      title: "Schedule proactive check-in on traffic slowdown",
      description: `Spend declined by ${usageSignal.valueDisplay}. Verify if client migrated promotional traffic or experienced integration bottlenecks.`,
      type: "meeting",
      impactScore: 85,
      suggestedActionTitle: "Schedule Technical & Commercial Sync",
    });
  }

  // Check delivery drop
  const delSignal = churn.signals.find((s) => s.category === "delivery");
  if (delSignal && delSignal.isTriggered) {
    recs.push({
      id: `rec_del_${orgId}`,
      title: "Review carrier routes & DLT template errors",
      description: `Delivery rate dropped to ${delSignal.valueDisplay}. Review operator delivery receipts to address DLT scrubbing rejection codes.`,
      type: "delivery",
      impactScore: 90,
      suggestedActionTitle: "Inspect Carrier Delivery Logs",
    });
  }

  // Check overdue payments
  const paySignal = churn.signals.find((s) => s.category === "payments");
  if (paySignal && paySignal.isTriggered) {
    recs.push({
      id: `rec_pay_${orgId}`,
      title: "Payment follow-up with client finance team",
      description: `Overdue balance of ${paySignal.valueDisplay}. Request remittance UTR to avoid credit line suspension.`,
      type: "collections",
      impactScore: 80,
      suggestedActionTitle: "Send Formal Statement of Account",
    });
  }

  // Check unused seats
  if (seats.inactiveSeatsCount > 0) {
    recs.push({
      id: `rec_seats_${orgId}`,
      title: `Optimize license costs: ${seats.recommendedAction}`,
      description: `${seats.inactiveSeatsCount} provisioned seat(s) inactive for >45 days. De-provisioning eliminates ₹${seats.estimatedMonthlyWasteInr.toLocaleString("en-IN")}/month of wasted SaaS overhead.`,
      type: "seats",
      impactScore: 75,
      suggestedActionTitle: "Submit Seat True-up Request",
    });
  }

  // Contract renewal
  const contractSignal = churn.signals.find((s) => s.category === "contract");
  if (contractSignal && contractSignal.isTriggered) {
    recs.push({
      id: `rec_renew_${orgId}`,
      title: "Initiate early contract renewal negotiations",
      description: `Contract expiry in ${contractSignal.valueDisplay}. Propose annual multi-channel commitment to lock in enterprise discount.`,
      type: "meeting",
      impactScore: 95,
      suggestedActionTitle: "Draft Renewal Commercial Proposal",
    });
  }

  return recs;
}
