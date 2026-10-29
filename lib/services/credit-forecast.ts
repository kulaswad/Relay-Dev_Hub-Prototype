import { db } from "@/lib/db";
import { workspaces, organizations, invoices, usageDaily, internalUsers } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { executeStructuredAI, AIExecutionResult } from "@/lib/ai/client";

// Whitelisted Zod Filter Schema
export const FilterOperatorSchema = z.object({
  op: z.enum([">=", "<=", ">", "<", "="]),
  value: z.number(),
});

export const CreditQueryFilterSchema = z.object({
  billing_model: z.enum(["postpaid", "prepaid", "all"]).optional().default("postpaid"),
  utilization_now: FilterOperatorSchema.optional(),
  projected_utilization_eom: FilterOperatorSchema.optional(),
  overdue_amount: FilterOperatorSchema.optional(),
  days_overdue: FilterOperatorSchema.optional(),
  status: z.enum(["active", "at_risk", "suspended", "onboarding"]).optional(),
  industry: z.string().optional(),
  plan: z.string().optional(),
  am: z.string().optional(),
  sort: z
    .enum(["utilization_desc", "projected_desc", "burn_desc", "overdue_desc"])
    .optional()
    .default("projected_desc"),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export type CreditQueryFilter = z.infer<typeof CreditQueryFilterSchema>;

export interface WorkspaceCreditForecast {
  workspaceId: string;
  workspaceName: string;
  orgId: string;
  orgName: string;
  industry: string;
  planName: string;
  billingModel: "postpaid" | "prepaid";
  creditLimit: number;
  availableCredit: number;
  usedCredit: number;
  currentUtilizationPct: number;
  ewmaDailyBurn: number;
  burnVarianceLow: number;
  burnVarianceHigh: number;
  projectedUtilizationEomPct: number;
  projectedBreach80Date: string | null; // ISO string or "Already breached" or null
  projectedBreach100Date: string | null;
  confidence: "high" | "medium" | "low";
  overdueAmount: number;
  maxDaysOverdue: number;
  assignedAmId: string;
  assignedAmName: string;
  daysRemainingInMonth: number;
}

export interface CreditQueryResult {
  parsedFilter: CreditQueryFilter;
  filterChips: string[];
  results: WorkspaceCreditForecast[];
  totalMatches: number;
  suggestedQueries?: string[];
}

/**
 * Deterministic EWMA Credit Forecast Engine (No LLM)
 * Computes 14-day EWMA burn, spend variance, projected EOM utilization,
 * breach dates (80% and 100%), and confidence.
 */
export function computeAllCreditForecasts(): WorkspaceCreditForecast[] {
  const allWs = db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      orgId: workspaces.orgId,
      creditLimit: workspaces.creditLimit,
      creditUsed: workspaces.creditUsed,
      walletBalance: workspaces.walletBalance,
      status: workspaces.status,
      orgName: organizations.name,
      industry: organizations.industry,
      billingModel: organizations.billingModel,
      amId: organizations.ownerAmId,
      amName: internalUsers.name,
    })
    .from(workspaces)
    .innerJoin(organizations, eq(workspaces.orgId, organizations.id))
    .leftJoin(internalUsers, eq(organizations.ownerAmId, internalUsers.id))
    .all();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemainingInMonth = Math.max(1, lastDayOfMonth - currentDay);

  const forecasts: WorkspaceCreditForecast[] = [];

  for (const ws of allWs) {
    if (ws.billingModel !== "postpaid" && ws.billingModel !== "prepaid") continue;

    const limit = ws.creditLimit || 0;
    const used = ws.creditUsed || 0;
    const available = Math.max(0, limit - used);
    const currentUtil = limit > 0 ? (used / limit) * 100 : 0;

    // Fetch past 30 days of daily usage
    const usageRecords = db
      .select({
        date: usageDaily.date,
        cost: usageDaily.cost,
      })
      .from(usageDaily)
      .where(eq(usageDaily.workspaceId, ws.id))
      .orderBy(desc(usageDaily.date))
      .limit(30)
      .all();

    // 14-day EWMA calculation: alpha = 2 / (14 + 1) = 0.1333
    const recentRecords = usageRecords.slice(0, 14);
    const spends = recentRecords.map((r) => r.cost);

    let ewmaBurn = 0;
    let variance = 0;
    let confidence: "high" | "medium" | "low" = "low";

    if (spends.length > 0) {
      const alpha = 2 / (14 + 1);
      // EWMA computation from oldest to newest in the 14-day window
      const chronological = [...spends].reverse();
      ewmaBurn = chronological[0];
      for (let i = 1; i < chronological.length; i++) {
        ewmaBurn = alpha * chronological[i] + (1 - alpha) * ewmaBurn;
      }

      // Sample variance & standard deviation
      const mean = spends.reduce((a, b) => a + b, 0) / spends.length;
      const squaredDiffs = spends.map((s) => Math.pow(s - mean, 2));
      const varianceVal =
        spends.length > 1
          ? squaredDiffs.reduce((a, b) => a + b, 0) / (spends.length - 1)
          : 0;
      const stdDev = Math.sqrt(varianceVal);
      variance = stdDev;

      // Confidence: based on data points and coefficient of variation
      const cv = mean > 0 ? stdDev / mean : 1.0;
      if (spends.length >= 12 && cv < 0.45) {
        confidence = "high";
      } else if (spends.length >= 7 && cv < 0.9) {
        confidence = "medium";
      } else {
        confidence = "low";
      }
    } else {
      // No recent usage records: fallback to baseline burn
      ewmaBurn = ws.billingModel === "postpaid" ? limit * 0.015 : 500;
      confidence = "low";
    }

    const burnVarianceLow = Math.max(0, ewmaBurn - 1.96 * variance);
    const burnVarianceHigh = ewmaBurn + 1.96 * variance;

    // Projected Month-End Utilization
    const projectedSpendEom = daysRemainingInMonth * ewmaBurn;
    const projectedTotalUsed = used + projectedSpendEom;
    const projectedUtilizationEomPct =
      limit > 0 ? (projectedTotalUsed / limit) * 100 : 0;

    // Breach dates calculation
    let projectedBreach80Date: string | null = null;
    let projectedBreach100Date: string | null = null;

    if (ws.billingModel === "postpaid" && limit > 0) {
      const target80 = limit * 0.8;
      const target100 = limit * 1.0;

      // 80% check
      if (used >= target80) {
        projectedBreach80Date = "Already breached";
      } else if (ewmaBurn > 0) {
        const needed = target80 - used;
        const daysTo80 = needed / ewmaBurn;
        if (daysTo80 <= daysRemainingInMonth) {
          const breachDate = new Date(now.getTime() + daysTo80 * 86400000);
          projectedBreach80Date = breachDate.toISOString().split("T")[0];
        }
      }

      // 100% check
      if (used >= target100) {
        projectedBreach100Date = "Exhausted";
      } else if (ewmaBurn > 0) {
        const needed = target100 - used;
        const daysTo100 = needed / ewmaBurn;
        if (daysTo100 <= daysRemainingInMonth) {
          const breachDate = new Date(now.getTime() + daysTo100 * 86400000);
          projectedBreach100Date = breachDate.toISOString().split("T")[0];
        }
      }
    }

    // Invoices & Overdue calculation
    const wsInvoices = db
      .select({
        status: invoices.status,
        amount: invoices.amount,
        gstAmount: invoices.gstAmount,
        dueAt: invoices.dueAt,
      })
      .from(invoices)
      .where(eq(invoices.workspaceId, ws.id))
      .all();

    let overdueAmount = 0;
    let maxDaysOverdue = 0;

    for (const inv of wsInvoices) {
      if (inv.status === "issued" || inv.status === "overdue") {
        const dueDate = new Date(inv.dueAt);
        if (dueDate < now) {
          const daysOver = Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          const totalAmt = (inv.amount || 0) + (inv.gstAmount || 0);
          overdueAmount += totalAmt;
          if (daysOver > maxDaysOverdue) {
            maxDaysOverdue = daysOver;
          }
        }
      }
    }

    forecasts.push({
      workspaceId: ws.id,
      workspaceName: ws.name,
      orgId: ws.orgId,
      orgName: ws.orgName,
      industry: ws.industry,
      planName: "Enterprise / Growth",
      billingModel: ws.billingModel as "postpaid" | "prepaid",
      creditLimit: limit,
      availableCredit: available,
      usedCredit: used,
      currentUtilizationPct: Math.round(currentUtil * 10) / 10,
      ewmaDailyBurn: Math.round(ewmaBurn),
      burnVarianceLow: Math.round(burnVarianceLow),
      burnVarianceHigh: Math.round(burnVarianceHigh),
      projectedUtilizationEomPct: Math.round(projectedUtilizationEomPct * 10) / 10,
      projectedBreach80Date,
      projectedBreach100Date,
      confidence,
      overdueAmount,
      maxDaysOverdue,
      assignedAmId: ws.amId || "",
      assignedAmName: ws.amName || "Unassigned",
      daysRemainingInMonth,
    });
  }

  return forecasts;
}

/**
 * Rule-based fallback filter parser for when LLM is unavailable or offline
 */
export function parseCreditQueryRuleBased(query: string): CreditQueryFilter {
  const q = query.toLowerCase();
  const filter: CreditQueryFilter = {
    billing_model: "postpaid",
    sort: "projected_desc",
    limit: 20,
  };

  if (q.includes("prepaid")) {
    filter.billing_model = "prepaid";
  } else if (q.includes("all")) {
    filter.billing_model = "all";
  }

  // 80% check
  if (q.includes("80%") || q.includes("80 percent") || q.includes("cross 80")) {
    filter.projected_utilization_eom = { op: ">=", value: 80 };
  } else if (q.includes("100%") || q.includes("exhaust") || q.includes("breach")) {
    filter.projected_utilization_eom = { op: ">=", value: 100 };
  }

  // Overdue check
  if (q.includes("overdue") || q.includes("unpaid")) {
    filter.overdue_amount = { op: ">", value: 0 };
    if (q.includes("30 days") || q.includes(">30")) {
      filter.days_overdue = { op: ">=", value: 30 };
    }
  }

  // High utilization
  if (q.includes("high utilization") || q.includes("utilization high") || q.includes("near limit")) {
    filter.utilization_now = { op: ">=", value: 75 };
  }

  // Industry
  if (q.includes("fintech") || q.includes("finance")) {
    filter.industry = "Fintech";
  } else if (q.includes("ecommerce") || q.includes("retail")) {
    filter.industry = "E-Commerce";
  } else if (q.includes("health") || q.includes("pharma")) {
    filter.industry = "Healthcare";
  }

  // Status
  if (q.includes("at risk") || q.includes("at-risk")) {
    filter.status = "at_risk";
  }

  return filter;
}

/**
 * Translate natural language query to filter chips for UI display
 */
export function formatFilterChips(f: CreditQueryFilter): string[] {
  const chips: string[] = [];
  if (f.billing_model && f.billing_model !== "all") {
    chips.push(`Billing: ${f.billing_model.toUpperCase()}`);
  }
  if (f.projected_utilization_eom) {
    chips.push(
      `Projected EOM Util ${f.projected_utilization_eom.op} ${f.projected_utilization_eom.value}%`
    );
  }
  if (f.utilization_now) {
    chips.push(`Current Util ${f.utilization_now.op} ${f.utilization_now.value}%`);
  }
  if (f.overdue_amount) {
    chips.push(`Overdue ${f.overdue_amount.op} ₹${f.overdue_amount.value.toLocaleString("en-IN")}`);
  }
  if (f.days_overdue) {
    chips.push(`Days Overdue ${f.days_overdue.op} ${f.days_overdue.value}d`);
  }
  if (f.industry) {
    chips.push(`Industry: ${f.industry}`);
  }
  if (f.status) {
    chips.push(`Status: ${f.status.replace("_", " ")}`);
  }
  if (f.am) {
    chips.push(`AM: ${f.am}`);
  }
  return chips.length > 0 ? chips : ["All active accounts"];
}

/**
 * Execute filter against computed forecasts deterministically
 */
export function executeCreditFilter(
  filter: CreditQueryFilter,
  allForecasts: WorkspaceCreditForecast[]
): WorkspaceCreditForecast[] {
  let filtered = allForecasts.filter((item) => {
    // Billing model
    if (filter.billing_model && filter.billing_model !== "all") {
      if (item.billingModel !== filter.billing_model) return false;
    }

    // Utilization Now
    if (filter.utilization_now) {
      const { op, value } = filter.utilization_now;
      if (op === ">=" && !(item.currentUtilizationPct >= value)) return false;
      if (op === "<=" && !(item.currentUtilizationPct <= value)) return false;
      if (op === ">" && !(item.currentUtilizationPct > value)) return false;
      if (op === "<" && !(item.currentUtilizationPct < value)) return false;
      if (op === "=" && !(Math.round(item.currentUtilizationPct) === value)) return false;
    }

    // Projected Utilization EOM
    if (filter.projected_utilization_eom) {
      const { op, value } = filter.projected_utilization_eom;
      if (op === ">=" && !(item.projectedUtilizationEomPct >= value)) return false;
      if (op === "<=" && !(item.projectedUtilizationEomPct <= value)) return false;
      if (op === ">" && !(item.projectedUtilizationEomPct > value)) return false;
      if (op === "<" && !(item.projectedUtilizationEomPct < value)) return false;
      if (op === "=" && !(Math.round(item.projectedUtilizationEomPct) === value)) return false;
    }

    // Overdue Amount
    if (filter.overdue_amount) {
      const { op, value } = filter.overdue_amount;
      if (op === ">=" && !(item.overdueAmount >= value)) return false;
      if (op === "<=" && !(item.overdueAmount <= value)) return false;
      if (op === ">" && !(item.overdueAmount > value)) return false;
      if (op === "<" && !(item.overdueAmount < value)) return false;
    }

    // Days Overdue
    if (filter.days_overdue) {
      const { op, value } = filter.days_overdue;
      if (op === ">=" && !(item.maxDaysOverdue >= value)) return false;
      if (op === "<=" && !(item.maxDaysOverdue <= value)) return false;
      if (op === ">" && !(item.maxDaysOverdue > value)) return false;
    }

    // Industry
    if (filter.industry && filter.industry.trim()) {
      if (!item.industry.toLowerCase().includes(filter.industry.toLowerCase().trim())) {
        return false;
      }
    }

    // AM
    if (filter.am && filter.am.trim()) {
      if (!item.assignedAmName.toLowerCase().includes(filter.am.toLowerCase().trim())) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (filter.sort === "burn_desc") return b.ewmaDailyBurn - a.ewmaDailyBurn;
    if (filter.sort === "overdue_desc") return b.overdueAmount - a.overdueAmount;
    if (filter.sort === "utilization_desc")
      return b.currentUtilizationPct - a.currentUtilizationPct;
    // default: projected_desc
    return b.projectedUtilizationEomPct - a.projectedUtilizationEomPct;
  });

  if (filter.limit) {
    filtered = filtered.slice(0, filter.limit);
  }

  return filtered;
}

/**
 * FEATURE 1: Natural Language Credit Query Orchestrator
 * Uses Gemini to parse query into structured filter, falls back to rule-based engine.
 * Never executes raw SQL.
 */
export async function queryCreditIntelligence(
  userQuery: string,
  userId = "usr_adm_kabir"
): Promise<AIExecutionResult<CreditQueryResult>> {
  const cleanQuery = userQuery.trim();
  const allForecasts = computeAllCreditForecasts();

  const systemPrompt = `You are an expert financial database query interpreter for Relay BMP (B2B Telecom Billing Platform).
Your job is to translate the user's natural language question into a structured JSON filter object conforming to this schema:
{
  "billing_model": "postpaid" | "prepaid" | "all",
  "utilization_now": { "op": ">=" | "<=" | ">" | "<" | "=", "value": number },
  "projected_utilization_eom": { "op": ">=" | "<=" | ">" | "<" | "=", "value": number },
  "overdue_amount": { "op": ">=" | "<=" | ">" | "<" | "=", "value": number },
  "days_overdue": { "op": ">=" | "<=" | ">" | "<" | "=", "value": number },
  "status": "active" | "at_risk" | "suspended" | "onboarding",
  "industry": string,
  "sort": "projected_desc" | "utilization_desc" | "burn_desc" | "overdue_desc",
  "limit": number
}

Rules:
1. NEVER output SQL.
2. If the user mentions 80% or 100% crossing/breach, map to projected_utilization_eom with >=.
3. If the user asks about overdue invoices, set overdue_amount > 0.
4. Default billing_model is "postpaid" unless specified otherwise.
5. Return ONLY pure JSON matching the schema.`;

  const prompt = `User Query: "${cleanQuery}"`;

  const fallbackFn = (): CreditQueryResult => {
    const parsedFilter = parseCreditQueryRuleBased(cleanQuery);
    const results = executeCreditFilter(parsedFilter, allForecasts);
    return {
      parsedFilter,
      filterChips: formatFilterChips(parsedFilter),
      results,
      totalMatches: results.length,
      suggestedQueries: [
        "Which customers will cross 80% of their credit limit this month?",
        "Postpaid accounts with overdue invoices and high utilization",
        "Accounts at risk of exhaustion within 7 days",
        "Fintech clients with burn rate over ₹50,000/day",
      ],
    };
  };

  const aiResult = await executeStructuredAI<CreditQueryFilter>({
    feature: "credit_forecast",
    userId,
    systemPrompt,
    prompt,
    schema: CreditQueryFilterSchema,
    fallbackFn: () => parseCreditQueryRuleBased(cleanQuery),
    inputsForHashAndSummary: {
      query: cleanQuery,
      totalPostpaidWorkspaces: allForecasts.length,
      currentDate: new Date().toISOString().split("T")[0],
    },
  });

  const activeFilter = aiResult.data;
  const results = executeCreditFilter(activeFilter, allForecasts);

  return {
    ...aiResult,
    data: {
      parsedFilter: activeFilter,
      filterChips: formatFilterChips(activeFilter),
      results,
      totalMatches: results.length,
      suggestedQueries: [
        "Which customers will cross 80% of their credit limit this month?",
        "Postpaid accounts with overdue invoices and high utilization",
        "Accounts at risk of exhaustion within 7 days",
        "Fintech clients with burn rate over ₹50,000/day",
      ],
    },
  };
}
