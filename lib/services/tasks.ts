import { db } from "@/lib/db";
import { tasks, organizations, internalUsers } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { writeAudit } from "./audit";
import { InternalRole } from "@/lib/permissions/roles";

export interface TaskItem {
  id: string;
  orgId: string;
  orgName: string;
  assignedTo: string;
  assignedToName: string;
  assignedToRole: string;
  title: string;
  source: "manual" | "ai_recommendation";
  status: "pending" | "in_progress" | "completed" | "dismissed";
  dueAt: Date | null;
}

export async function getTasksList(options: {
  assignedTo?: string;
  status?: string;
  orgId?: string;
} = {}) {
  const [allTasks, allOrgs, allUsers] = await Promise.all([
    db.select().from(tasks).orderBy(desc(tasks.dueAt)).all(),
    db.select().from(organizations).all(),
    db.select().from(internalUsers).all(),
  ]);

  const orgMap = new Map(allOrgs.map((o) => [o.id, o]));
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  return allTasks
    .filter((t) => {
      if (options.assignedTo && options.assignedTo !== "all" && t.assignedTo !== options.assignedTo) {
        return false;
      }
      if (options.status && options.status !== "all" && t.status !== options.status) {
        return false;
      }
      if (options.orgId && t.orgId !== options.orgId) {
        return false;
      }
      return true;
    })
    .map((t): TaskItem => {
      const org = orgMap.get(t.orgId);
      const user = userMap.get(t.assignedTo);

      return {
        id: t.id,
        orgId: t.orgId,
        orgName: org?.name || t.orgId,
        assignedTo: t.assignedTo,
        assignedToName: user?.name || t.assignedTo,
        assignedToRole: user?.role || "internal",
        title: t.title,
        source: t.source as any,
        status: t.status as any,
        dueAt: t.dueAt,
      };
    });
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: "pending" | "in_progress" | "completed" | "dismissed",
  actor: { id: string; role: InternalRole; name: string }
) {
  const existing = await db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  if (!existing) throw new Error("Task not found");

  await db
    .update(tasks)
    .set({ status: newStatus })
    .where(eq(tasks.id, taskId));

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "task_status_updated",
    targetType: "task",
    targetId: taskId,
    orgId: existing.orgId,
    before: { status: existing.status },
    after: { status: newStatus },
    reason: `Updated task status from ${existing.status} to ${newStatus}`,
  });

  return { success: true, taskId, status: newStatus };
}

export async function createOperationalTask(
  input: {
    orgId: string;
    assignedTo: string;
    title: string;
    dueAt?: Date;
    source?: "manual" | "ai_recommendation";
  },
  actor: { id: string; role: InternalRole; name: string }
) {
  if (!input.title || input.title.trim().length < 5) {
    throw new Error("Task title must be at least 5 characters.");
  }

  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date();
  const due = input.dueAt || new Date(now.getTime() + 48 * 3600 * 1000);

  await db.insert(tasks).values({
    id: taskId,
    orgId: input.orgId,
    assignedTo: input.assignedTo,
    title: input.title.trim(),
    source: input.source || "manual",
    status: "pending",
    dueAt: due,
  });

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "task_created",
    targetType: "task",
    targetId: taskId,
    orgId: input.orgId,
    after: { title: input.title, assignedTo: input.assignedTo, dueAt: due },
    reason: `Created operational task: "${input.title}"`,
  });

  return { success: true, taskId };
}
