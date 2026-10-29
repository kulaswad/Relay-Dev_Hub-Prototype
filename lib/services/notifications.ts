import { db } from "@/lib/db";
import {
  alerts,
  changeRequests,
  kycCases,
  senderIds,
  tickets,
  organizations,
  workspaces,
} from "@/lib/db/schema";
import { eq, desc, and, lt } from "drizzle-orm";
import { InternalRole } from "@/lib/permissions/roles";

export interface NotificationItem {
  id: string;
  category: "credit" | "sla" | "approval" | "ai";
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: Date;
}

export async function getAggregatedNotifications(actor: { id: string; role: InternalRole }) {
  const now = new Date();
  const nowMs = now.getTime();
  const fortyEightHoursAgo = new Date(nowMs - 48 * 3600 * 1000);
  const fourHoursAgo = new Date(nowMs - 4 * 3600 * 1000);

  const [dbAlerts, pendingCRs, breachedKyc, breachedSenders, breachedTickets, allOrgs] =
    await Promise.all([
      db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(20).all(),
      db.select().from(changeRequests).where(eq(changeRequests.status, "pending")).all(),
      db.select().from(kycCases).where(and(eq(kycCases.status, "in_review"), lt(kycCases.submittedAt, fortyEightHoursAgo))).all(),
      db.select().from(senderIds).where(and(eq(senderIds.status, "submitted"), lt(senderIds.submittedAt, fortyEightHoursAgo))).all(),
      db.select().from(tickets).where(and(eq(tickets.status, "open"), lt(tickets.createdAt, fourHoursAgo))).limit(5).all(),
      db.select().from(organizations).all(),
    ]);

  const orgMap = new Map(allOrgs.map((o) => [o.id, o]));
  const notifications: NotificationItem[] = [];

  // 1. System Alerts (Credit, Runway, Overdue)
  for (const alt of dbAlerts) {
    let cat: NotificationItem["category"] = "credit";
    if (alt.type.includes("sla") || alt.type.includes("overdue")) cat = "sla";
    if (alt.type.includes("ai")) cat = "ai";

    let link = "/finance";
    if (alt.orgId) link = `/accounts/${alt.orgId}`;

    notifications.push({
      id: alt.id,
      category: cat,
      type: alt.type,
      severity: alt.severity as any,
      title: alt.title,
      message: alt.message,
      link,
      isRead: Boolean(alt.isRead),
      createdAt: alt.createdAt,
    });
  }

  // 2. Pending Maker-Checker Approvals
  const relevantCRs =
    actor.role === "admin"
      ? pendingCRs
      : pendingCRs.filter((cr) => cr.approverRoleNeeded === actor.role);

  for (const cr of relevantCRs) {
    notifications.push({
      id: `notif_cr_${cr.id}`,
      category: "approval",
      type: "change_request_pending",
      severity: "warning",
      title: `Approval Needed: ${cr.type.replace(/_/g, " ").toUpperCase()}`,
      message: `Pending request #${cr.id} requires ${cr.approverRoleNeeded} dual-authorization. Reason: "${cr.reason}"`,
      link: "/approvals",
      isRead: false,
      createdAt: cr.createdAt,
    });
  }

  // 3. Compliance SLA Breaches
  if (actor.role === "compliance" || actor.role === "admin") {
    for (const kyc of breachedKyc) {
      notifications.push({
        id: `notif_sla_kyc_${kyc.id}`,
        category: "sla",
        type: "kyc_sla_breach",
        severity: "critical",
        title: `KYC SLA Breached (>48h): Case #${kyc.id}`,
        message: `KYC submission for workspace ${kyc.workspaceId} has exceeded the 48-hour compliance review window.`,
        link: "/compliance",
        isRead: false,
        createdAt: kyc.submittedAt || new Date(),
      });
    }

    for (const sid of breachedSenders) {
      notifications.push({
        id: `notif_sla_sid_${sid.id}`,
        category: "sla",
        type: "sender_id_sla_breach",
        severity: "critical",
        title: `DLT Header Breached (>48h): ${sid.header}`,
        message: `Sender ID ${sid.header} awaiting operator approval past 48 hours.`,
        link: "/compliance",
        isRead: false,
        createdAt: sid.submittedAt || new Date(),
      });
    }
  }

  // 4. Support Ticket SLA Breaches
  if (actor.role === "support" || actor.role === "admin") {
    for (const t of breachedTickets) {
      const org = orgMap.get(t.orgId);
      notifications.push({
        id: `notif_sla_ticket_${t.id}`,
        category: "sla",
        type: "ticket_sla_breach",
        severity: "critical",
        title: `Support Ticket SLA Breached (>4h): ${t.subject}`,
        message: `High-priority customer ticket #${t.id} (${org?.name || t.orgId}) is past 4h first response SLA.`,
        link: `/accounts/${t.orgId}`,
        isRead: false,
        createdAt: t.createdAt,
      });
    }
  }

  // Sort by createdAt descending
  return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function markNotificationRead(id: string) {
  if (id.startsWith("alt_")) {
    await db.update(alerts).set({ isRead: true }).where(eq(alerts.id, id));
  }
  return { success: true };
}

export async function markAllNotificationsRead() {
  await db.update(alerts).set({ isRead: true }).all();
  return { success: true };
}
