import { InternalRole } from "./roles";
import { PermissionAction } from "./matrix";
import { can, PermissionContext } from "./can";
import { db } from "@/lib/db";
import { internalUsers } from "@/lib/db/schema";
import { writeAudit } from "@/lib/services/audit";
import { eq } from "drizzle-orm";

/**
 * Server-side security guard.
 * Reads the actor's verified role from SQLite, evaluates permissions,
 * and if unauthorized, writes a tamper-evident audit entry with isDenied=true and throws an error.
 */
export async function assertPermission(
  actorId: string,
  action: PermissionAction,
  context?: PermissionContext
) {
  const user = await db
    .select()
    .from(internalUsers)
    .where(eq(internalUsers.id, actorId))
    .get();

  if (!user) {
    throw new Error(`Unauthorized: Internal user '${actorId}' does not exist.`);
  }

  const result = can(user.role as InternalRole, action, {
    ...context,
    approverId: actorId,
  });

  if (!result.allowed) {
    // Audit unauthorized attempt with tamper-evident chain and isDenied = true
    try {
      await writeAudit({
        actorId: user.id,
        actorRole: user.role,
        action: "permission_denied",
        targetType: "security_guard",
        targetId: action,
        reason: `Denied attempt to execute '${action}'. ${result.reason || "Insufficient permissions."}`,
        isDenied: true,
      });
    } catch (e) {
      console.error("Failed to log audit denial:", e);
    }

    throw new Error(`Forbidden: ${result.reason || `Role '${user.role}' lacks permission for '${action}'.`}`);
  }

  return { user, role: user.role as InternalRole };
}
