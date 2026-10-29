"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { internalUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { InternalRole } from "@/lib/permissions/roles";
import {
  getAggregatedNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/services/notifications";

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

export async function getNotificationsAction() {
  try {
    const actor = await getActor();
    const notifications = await getAggregatedNotifications(actor);
    return { success: true, data: notifications };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch notifications" };
  }
}

export async function markNotificationReadAction(id: string) {
  try {
    await markNotificationRead(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function markAllNotificationsReadAction() {
  try {
    await markAllNotificationsRead();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
