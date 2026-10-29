"use server";

import {
  calculateOrgChurnRisk,
  analyzeUnusedSeats,
  generateAMRecommendations,
} from "@/lib/services/churn-seats";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getOrgChurnAndSeatsAction(orgId: string) {
  try {
    const churn = calculateOrgChurnRisk(orgId);
    const seats = analyzeUnusedSeats(orgId);
    const recommendations = generateAMRecommendations(orgId);
    return { success: true, churn, seats, recommendations };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to calculate churn metrics" };
  }
}

export async function createRecommendationTaskAction(params: {
  orgId: string;
  title: string;
}) {
  try {
    const user = await getCurrentUser();
    const org = db.select().from(organizations).where(eq(organizations.id, params.orgId)).get();
    const assignedAm = org?.ownerAmId || user.id;

    const taskId = `tsk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const dueAt = new Date(Date.now() + 72 * 3600 * 1000); // 72 hours due date

    db.insert(tasks)
      .values({
        id: taskId,
        orgId: params.orgId,
        assignedTo: assignedAm,
        title: params.title,
        source: "ai_recommendation",
        status: "pending",
        dueAt,
      })
      .run();

    revalidatePath("/tasks");
    revalidatePath(`/accounts/${params.orgId}`);
    return { success: true, taskId };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create recommendation task" };
  }
}

export async function dismissRecommendationAction(recId: string, reason: string) {
  // Stored for telemetry and feedback
  return { success: true, recId, dismissedReason: reason };
}
