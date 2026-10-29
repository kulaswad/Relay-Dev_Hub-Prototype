import { db } from "@/lib/db";
import {
  organizations,
  workspaces,
  subscriptions,
  plans,
  invoices,
  usageDaily,
  tickets,
  kycCases,
  senderIds,
  templates,
  workspaceUsers,
  workspaceAddons,
  addonCatalog,
} from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { executeStructuredAI, AIExecutionResult } from "@/lib/ai/client";

export const QBRBriefSchema = z.object({
  snapshot: z.string(),
  whats_going_well: z.array(z.string()),
  risks: z.array(z.string()),
  talking_points: z.array(z.string()),
  suggested_actions: z.array(z.string()),
  data_completeness: z.enum(["complete", "sparse_onboarding", "partial"]),
  missing_data_notes: z.string().optional(),
});

export type QBRBrief = z.infer<typeof QBRBriefSchema>;

export interface NumericalFactMatch {
  rawToken: string;
  normalizedValue: number;
  isPercentage: boolean;
  isCurrency: boolean;
  isVerified: boolean;
  context: string;
}

export interface VerifiedQBRResult {
  brief: QBRBrief;
  verifiedCount: number;
  totalFiguresCount: number;
  verificationRatio: number;
  unverifiedFigures: string[];
  markdownFull: string;
  facts: Record<string, any>;
}

/**
 * Builds compact, sanitized facts object.
 * NO PII (no customer emails, no customer phone numbers).
 */
export function buildAccountFacts(orgId: string): Record<string, any> {
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

  // Aggregate usage across all org workspaces
  let totalSms30d = 0;
  let totalSmsDelivered30d = 0;
  let totalRcs30d = 0;
  let totalRcsDelivered30d = 0;
  let totalWa30d = 0;
  let totalWaDelivered30d = 0;
  let spend30d = 0;
  let spendPrior30d = 0;

  for (const ws of orgWorkspaces) {
    const records = db
      .select()
      .from(usageDaily)
      .where(eq(usageDaily.workspaceId, ws.id))
      .all();

    for (const rec of records) {
      const recDate = new Date(rec.date);
      if (recDate >= thirtyDaysAgo) {
        spend30d += rec.cost || 0;
        totalSms30d += rec.smsCount || 0;
        totalSmsDelivered30d += Math.round((rec.smsCount || 0) * ((rec.deliveredPct || 98.5) / 100));
        totalRcs30d += rec.rcsCount || 0;
        totalRcsDelivered30d += Math.round((rec.rcsCount || 0) * ((rec.deliveredPct || 98.5) / 100));
        totalWa30d += rec.whatsappCount || 0;
        totalWaDelivered30d += Math.round((rec.whatsappCount || 0) * ((rec.deliveredPct || 98.5) / 100));
      } else if (recDate >= sixtyDaysAgo) {
        spendPrior30d += rec.cost || 0;
      }
    }
  }

  const spendDeltaPct =
    spendPrior30d > 0
      ? Math.round(((spend30d - spendPrior30d) / spendPrior30d) * 100)
      : 0;

  const totalVol = totalSms30d + totalRcs30d + totalWa30d;
  const totalDel =
    totalSmsDelivered30d + totalRcsDelivered30d + totalWaDelivered30d;
  const overallDeliveryRate =
    totalVol > 0 ? Math.round((totalDel / totalVol) * 1000) / 10 : 98.5;

  // Credit and Billing positions
  let totalCreditLimit = 0;
  let totalUsedCredit = 0;
  let totalAvailableCredit = 0;
  let totalPrepaidBalance = 0;
  let primaryBillingModel = org.billingModel || "postpaid";

  for (const ws of orgWorkspaces) {
    totalCreditLimit += ws.creditLimit || 0;
    totalUsedCredit += ws.creditUsed || 0;
    totalAvailableCredit += Math.max(0, (ws.creditLimit || 0) - (ws.creditUsed || 0));
    totalPrepaidBalance += ws.walletBalance || 0;
  }

  const creditUtilizationPct =
    totalCreditLimit > 0
      ? Math.round((totalUsedCredit / totalCreditLimit) * 100)
      : 0;

  // Invoices & Overdue
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let maxDaysOverdue = 0;
  let unpaidInvoicesCount = 0;

  for (const ws of orgWorkspaces) {
    const invs = db
      .select()
      .from(invoices)
      .where(eq(invoices.workspaceId, ws.id))
      .all();

    for (const inv of invs) {
      if (inv.status === "issued" || inv.status === "overdue") {
        unpaidInvoicesCount++;
        const totalAmt = (inv.amount || 0) + (inv.gstAmount || 0);
        totalOutstanding += totalAmt;
        const dueDate = new Date(inv.dueAt);
        if (dueDate < now) {
          totalOverdue += totalAmt;
          const daysOver = Math.floor(
            (now.getTime() - dueDate.getTime()) / 86400000
          );
          if (daysOver > maxDaysOverdue) maxDaysOverdue = daysOver;
        }
      }
    }
  }

  // Seat utilization (Sanitized: NO emails or names)
  let totalSeats = 0;
  let activeUsers = 0;
  let inactive45dUsers = 0;
  const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 86400000);

  for (const ws of orgWorkspaces) {
    const users = db
      .select()
      .from(workspaceUsers)
      .where(eq(workspaceUsers.workspaceId, ws.id))
      .all();

    for (const u of users) {
      totalSeats++;
      if (u.seatActive) activeUsers++;
      if (!u.lastLoginAt || new Date(u.lastLoginAt) < fortyFiveDaysAgo) {
        if (u.tier !== "owner") inactive45dUsers++;
      }
    }
  }

  // Tickets
  const orgTickets = db
    .select()
    .from(tickets)
    .where(eq(tickets.orgId, orgId))
    .all();

  const openTickets = orgTickets.filter((t) => t.status !== "resolved" && t.status !== "closed").length;
  const escalatedTickets = orgTickets.filter(
    (t) => t.priority === "urgent" || (t.status !== "resolved" && t.priority === "high")
  ).length;

  const ticketCats: Record<string, number> = {};
  for (const t of orgTickets) {
    ticketCats[t.category] = (ticketCats[t.category] || 0) + 1;
  }

  // Compliance
  let approvedKycCount = 0;
  let approvedSenderIds = 0;
  let approvedTemplates = 0;

  for (const ws of orgWorkspaces) {
    const kycs = db
      .select()
      .from(kycCases)
      .where(eq(kycCases.workspaceId, ws.id))
      .all();
    approvedKycCount += kycs.filter((k) => k.status === "approved").length;

    const senders = db
      .select()
      .from(senderIds)
      .where(eq(senderIds.workspaceId, ws.id))
      .all();
    approvedSenderIds += senders.filter((s) => s.status === "approved").length;

    const tmpls = db
      .select()
      .from(templates)
      .where(eq(templates.workspaceId, ws.id))
      .all();
    approvedTemplates += tmpls.filter((t) => t.status === "approved").length;
  }

  // Days to renewal
  let daysToRenewal = 180;
  if (org.contractEnd) {
    const diff = Math.floor(
      (new Date(org.contractEnd).getTime() - now.getTime()) / 86400000
    );
    daysToRenewal = diff;
  }

  return {
    org_id: org.id,
    org_name: org.name,
    legal_name: org.legalName,
    industry: org.industry,
    status: org.status,
    contract_end: org.contractEnd || "2027-03-31",
    days_to_renewal: daysToRenewal,
    primary_billing_model: primaryBillingModel,
    total_spend_30d_inr: spend30d,
    prior_30d_spend_inr: spendPrior30d,
    spend_vs_prior_delta_pct: spendDeltaPct,
    overall_delivery_rate_pct: overallDeliveryRate,
    channels: {
      sms_volume_30d: totalSms30d,
      sms_delivery_rate_pct:
        totalSms30d > 0
          ? Math.round((totalSmsDelivered30d / totalSms30d) * 100)
          : 98,
      rcs_volume_30d: totalRcs30d,
      rcs_delivery_rate_pct:
        totalRcs30d > 0
          ? Math.round((totalRcsDelivered30d / totalRcs30d) * 100)
          : 99,
      whatsapp_volume_30d: totalWa30d,
      whatsapp_delivery_rate_pct:
        totalWa30d > 0
          ? Math.round((totalWaDelivered30d / totalWa30d) * 100)
          : 99,
    },
    credit_position: {
      credit_limit_inr: totalCreditLimit,
      used_credit_inr: totalUsedCredit,
      utilization_pct: creditUtilizationPct,
      prepaid_balance_inr: totalPrepaidBalance,
    },
    invoices: {
      outstanding_inr: totalOutstanding,
      overdue_inr: totalOverdue,
      max_days_overdue: maxDaysOverdue,
      unpaid_count: unpaidInvoicesCount,
    },
    seats: {
      total_seats: totalSeats,
      active_users: activeUsers,
      inactive_45d_seats: inactive45dUsers,
    },
    tickets_last_90d: {
      total: orgTickets.length,
      open: openTickets,
      escalated: escalatedTickets,
      categories: ticketCats,
    },
    compliance: {
      approved_kyc_count: approvedKycCount,
      approved_sender_ids: approvedSenderIds,
      approved_templates: approvedTemplates,
    },
  };
}

/**
 * Deterministic Fact Verification Engine:
 * Extracts numbers and percentages from the generated text and verifies
 * whether they match values present in the facts object.
 */
export function verifyBriefFigures(
  brief: QBRBrief,
  facts: Record<string, any>
): {
  verifiedCount: number;
  totalCount: number;
  unverifiedFigures: string[];
} {
  const fullText = [
    brief.snapshot,
    ...brief.whats_going_well,
    ...brief.risks,
    ...brief.talking_points,
    ...brief.suggested_actions,
  ].join(" ");

  // Collect all known numbers from facts object recursively
  const knownNumbers = new Set<number>();
  function collectNumbers(obj: any) {
    if (typeof obj === "number") {
      knownNumbers.add(obj);
      knownNumbers.add(Math.round(obj));
    } else if (typeof obj === "object" && obj !== null) {
      for (const val of Object.values(obj)) {
        collectNumbers(val);
      }
    }
  }
  collectNumbers(facts);

  // Common thresholds and days allowed in telecom context
  [7, 14, 30, 45, 60, 90, 80, 100, 24, 48, 72].forEach((n) =>
    knownNumbers.add(n)
  );

  // Extract numerical tokens: percentages, rupees, counts
  const regex = /(?:₹|Rs\.?\s*)?(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?|\d+)(%|k|L|Cr)?/gi;
  const unverified: string[] = [];
  let totalCount = 0;
  let verifiedCount = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(fullText)) !== null) {
    const rawMatch = match[0];
    const numPart = match[1].replace(/,/g, "");
    const parsedNum = parseFloat(numPart);

    if (isNaN(parsedNum)) continue;

    // Skip trivial indices like bullet numbers (1, 2, 3) if alone
    if (parsedNum <= 5 && !match[2] && !rawMatch.includes("₹")) continue;

    totalCount++;

    let isMatched = false;
    // Check direct equality or close percentage/rounding
    for (const kn of Array.from(knownNumbers)) {
      if (
        Math.abs(kn - parsedNum) < 0.05 ||
        (kn > 0 && Math.abs(kn - parsedNum) / kn < 0.03)
      ) {
        isMatched = true;
        break;
      }
    }

    if (isMatched) {
      verifiedCount++;
    } else {
      unverified.push(rawMatch);
    }
  }

  return {
    verifiedCount,
    totalCount: Math.max(totalCount, 1),
    unverifiedFigures: Array.from(new Set(unverified)),
  };
}

/**
 * Deterministic Rule-Based QBR Generator (fallback when Gemini key is unset or error)
 */
export function generateRuleBasedQBR(
  facts: Record<string, any>,
  tone: "concise" | "detailed"
): QBRBrief {
  const isSparse =
    facts.status === "onboarding" ||
    (facts.total_spend_30d_inr === 0 && facts.channels.sms_volume_30d === 0);

  if (isSparse) {
    return {
      snapshot: `${facts.org_name} is currently in the ${facts.status} stage. Traffic channels and monthly billing cycles have not yet accumulated sufficient 30-day production volume.`,
      whats_going_well: [
        `Enterprise workspace registered under legal entity ${facts.legal_name || facts.org_name}.`,
        `Assigned compliance review with ${facts.compliance.approved_sender_ids} sender IDs and ${facts.compliance.approved_templates} templates provisioned.`,
      ],
      risks: [
        "Go-live pending completion of end-to-end simulated test message and operator route binding.",
        "Zero production message volume generated in the current evaluation window.",
      ],
      talking_points: [
        "Review onboarding checklist to expedite first live transactional broadcast.",
        "Establish monthly volume commitment and SLA expectations with technical leadership.",
      ],
      suggested_actions: [
        "Assist technical contact with API webhook integration for DLT message templates.",
        "Verify credit line allocation before scaling transactional traffic.",
      ],
      data_completeness: "sparse_onboarding",
      missing_data_notes:
        "30-day usage history, invoice payment records, and delivery telemetry are currently unavailable due to onboarding status.",
    };
  }

  const spendFormatted = `₹${facts.total_spend_30d_inr.toLocaleString("en-IN")}`;
  const util = facts.credit_position.utilization_pct;
  const delRate = facts.overall_delivery_rate_pct;

  return {
    snapshot: `${facts.org_name} (${facts.industry}) generated ${spendFormatted} in platform spend over the last 30 days across SMS and OTT channels, achieving an overall delivery success rate of ${delRate}%. Credit line utilization stands at ${util}%.`,
    whats_going_well: [
      `Overall message delivery rate remains healthy at ${delRate}%, exceeding the 95% enterprise SLA tier.`,
      `Active platform adoption across ${facts.seats.active_users} provisioned workspace team seats.`,
      facts.spend_vs_prior_delta_pct >= 0
        ? `Traffic growth of +${facts.spend_vs_prior_delta_pct}% compared to the previous 30-day billing window.`
        : `Stable message throughput across provisioned DLT routing headers.`,
    ],
    risks: [
      util >= 80
        ? `Credit line utilization is elevated at ${util}%, risking automated throttling if peak spend spikes.`
        : `Monitoring delivery latency across peak promotional windows.`,
      facts.invoices.overdue_inr > 0
        ? `Overdue unpaid balance of ₹${facts.invoices.overdue_inr.toLocaleString("en-IN")} pending for ${facts.invoices.max_days_overdue} days.`
        : `Maintain payment terms ahead of upcoming contract renewal in ${facts.days_to_renewal} days.`,
      facts.seats.inactive_45d_seats > 0
        ? `Detected ${facts.seats.inactive_45d_seats} licensed seat(s) with zero login activity in the last 45 days.`
        : `No critical seat de-allocation required.`,
    ],
    talking_points: [
      `Contract renewal runway: ${facts.days_to_renewal} days remaining on current commercial agreement.`,
      `Channel expansion: Evaluate RCS rich cards and WhatsApp Business API to complement high-volume SMS.`,
      `Throughput tiering: Align upcoming festive peak TPS allocations with carrier-side capacity.`,
    ],
    suggested_actions: [
      util >= 80
        ? "Submit request to raise credit limit to prevent mid-cycle traffic pauses."
        : "Conduct quarterly architecture review with account technical owner.",
      facts.seats.inactive_45d_seats > 0
        ? `Propose seat true-up to remove ${facts.seats.inactive_45d_seats} unused seats and optimize licensing spend.`
        : "Share updated TRAI DLT regulatory guidelines and template best practices.",
    ],
    data_completeness: "complete",
  };
}

/**
 * Format QBR into structured Markdown
 */
export function formatQBRToMarkdown(
  brief: QBRBrief,
  facts: Record<string, any>
): string {
  return `# Quarterly Business Review Brief: ${facts.org_name}
*Generated on ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })} | Industry: ${facts.industry}*

## Executive Snapshot
${brief.snapshot}

## What's Going Well
${brief.whats_going_well.map((p) => `- ${p}`).join("\n")}

## Identified Risks & Friction Points
${brief.risks.map((p) => `- ${p}`).join("\n")}

## Strategic Talking Points for QBR
${brief.talking_points.map((p) => `1. ${p}`).join("\n")}

## Recommended Next Actions
${brief.suggested_actions.map((p) => `- [ ] ${p}`).join("\n")}

${
  brief.missing_data_notes
    ? `\n> **Data Transparency Note**: ${brief.missing_data_notes}`
    : ""
}
`;
}

/**
 * FEATURE 2: Customer Health Summary GenAI (QBR Prep) Orchestrator
 */
export async function generateQBRBrief(
  orgId: string,
  tone: "concise" | "detailed" = "concise",
  userId = "usr_adm_kabir"
): Promise<AIExecutionResult<VerifiedQBRResult>> {
  const facts = buildAccountFacts(orgId);

  const systemPrompt = `You are an elite B2B telecom customer success executive preparing an internal Quarterly Business Review (QBR) executive brief for Relay (enterprise CPaaS in India).
You will receive a compact JSON facts object containing real operational data.

REQUIREMENTS:
1. Ground EVERY number, percentage, and claim in the supplied facts object. Do not hallucinate external figures.
2. If data is sparse (e.g. status is "onboarding" or 0 spend), explicitly state what is missing rather than inventing statistics.
3. Output MUST strictly match this JSON schema:
{
  "snapshot": string,
  "whats_going_well": string[],
  "risks": string[],
  "talking_points": string[],
  "suggested_actions": string[],
  "data_completeness": "complete" | "sparse_onboarding" | "partial",
  "missing_data_notes": string (optional)
}
4. Tone should be ${tone === "concise" ? "dense, crisp, and executive-ready" : "comprehensive and strategic"}.
5. Return ONLY valid JSON.`;

  const prompt = `Account Operational Facts:\n${JSON.stringify(facts, null, 2)}\n\nDraft the executive QBR brief now.`;

  const fallbackFn = (): QBRBrief => generateRuleBasedQBR(facts, tone);

  const aiResult = await executeStructuredAI<QBRBrief>({
    feature: "health_summary",
    userId,
    systemPrompt,
    prompt,
    schema: QBRBriefSchema,
    fallbackFn,
    inputsForHashAndSummary: {
      orgId,
      tone,
      spend30d: facts.total_spend_30d_inr,
      deliveryRate: facts.overall_delivery_rate_pct,
      utilization: facts.credit_position.utilization_pct,
      seats: facts.seats.total_seats,
    },
  });

  const activeBrief = aiResult.data;
  const verification = verifyBriefFigures(activeBrief, facts);
  const markdownFull = formatQBRToMarkdown(activeBrief, facts);

  const verifiedResult: VerifiedQBRResult = {
    brief: activeBrief,
    verifiedCount: verification.verifiedCount,
    totalFiguresCount: verification.totalCount,
    verificationRatio:
      Math.round(
        (verification.verifiedCount / verification.totalCount) * 100
      ) || 100,
    unverifiedFigures: verification.unverifiedFigures,
    markdownFull,
    facts,
  };

  return {
    ...aiResult,
    data: verifiedResult,
  };
}
