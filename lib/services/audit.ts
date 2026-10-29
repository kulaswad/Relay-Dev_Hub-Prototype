import { db } from "@/lib/db";
import { auditLog, organizations, internalUsers } from "@/lib/db/schema";
import { desc, eq, and, sql, or, like } from "drizzle-orm";
import { z } from "zod";
import { createHash } from "crypto";
import { InternalRole } from "@/lib/permissions/roles";

export const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

// Actions requiring mandatory justification of at least 10 characters
export const ACTIONS_REQUIRING_REASON = [
  "credit_limit_increase",
  "credit_limit_decrease",
  "change_credit_limit",
  "wallet_adjustment",
  "plan_change",
  "custom_discount",
  "account_suspension",
  "account_reactivation",
  "account_offboarding",
  "change_request_approved",
  "change_request_rejected",
  "change_request_cancelled",
  "kyc_approved",
  "kyc_rejected",
  "sender_id_rejected",
];

export const AuditEntrySchema = z.object({
  actorId: z.string().min(1, "Actor ID is required"),
  actorRole: z.string().min(1, "Actor role is required"),
  action: z.string().min(1, "Action is required"),
  targetType: z.string().min(1, "Target type is required"),
  targetId: z.string().min(1, "Target ID is required"),
  orgId: z.string().optional().nullable(),
  before: z.any().optional().nullable(),
  after: z.any().optional().nullable(),
  reason: z.string().min(1, "Reason is required"),
  changeRequestId: z.string().optional().nullable(),
  aiAssisted: z.boolean().optional(),
  isDenied: z.boolean().optional(),
  ip: z.string().optional(),
});

export type AuditEntryInput = z.infer<typeof AuditEntrySchema>;

function normalizeTimestamp(ts: number | string | Date): number {
  if (ts instanceof Date) return Math.floor(ts.getTime() / 1000);
  const n = Number(ts);
  if (isNaN(n)) return 0;
  return n > 10000000000 ? Math.floor(n / 1000) : Math.floor(n);
}

/**
 * Computes canonical SHA-256 hash chaining each entry to prevHash and its content
 */
export function computeAuditHash(
  prevHash: string,
  entry: {
    id: string;
    timestamp: number | string | Date;
    actorId: string;
    actorRole: string;
    action: string;
    targetType: string;
    targetId: string;
    orgId?: string | null;
    before?: string | null;
    after?: string | null;
    reason: string;
    aiAssisted?: boolean | number;
    isDenied?: boolean | number;
  }
): string {
  const tsVal = normalizeTimestamp(entry.timestamp);
  const payload = [
    prevHash,
    entry.id,
    String(tsVal),
    entry.actorId,
    entry.actorRole,
    entry.action,
    entry.targetType,
    entry.targetId,
    entry.orgId || "",
    entry.before || "",
    entry.after || "",
    entry.reason.trim(),
    entry.aiAssisted ? "1" : "0",
    entry.isDenied ? "1" : "0",
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Core audit writing service for Relay BMP.
 * Append-only with cryptographic tamper-evident hash chaining.
 */
export async function writeAudit(input: AuditEntryInput) {
  const validated = AuditEntrySchema.parse(input);

  const requiresStrictReason = ACTIONS_REQUIRING_REASON.some((act) =>
    validated.action.includes(act)
  );

  if (requiresStrictReason && validated.reason.trim().length < 10) {
    throw new Error(
      `Compliance Policy: Action '${validated.action}' mandates an audit justification of at least 10 characters.`
    );
  }

  // Fetch the latest entry in audit_log to link hashes (ordered by physical SQLite append sequence)
  const lastEntry = await db
    .select({ hash: auditLog.hash })
    .from(auditLog)
    .orderBy(sql`rowid DESC`)
    .limit(1)
    .get();

  const prevHash = lastEntry?.hash || GENESIS_HASH;
  const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();

  const beforeStr = validated.before
    ? typeof validated.before === "string"
      ? validated.before
      : JSON.stringify(validated.before)
    : null;

  const afterStr = validated.after
    ? typeof validated.after === "string"
      ? validated.after
      : JSON.stringify(validated.after)
    : null;

  const hash = computeAuditHash(prevHash, {
    id,
    timestamp: now,
    actorId: validated.actorId,
    actorRole: validated.actorRole,
    action: validated.action,
    targetType: validated.targetType,
    targetId: validated.targetId,
    orgId: validated.orgId || null,
    before: beforeStr,
    after: afterStr,
    reason: validated.reason.trim(),
    aiAssisted: validated.aiAssisted ?? false,
    isDenied: validated.isDenied ?? false,
  });

  await db.insert(auditLog).values({
    id,
    timestamp: now,
    actorId: validated.actorId,
    actorRole: validated.actorRole,
    action: validated.action,
    targetType: validated.targetType,
    targetId: validated.targetId,
    orgId: validated.orgId || null,
    before: beforeStr,
    after: afterStr,
    reason: validated.reason.trim(),
    changeRequestId: validated.changeRequestId || null,
    aiAssisted: validated.aiAssisted ?? false,
    ip: validated.ip || "10.14.0.24",
    prevHash,
    hash,
    isDenied: validated.isDenied ?? false,
  });

  return { success: true, id, hash, prevHash };
}

// Backward compatible alias
export const logAudit = writeAudit;

/**
 * Recomputes and cryptographically verifies the integrity of the audit chain
 */
export async function verifyAuditIntegrity(): Promise<{
  valid: boolean;
  totalVerified: number;
  latestHash?: string;
  brokenEntryId?: string;
  index?: number;
  reason?: string;
  message: string;
}> {
  const allEntries = await db
    .select()
    .from(auditLog)
    .orderBy(sql`rowid ASC`)
    .all();

  if (allEntries.length === 0) {
    return {
      valid: true,
      totalVerified: 0,
      latestHash: GENESIS_HASH,
      message: "Audit log is empty. Genesis baseline verified.",
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];

    // Check link to previous hash
    if (i === 0) {
      if (entry.prevHash && entry.prevHash !== GENESIS_HASH) {
        return {
          valid: false,
          totalVerified: 0,
          brokenEntryId: entry.id,
          index: i,
          reason: `Genesis block prevHash mismatch. Expected ${GENESIS_HASH}, got ${entry.prevHash}`,
          message: `Integrity Violation Detected at entry #${entry.id}: Genesis pointer has been tampered with.`,
        };
      }
    } else {
      if (entry.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          totalVerified: i,
          brokenEntryId: entry.id,
          index: i,
          reason: `Hash chain broken between block #${allEntries[i - 1].id} and block #${entry.id}. PrevHash pointer altered.`,
          message: `Integrity Violation Detected at entry #${entry.id}: Hash chain sequence is broken.`,
        };
      }
    }

    // Recompute current block hash
    const recomputedHash = computeAuditHash(entry.prevHash || GENESIS_HASH, {
      id: entry.id,
      timestamp: entry.timestamp,
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      orgId: entry.orgId,
      before: entry.before,
      after: entry.after,
      reason: entry.reason,
      aiAssisted: entry.aiAssisted,
      isDenied: entry.isDenied,
    });

    if (entry.hash !== recomputedHash) {
      return {
        valid: false,
        totalVerified: i,
        brokenEntryId: entry.id,
        index: i,
        reason: `Cryptographic content mismatch at entry #${entry.id}. Data payload was modified in database! Expected hash ${recomputedHash.substring(0, 16)}..., stored hash ${entry.hash?.substring(0, 16)}...`,
        message: `Tamper Alert: Row #${entry.id} content was modified directly in storage. Integrity check failed!`,
      };
    }

    expectedPrevHash = entry.hash || recomputedHash;
  }

  return {
    valid: true,
    totalVerified: allEntries.length,
    latestHash: expectedPrevHash,
    message: `All ${allEntries.length} audit entries cryptographically verified against SHA-256 chain. Zero tampering detected.`,
  };
}

/**
 * Filter audit log based on viewer role permissions
 */
export function isAuditVisibleToRole(
  entry: {
    actorRole: string;
    action: string;
    targetType: string;
    orgId?: string | null;
  },
  viewerRole: InternalRole,
  assignedOrgIds?: string[]
): boolean {
  if (viewerRole === "admin" || viewerRole === "compliance") {
    return true;
  }

  if (viewerRole === "finance" || viewerRole === "finance_head") {
    const act = entry.action.toLowerCase();
    const isMoneyRelated =
      act.includes("credit") ||
      act.includes("wallet") ||
      act.includes("invoice") ||
      act.includes("topup") ||
      act.includes("adjustment") ||
      act.includes("plan") ||
      act.includes("discount") ||
      act.includes("rate") ||
      act.includes("billing") ||
      entry.targetType === "invoice" ||
      entry.targetType === "subscription";
    return isMoneyRelated;
  }

  if (viewerRole === "account_manager") {
    if (!entry.orgId) return false;
    return assignedOrgIds ? assignedOrgIds.includes(entry.orgId) : true;
  }

  if (viewerRole === "support") {
    const act = entry.action.toLowerCase();
    const isSupportRelated =
      entry.targetType === "ticket" ||
      entry.targetType === "user" ||
      act.includes("ticket") ||
      act.includes("user") ||
      act.includes("seat") ||
      act.includes("password");
    return isSupportRelated;
  }

  if (viewerRole === "sales_ops") {
    const act = entry.action.toLowerCase();
    return (
      act.includes("onboard") ||
      act.includes("plan") ||
      act.includes("rate") ||
      act.includes("workspace") ||
      act.includes("org") ||
      entry.targetType === "organization" ||
      entry.targetType === "workspace"
    );
  }

  return true;
}

export interface AuditLogFilterOptions {
  search?: string;
  actorId?: string;
  role?: string;
  actionType?: string;
  orgId?: string;
  targetId?: string;
  targetType?: string;
  aiOnly?: boolean;
  deniedOnly?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Rich audit log queries with role-based redactions, human-readable labels, and target resolution
 */
export async function getAuditLogs(
  filter: AuditLogFilterOptions = {},
  viewer: { id: string; role: InternalRole } = { id: "usr_adm_kabir", role: "admin" }
) {
  const [allUsers, allOrgs] = await Promise.all([
    db.select().from(internalUsers).all(),
    db.select().from(organizations).all(),
  ]);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const orgMap = new Map(allOrgs.map((o) => [o.id, o]));

  const assignedOrgIds =
    viewer.role === "account_manager"
      ? allOrgs.filter((o) => o.ownerAmId === viewer.id).map((o) => o.id)
      : undefined;

  let query = db.select().from(auditLog).orderBy(desc(auditLog.timestamp));
  const rawList = await query.limit(filter.limit || 200).all();

  // Apply role filtering and search filters
  const filtered = rawList.filter((entry) => {
    // 1. Role visibility check
    if (!isAuditVisibleToRole(entry, viewer.role, assignedOrgIds)) {
      return false;
    }

    // 2. Org filter
    if (filter.orgId && entry.orgId !== filter.orgId) {
      return false;
    }

    // 3. Target filter
    if (filter.targetId && entry.targetId !== filter.targetId) {
      return false;
    }

    // 4. Role filter
    if (filter.role && filter.role !== "all" && entry.actorRole !== filter.role) {
      return false;
    }

    // 5. Actor filter
    if (filter.actorId && filter.actorId !== "all" && entry.actorId !== filter.actorId) {
      return false;
    }

    // 6. Action type filter
    if (filter.actionType && filter.actionType !== "all") {
      const act = entry.action.toLowerCase();
      if (filter.actionType === "money" && !act.includes("credit") && !act.includes("wallet") && !act.includes("invoice") && !act.includes("topup") && !act.includes("adjustment")) return false;
      if (filter.actionType === "lifecycle" && !act.includes("status") && !act.includes("suspend") && !act.includes("reactivat") && !act.includes("onboard")) return false;
      if (filter.actionType === "compliance" && !act.includes("kyc") && !act.includes("sender") && !act.includes("template")) return false;
      if (filter.actionType === "plans" && !act.includes("plan") && !act.includes("discount") && !act.includes("rate")) return false;
      if (filter.actionType === "support" && !act.includes("ticket") && !act.includes("user") && !act.includes("seat")) return false;
    }

    // 7. AI Only
    if (filter.aiOnly && !entry.aiAssisted) {
      return false;
    }

    // 8. Denied Only
    if (filter.deniedOnly && !entry.isDenied) {
      return false;
    }

    // 9. Date filters
    if (filter.startDate) {
      const startMs = new Date(filter.startDate).getTime();
      if (entry.timestamp.getTime() < startMs) return false;
    }
    if (filter.endDate) {
      const endMs = new Date(filter.endDate).getTime() + 86400000;
      if (entry.timestamp.getTime() > endMs) return false;
    }

    // 10. Free text search
    if (filter.search && filter.search.trim().length > 0) {
      const q = filter.search.toLowerCase().trim();
      const actor = userMap.get(entry.actorId);
      const org = entry.orgId ? orgMap.get(entry.orgId) : null;
      const haystack = [
        entry.id,
        entry.action,
        entry.reason,
        entry.targetId,
        entry.targetType,
        actor?.name || "",
        actor?.email || "",
        org?.name || "",
        entry.before || "",
        entry.after || "",
      ].join(" ").toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  // Enrich with readable presentation metadata
  return filtered.map((item) => {
    const actorUser = userMap.get(item.actorId);
    const org = item.orgId ? orgMap.get(item.orgId) : null;

    let humanAction = item.action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    if (item.action.includes("credit_limit_increase") || item.action.includes("credit_limit_updated")) {
      humanAction = "Raised Credit Limit";
    } else if (item.action.includes("wallet_adjustment")) {
      humanAction = "Manual Balance Adjustment";
    } else if (item.action.includes("kyc_approved") || item.action.includes("kyc_document_verified")) {
      humanAction = "Approved KYC Verification";
    } else if (item.action.includes("sender_id_approved")) {
      humanAction = "Approved DLT Sender ID";
    } else if (item.action.includes("plan_upgraded") || item.action.includes("plan_change")) {
      humanAction = "Upgraded Commercial Plan";
    } else if (item.action.includes("account_suspension")) {
      humanAction = "Suspended Organization";
    } else if (item.action.includes("account_reactivation")) {
      humanAction = "Reactivated Organization";
    } else if (item.action.includes("invoice_issued")) {
      humanAction = "Issued Tax Invoice";
    }

    return {
      id: item.id,
      timestamp: item.timestamp,
      actorId: item.actorId,
      actorName: actorUser?.name || item.actorId,
      actorEmail: actorUser?.email || "",
      actorRole: item.actorRole,
      avatarColor: actorUser?.avatarColor || "#7C7CFF",
      action: item.action,
      humanAction,
      targetType: item.targetType,
      targetId: item.targetId,
      orgId: item.orgId,
      orgName: org?.name || null,
      before: item.before,
      after: item.after,
      reason: item.reason,
      changeRequestId: item.changeRequestId,
      aiAssisted: Boolean(item.aiAssisted),
      isDenied: Boolean(item.isDenied),
      ip: item.ip,
      prevHash: item.prevHash,
      hash: item.hash,
    };
  });
}

export async function getRecentAuditLogs(limit = 50) {
  return await db.select().from(auditLog).orderBy(desc(auditLog.timestamp)).limit(limit);
}

export async function getAuditLogsForTarget(targetType: string, targetId: string, limit = 50) {
  return await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.targetId, targetId))
    .orderBy(desc(auditLog.timestamp))
    .limit(limit);
}
