"use server";

import { recordAIFeedback } from "@/lib/ai/client";

export async function recordAIFeedbackAction(
  runId: string,
  feedback: "accepted" | "rejected" | "dismissed"
) {
  try {
    const res = await recordAIFeedback(runId, feedback);
    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to record feedback" };
  }
}
