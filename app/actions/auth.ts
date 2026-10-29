"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";
import { internalUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function switchUser(userId: string) {
  const user = await db.select().from(internalUsers).where(eq(internalUsers.id, userId)).get();
  if (!user) {
    throw new Error("Internal user not found.");
  }

  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, userId, {
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    sameSite: "lax",
    httpOnly: false, // Accessible to client for instant UI chip syncing
  });

  revalidatePath("/", "layout");
  return { success: true, user };
}
