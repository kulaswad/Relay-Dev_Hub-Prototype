"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { internalUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { InternalRole } from "@/lib/permissions/roles";
import {
  getAuditLogs,
  verifyAuditIntegrity,
  writeAudit,
  AuditLogFilterOptions,
} from "@/lib/services/audit";

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

export async function getAuditLogsAction(filter: AuditLogFilterOptions = {}) {
  try {
    const actor = await getActor();
    const logs = await getAuditLogs(filter, actor);
    return { success: true, data: logs };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load audit logs" };
  }
}

export async function verifyAuditIntegrityAction() {
  try {
    const result = await verifyAuditIntegrity();
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to verify audit integrity" };
  }
}

export async function exportAuditLogCsvAction(filter: AuditLogFilterOptions = {}) {
  try {
    const actor = await getActor();
    const logs = await getAuditLogs(filter, actor);

    // Audit the export action itself (per requirements)
    await writeAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "audit_log_csv_exported",
      targetType: "system",
      targetId: "audit_log",
      reason: `User exported ${logs.length} filtered audit records to CSV report`,
    });

    // Generate CSV string
    const headers = [
      "ID",
      "Timestamp (IST)",
      "Actor Name",
      "Actor Role",
      "Action",
      "Machine Action",
      "Target Type",
      "Target ID",
      "Organization",
      "Reason",
      "AI Assisted",
      "Denied Attempt",
      "Previous Hash",
      "Current Hash",
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = logs.map((log) => [
      escapeCsv(log.id),
      escapeCsv(new Date(log.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })),
      escapeCsv(log.actorName),
      escapeCsv(log.actorRole),
      escapeCsv(log.humanAction),
      escapeCsv(log.action),
      escapeCsv(log.targetType),
      escapeCsv(log.targetId),
      escapeCsv(log.orgName || ""),
      escapeCsv(log.reason),
      escapeCsv(log.aiAssisted ? "Yes" : "No"),
      escapeCsv(log.isDenied ? "Yes" : "No"),
      escapeCsv(log.prevHash || ""),
      escapeCsv(log.hash || ""),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const filename = `relay-audit-export-${new Date().toISOString().split("T")[0]}.csv`;

    return {
      success: true,
      csv: csvContent,
      filename,
      rowCount: logs.length,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to export audit log" };
  }
}
