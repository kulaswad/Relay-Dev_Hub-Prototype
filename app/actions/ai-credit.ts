"use server";

import { queryCreditIntelligence, computeAllCreditForecasts } from "@/lib/services/credit-forecast";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function runCreditQueryAction(query: string) {
  try {
    const user = await getCurrentUser();
    const result = await queryCreditIntelligence(query, user.id);
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to execute credit query" };
  }
}

export async function getWorkspaceCreditForecastAction(workspaceId: string) {
  try {
    const all = computeAllCreditForecasts();
    const ws = all.find((f) => f.workspaceId === workspaceId);
    return { success: true, forecast: ws || null };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to calculate forecast" };
  }
}

export async function createAMTaskForBreachAction(params: {
  orgId: string;
  title: string;
  assignedTo?: string;
}) {
  try {
    const user = await getCurrentUser();
    let targetAm = params.assignedTo;

    if (!targetAm) {
      const org = db.select().from(organizations).where(eq(organizations.id, params.orgId)).get();
      targetAm = org?.ownerAmId || user.id;
    }

    const taskId = `tsk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const dueAt = new Date(Date.now() + 48 * 3600 * 1000); // 48h due date

    db.insert(tasks)
      .values({
        id: taskId,
        orgId: params.orgId,
        assignedTo: targetAm,
        title: params.title,
        source: "ai_recommendation",
        status: "pending",
        dueAt,
      })
      .run();

    revalidatePath("/tasks");
    revalidatePath("/finance");
    revalidatePath(`/accounts/${params.orgId}`);

    return { success: true, taskId };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create AM task" };
  }
}
