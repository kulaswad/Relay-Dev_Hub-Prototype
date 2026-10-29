"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { internalUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { InternalRole } from "@/lib/permissions/roles";
import {
  getTasksList,
  updateTaskStatus,
  createOperationalTask,
} from "@/lib/services/tasks";

async function getActor() {
  const cookieStore = cookies();
  const actorId = cookieStore.get("relay_actor_id")?.value || "usr_adm_kabir";

  const user = await db
    .select()
    .from(internalUsers)
    .where(eq(internalUsers.id, actorId))
    .get();

  if (!user) {
    return { id: "usr_adm_kabir", role: "admin" as InternalRole, name: "Kabir Anand" };
  }
  return { id: user.id, role: user.role as InternalRole, name: user.name };
}

export async function getTasksAction(options: {
  assignedTo?: string;
  status?: string;
  orgId?: string;
} = {}) {
  try {
    const list = await getTasksList(options);
    return { success: true, data: list };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch tasks" };
  }
}

export async function updateTaskStatusAction(
  taskId: string,
  status: "pending" | "in_progress" | "completed" | "dismissed"
) {
  try {
    const actor = await getActor();
    const result = await updateTaskStatus(taskId, status, actor);
    revalidatePath("/tasks");
    revalidatePath("/accounts/[orgId]", "page");
    revalidatePath("/");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update task status" };
  }
}

export async function createOperationalTaskAction(input: {
  orgId: string;
  assignedTo: string;
  title: string;
  dueAt?: Date;
  source?: "manual" | "ai_recommendation";
}) {
  try {
    const actor = await getActor();
    const result = await createOperationalTask(input, actor);
    revalidatePath("/tasks");
    revalidatePath("/accounts/[orgId]", "page");
    revalidatePath("/");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create task" };
  }
}
