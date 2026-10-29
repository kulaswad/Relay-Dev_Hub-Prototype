import { Organization, Workspace, WorkspaceUser, Ticket, Invoice, UsageDaily } from "@/lib/db/schema";

/**
 * Derived metrics calculation engine for Relay BMP.
 * All formulas are deterministic and adhere to internal Relay operations standards.
 */

// ---------------------------------------------------------------------------
// 1. Credit Utilization
// ---------------------------------------------------------------------------
/**
 * Calculates credit utilization ratio (0 to 1+) for a postpaid workspace.
 * Returns 0 if credit limit is 0 or unassigned.
 */
export function creditUtilization(workspace: Pick<Workspace, "creditLimit" | "creditUsed">): number {
  if (!workspace.creditLimit || workspace.creditLimit <= 0) return 0;
  return Math.max(0, workspace.creditUsed / workspace.creditLimit);
}

// ---------------------------------------------------------------------------
// 2. Seat Utilization & Waste
// ---------------------------------------------------------------------------
export interface SeatUtilizationResult {
  totalPaidSeats: number;
  activeSeats: number;
  inactiveSeats: number;
  utilizationPct: number; // 0 to 100
  wastedSeatPct: number; // 0 to 100
  hasSeatWaste: boolean; // Flagged if >30% paid seats inactive >45 days
}

export function seatUtilization(
  users: Array<Pick<WorkspaceUser, "seatActive" | "isSeatPaid" | "lastLoginAt">>
): SeatUtilizationResult {
  const paidSeats = users.filter((u) => u.isSeatPaid);
  const totalPaidSeats = paidSeats.length;

  if (totalPaidSeats === 0) {
    return {
      totalPaidSeats: 0,
      activeSeats: 0,
      inactiveSeats: 0,
      utilizationPct: 100,
      wastedSeatPct: 0,
      hasSeatWaste: false,
    };
  }

  const now = Date.now();
  const FORTY_FIVE_DAYS_MS = 45 * 24 * 60 * 60 * 1000;

  let inactivePaidSeats = 0;
  for (const user of paidSeats) {
    if (!user.seatActive) {
      inactivePaidSeats++;
    } else if (user.lastLoginAt) {
      const loginTime = user.lastLoginAt instanceof Date ? user.lastLoginAt.getTime() : new Date(user.lastLoginAt).getTime();
      if (now - loginTime > FORTY_FIVE_DAYS_MS) {
        inactivePaidSeats++;
      }
    } else {
      // Never logged in
      inactivePaidSeats++;
    }
  }

  const activeSeats = totalPaidSeats - inactivePaidSeats;
  const utilizationPct = Math.round((activeSeats / totalPaidSeats) * 100);
  const wastedSeatPct = Math.round((inactivePaidSeats / totalPaidSeats) * 100);

  return {
    totalPaidSeats,
    activeSeats,
    inactiveSeats: inactivePaidSeats,
    utilizationPct,
    wastedSeatPct,
    hasSeatWaste: wastedSeatPct >= 30,
  };
}

// ---------------------------------------------------------------------------
// 3. Usage Trend Percentage
// ---------------------------------------------------------------------------
/**
 * Calculates percentage change between the last `days` window and the preceding `days` window.
 * Formula: ((recentSpend - priorSpend) / priorSpend) * 100
 * Negative percentage indicates declining usage (churn risk).
 */
export function usageTrendPct(usageHistory: Array<Pick<UsageDaily, "date" | "cost">>, days: number = 30): number {
  if (!usageHistory || usageHistory.length < days) return 0;

  // Sort ascending by date
  const sorted = [...usageHistory].sort((a, b) => a.date.localeCompare(b.date));

  const recentWindow = sorted.slice(-days);
  const priorWindow = sorted.slice(-days * 2, -days);

  const recentSpend = recentWindow.reduce((acc, row) => acc + (row.cost || 0), 0);
  const priorSpend = priorWindow.reduce((acc, row) => acc + (row.cost || 0), 0);

  if (priorSpend === 0) {
    return recentSpend > 0 ? 100 : 0;
  }

  return Math.round(((recentSpend - priorSpend) / priorSpend) * 100);
}

// ---------------------------------------------------------------------------
// 4. Projected Credit Exhaustion Date (14-Day EWMA)
// ---------------------------------------------------------------------------
/**
 * Projects when a postpaid workspace will cross 100% of its credit limit
 * using an Exponentially Weighted Moving Average (EWMA) of daily spend over 14 days.
 * Smoothing factor alpha = 2 / (14 + 1) = 0.1333
 */
export function projectedCreditExhaustionDate(
  workspace: Pick<Workspace, "creditLimit" | "creditUsed">,
  usageHistory: Array<Pick<UsageDaily, "date" | "cost">>
): { daysRemaining: number | null; projectedDate: Date | null; dailyBurnEWMA: number } {
  const limit = workspace.creditLimit || 0;
  const used = workspace.creditUsed || 0;
  const headroom = limit - used;

  if (headroom <= 0) {
    return { daysRemaining: 0, projectedDate: new Date(), dailyBurnEWMA: 0 };
  }

  if (!usageHistory || usageHistory.length === 0) {
    return { daysRemaining: null, projectedDate: null, dailyBurnEWMA: 0 };
  }

  // Last 14 days sorted chronologically
  const recent14 = [...usageHistory]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  if (recent14.length === 0) {
    return { daysRemaining: null, projectedDate: null, dailyBurnEWMA: 0 };
  }

  // Calculate 14-day EWMA
  const alpha = 2 / (recent14.length + 1);
  let ewma = recent14[0].cost || 0;

  for (let i = 1; i < recent14.length; i++) {
    ewma = alpha * (recent14[i].cost || 0) + (1 - alpha) * ewma;
  }

  if (ewma <= 10) {
    // Negligible daily burn
    return { daysRemaining: null, projectedDate: null, dailyBurnEWMA: ewma };
  }

  const daysRemaining = Math.max(1, Math.round(headroom / ewma));
  const projectedDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);

  return {
    daysRemaining,
    projectedDate,
    dailyBurnEWMA: Math.round(ewma),
  };
}

// ---------------------------------------------------------------------------
// 5. Account 360 Customer Health Score (0 - 100)
// ---------------------------------------------------------------------------
/**
 * Computes an Indian B2B SaaS health score (0-100) with documented weights:
 * - Usage Trend (30% weight): -30% drop severely penalizes; sustained growth rewards.
 * - Payment Behaviour (25% weight): Overdue or disputed invoices severely deduct.
 * - Ticket Pressure (15% weight): High/urgent open tickets reduce score.
 * - Seat Utilization (15% weight): Wasted seats (>30% inactive) reduce score.
 * - Compliance & KYC (15% weight): KYC pending or suspended status reduces score.
 */
export interface HealthScoreInput {
  organization: Pick<Organization, "status">;
  workspaces: Array<Pick<Workspace, "status" | "billingState">>;
  usageHistory: Array<Pick<UsageDaily, "date" | "cost">>;
  invoices: Array<Pick<Invoice, "status" | "amount" | "dueAt">>;
  tickets: Array<Pick<Ticket, "status" | "priority">>;
  workspaceUsers: Array<Pick<WorkspaceUser, "seatActive" | "isSeatPaid" | "lastLoginAt">>;
}

export function healthScore(input: HealthScoreInput): {
  score: number;
  grade: "Healthy" | "At Risk" | "Critical";
  breakdown: {
    usageTrendScore: number; // Max 30
    paymentScore: number; // Max 25
    ticketScore: number; // Max 15
    seatScore: number; // Max 15
    complianceScore: number; // Max 15
  };
} {
  // 1. Usage Trend component (Weight: 30 pts)
  const trend = usageTrendPct(input.usageHistory, 30);
  let usageTrendScore = 22; // baseline
  if (trend >= 15) usageTrendScore = 30;
  else if (trend >= 0) usageTrendScore = 26;
  else if (trend >= -15) usageTrendScore = 18;
  else if (trend >= -30) usageTrendScore = 10;
  else usageTrendScore = 2; // >30% decline = severe churn risk

  // 2. Payment Behaviour component (Weight: 25 pts)
  let paymentScore = 25;
  const overdueCount = input.invoices.filter((inv) => inv.status === "overdue").length;
  const disputedCount = input.invoices.filter((inv) => inv.status === "disputed").length;

  if (overdueCount > 0) {
    paymentScore -= Math.min(20, overdueCount * 12);
  }
  if (disputedCount > 0) {
    paymentScore -= Math.min(15, disputedCount * 8);
  }
  paymentScore = Math.max(0, paymentScore);

  // 3. Ticket Pressure component (Weight: 15 pts)
  let ticketScore = 15;
  const openUrgentTickets = input.tickets.filter(
    (t) => (t.status === "open" || t.status === "in_progress") && (t.priority === "urgent" || t.priority === "high")
  ).length;

  if (openUrgentTickets >= 3) ticketScore = 2;
  else if (openUrgentTickets === 2) ticketScore = 6;
  else if (openUrgentTickets === 1) ticketScore = 10;

  // 4. Seat Utilization component (Weight: 15 pts)
  const seatStats = seatUtilization(input.workspaceUsers);
  let seatScore = 15;
  if (seatStats.wastedSeatPct > 50) seatScore = 4;
  else if (seatStats.wastedSeatPct >= 30) seatScore = 8;
  else if (seatStats.wastedSeatPct >= 15) seatScore = 12;

  // 5. Compliance & Status component (Weight: 15 pts)
  let complianceScore = 15;
  if (input.organization.status === "suspended") {
    complianceScore = 0;
  } else if (input.organization.status === "at_risk") {
    complianceScore = 6;
  } else if (input.organization.status === "onboarding") {
    complianceScore = 10;
  }

  const anyWsSuspended = input.workspaces.some((w) => w.status === "suspended");
  if (anyWsSuspended && complianceScore > 4) {
    complianceScore = 4;
  }

  const totalScore = Math.min(
    100,
    Math.max(0, usageTrendScore + paymentScore + ticketScore + seatScore + complianceScore)
  );

  let grade: "Healthy" | "At Risk" | "Critical" = "Healthy";
  if (totalScore < 50 || input.organization.status === "suspended") {
    grade = "Critical";
  } else if (totalScore < 70 || input.organization.status === "at_risk") {
    grade = "At Risk";
  }

  return {
    score: totalScore,
    grade,
    breakdown: {
      usageTrendScore,
      paymentScore,
      ticketScore,
      seatScore,
      complianceScore,
    },
  };
}
