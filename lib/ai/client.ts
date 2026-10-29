import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { aiRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
export const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const ai = apiKey && apiKey.length > 5 ? new GoogleGenAI({ apiKey }) : null;

export function isAiConfigured(): boolean {
  return Boolean(apiKey && apiKey.length > 5 && ai !== null);
}

export type AIFeature =
  | "health_summary"
  | "churn_prediction"
  | "credit_forecast"
  | "kyc_extraction";

export interface AIExecutionResult<T> {
  success: boolean;
  data: T;
  isFallback: boolean;
  fallbackReason?: string;
  runId: string;
  latencyMs: number;
  model: string;
  inputsSummary: Record<string, any>;
  asOf: string;
  rawOutput?: string;
}

export interface GenerateStructuredParams<T> {
  feature: AIFeature;
  userId?: string;
  systemPrompt?: string;
  prompt: string;
  schema: z.ZodType<T, any, any>;
  fallbackFn: () => T;
  inputsForHashAndSummary: Record<string, any>;
  multimodalPart?: {
    inlineData: {
      data: string; // base64
      mimeType: string;
    };
  };
}

/**
 * Strips code fences like ```json ... ``` from model outputs
 */
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned.trim();
}

/**
 * Execute Gemini call with 20s timeout and 1 retry
 */
async function callGeminiWithTimeoutAndRetry(
  prompt: string,
  systemPrompt?: string,
  multimodalPart?: { inlineData: { data: string; mimeType: string } }
): Promise<string> {
  if (!ai) throw new Error("Gemini AI client not initialized (missing GEMINI_API_KEY)");

  const callOnce = async (attempt: number): Promise<string> => {
    let timer: NodeJS.Timeout | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("Gemini request timed out after 20,000ms"));
        }, 20000);
      });

      const contents: any[] = [];
      if (multimodalPart) {
        contents.push(multimodalPart);
      }
      contents.push(prompt);

      const requestPromise = ai.models.generateContent({
        model: geminiModel,
        contents,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const res = await Promise.race([requestPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      const text = res.text || "";
      if (!text) throw new Error("Empty response returned by Gemini model");
      return text;
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      if (attempt === 1) {
        // Retry once after brief 500ms delay
        await new Promise((r) => setTimeout(r, 500));
        return callOnce(2);
      }
      throw err;
    }
  };

  return callOnce(1);
}

/**
 * Universal Single AI Client Wrapper:
 * - Reads GEMINI_API_KEY
 * - Enforces 20s timeout and retries once
 * - Logs EVERY call to ai_runs table
 * - Validates structured JSON with Zod (retries once on invalid JSON)
 * - Degrades gracefully to fallbackFn if no key or on error
 */
export async function executeStructuredAI<T>(
  params: GenerateStructuredParams<T>
): Promise<AIExecutionResult<T>> {
  const startTime = Date.now();
  const runId = `air_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const actingUserId = params.userId || "usr_adm_kabir";
  const asOf = new Date().toISOString();

  // Compute SHA-256 hash of inputs for auditing
  const inputHash = createHash("sha256")
    .update(JSON.stringify(params.inputsForHashAndSummary))
    .digest("hex");

  // 1. Check if Gemini is configured
  if (!isAiConfigured()) {
    const fallbackData = params.fallbackFn();
    const latencyMs = Date.now() - startTime;
    const outputJson = JSON.stringify(fallbackData);

    try {
      db.insert(aiRuns)
        .values({
          id: runId,
          feature: params.feature,
          userId: actingUserId,
          inputHash,
          output: outputJson,
          model: "rule_based_fallback",
          latencyMs,
          status: "fallback",
          accepted: null,
          createdAt: new Date(),
        })
        .run();
    } catch (dbErr) {
      console.error("Failed to log fallback AI run to DB:", dbErr);
    }

    return {
      success: true,
      data: fallbackData,
      isFallback: true,
      fallbackReason: "GEMINI_API_KEY is not configured in environment.",
      runId,
      latencyMs,
      model: "rule_based_fallback",
      inputsSummary: params.inputsForHashAndSummary,
      asOf,
      rawOutput: outputJson,
    };
  }

  // 2. Call Gemini with timeout and retry
  try {
    let rawText = await callGeminiWithTimeoutAndRetry(
      params.prompt,
      params.systemPrompt,
      params.multimodalPart
    );

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(cleanJsonOutput(rawText));
    } catch (parseErr) {
      // Retry once on invalid JSON
      const correctionPrompt = `${params.prompt}\n\nIMPORTANT: Your previous output was not valid JSON. You MUST return ONLY valid JSON matching this schema:\n${parseErr}`;
      rawText = await callGeminiWithTimeoutAndRetry(
        correctionPrompt,
        params.systemPrompt,
        params.multimodalPart
      );
      parsedJson = JSON.parse(cleanJsonOutput(rawText));
    }

    // 3. Zod validation
    const validatedData = params.schema.parse(parsedJson);
    const latencyMs = Date.now() - startTime;
    const outputJson = JSON.stringify(validatedData);

    try {
      db.insert(aiRuns)
        .values({
          id: runId,
          feature: params.feature,
          userId: actingUserId,
          inputHash,
          output: outputJson,
          model: geminiModel,
          latencyMs,
          status: "success",
          accepted: null,
          createdAt: new Date(),
        })
        .run();
    } catch (dbErr) {
      console.error("Failed to log AI run to DB:", dbErr);
    }

    return {
      success: true,
      data: validatedData,
      isFallback: false,
      runId,
      latencyMs,
      model: geminiModel,
      inputsSummary: params.inputsForHashAndSummary,
      asOf,
      rawOutput: outputJson,
    };
  } catch (err: any) {
    console.warn(`[AI Engine] Gemini call failed for ${params.feature}: ${err?.message}. Falling back to rule-based engine.`);
    const fallbackData = params.fallbackFn();
    const latencyMs = Date.now() - startTime;
    const outputJson = JSON.stringify(fallbackData);

    try {
      db.insert(aiRuns)
        .values({
          id: runId,
          feature: params.feature,
          userId: actingUserId,
          inputHash,
          output: outputJson,
          model: "rule_based_fallback",
          latencyMs,
          status: "fallback",
          accepted: null,
          createdAt: new Date(),
        })
        .run();
    } catch (dbErr) {
      console.error("Failed to log fallback AI run to DB:", dbErr);
    }

    return {
      success: true,
      data: fallbackData,
      isFallback: true,
      fallbackReason: err?.message || "Gemini inference unavailable, degraded to rule-based analysis.",
      runId,
      latencyMs,
      model: "rule_based_fallback",
      inputsSummary: params.inputsForHashAndSummary,
      asOf,
      rawOutput: outputJson,
    };
  }
}

/**
 * Record human feedback on an AI run (Accept / Reject / Dismiss)
 */
export async function recordAIFeedback(
  runId: string,
  feedback: "accepted" | "rejected" | "dismissed"
): Promise<{ success: boolean; error?: string }> {
  try {
    // SQLite boolean mode accepts boolean or integer (1=true, 0=false, -1=dismissed)
    // In schema.ts: accepted is integer("accepted", { mode: "boolean" })
    const acceptedVal = feedback === "accepted" ? (true as any) : (false as any);
    db.update(aiRuns)
      .set({ accepted: acceptedVal })
      .where(eq(aiRuns.id, runId))
      .run();

    return { success: true };
  } catch (err: any) {
    console.error("Failed to record AI feedback:", err);
    return { success: false, error: err?.message };
  }
}

/**
 * Fetch telemetry data for Admin AI activity view
 */
export async function getAiRunsTelemetry(limit = 100) {
  try {
    const runs = db
      .select()
      .from(aiRuns)
      .orderBy(desc(aiRuns.createdAt))
      .limit(limit)
      .all();

    const totalRuns = runs.length;
    const successRuns = runs.filter((r) => r.status === "success").length;
    const fallbackRuns = runs.filter((r) => r.status === "fallback").length;
    const avgLatency =
      totalRuns > 0
        ? Math.round(runs.reduce((acc, r) => acc + r.latencyMs, 0) / totalRuns)
        : 0;

    const acceptedCount = runs.filter((r) => r.accepted === true).length;
    const rejectedCount = runs.filter((r) => r.accepted === false).length;
    const reviewedCount = acceptedCount + rejectedCount;
    const acceptedRate =
      reviewedCount > 0 ? Math.round((acceptedCount / reviewedCount) * 100) : 100;

    return {
      runs,
      stats: {
        totalRuns,
        successRuns,
        fallbackRuns,
        avgLatency,
        acceptedRate,
        reviewedCount,
      },
    };
  } catch (err: any) {
    console.error("Failed to load AI runs:", err);
    return {
      runs: [],
      stats: {
        totalRuns: 0,
        successRuns: 0,
        fallbackRuns: 0,
        avgLatency: 0,
        acceptedRate: 100,
        reviewedCount: 0,
      },
    };
  }
}
