import { ai, geminiModel, isAiConfigured } from "@/lib/ai/client";

export interface AIHealthSummaryInput {
  organizationName: string;
  planTier: string;
  monthlyRevenue: number;
  churnRiskScore: number;
  notes?: string | null;
}

export async function generateCustomerHealthSummary(input: AIHealthSummaryInput): Promise<string> {
  if (!isAiConfigured() || !ai) {
    return `[Mock AI Summary - configure GEMINI_API_KEY in .env for live Gemini output] ${input.organizationName} is on the ${input.planTier} tier with an MRR of ₹${input.monthlyRevenue.toLocaleString("en-IN")}. Health metrics indicate a churn risk of ${(input.churnRiskScore * 100).toFixed(0)}%. ${input.notes || "Account status remains stable."}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: `You are an internal B2B SaaS health analyst for Relay (SMS/RCS/WhatsApp communications platform in India).
Draft a concise, 3-bullet internal health summary for account managers reviewing:
Company: ${input.organizationName}
Tier: ${input.planTier}
Monthly Revenue: ₹${input.monthlyRevenue}
Churn Risk Score: ${input.churnRiskScore} (scale 0-1)
Account Notes: ${input.notes || "None"}

Keep it dense, calm, and actionable for Relay AMs and Finance teams.`,
    });

    return response.text || "No summary generated.";
  } catch (err: any) {
    console.error("Gemini generation error:", err);
    return `Analysis unavailable: ${err?.message || "Unknown error"}`;
  }
}
