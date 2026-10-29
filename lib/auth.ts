import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { internalUsers, InternalUser } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { InternalRole } from "@/lib/permissions/roles";

export const COOKIE_NAME = "relay_actor_id";

export interface ActiveUserSession {
  id: string;
  name: string;
  email: string;
  role: InternalRole;
  avatarColor: string;
}

// Default fallback user (Kabir Anand - Platform Admin)
export const DEFAULT_USER: ActiveUserSession = {
  id: "usr_adm_kabir",
  name: "Kabir Anand",
  email: "kabir.anand@relay.in",
  role: "admin",
  avatarColor: "#7C7CFF",
};

/**
 * Server-side helper to read currently active actor from cookie
 */
export async function getActiveUser(): Promise<ActiveUserSession> {
  const cookieStore = cookies();
  const actorId = cookieStore.get(COOKIE_NAME)?.value;

  if (!actorId) {
    return DEFAULT_USER;
  }

  const user = await db
    .select()
    .from(internalUsers)
    .where(eq(internalUsers.id, actorId))
    .get();

  if (!user) {
    return DEFAULT_USER;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as InternalRole,
    avatarColor: user.avatarColor,
  };
}

export const getCurrentUser = getActiveUser;

/**
 * Fetch all available seeded internal users for the role switcher dropdown
 */
export async function getAllInternalUsers(): Promise<InternalUser[]> {
  return await db.select().from(internalUsers).all();
}
