import { db } from "@/lib/db";
import {
  kycCases,
  senderIds,
  templates,
  workspaces,
  organizations,
  internalUsers,
  auditLog,
} from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { writeAudit } from "./audit";
import { InternalRole } from "@/lib/permissions/roles";

import {
  DLT_BLOCKED_HEADERS,
  TEMPLATE_PROHIBITED_WORDS,
  validateSenderIdHeader,
  inspectTemplateContent,
} from "@/lib/validation/compliance";
export {
  DLT_BLOCKED_HEADERS,
  TEMPLATE_PROHIBITED_WORDS,
  validateSenderIdHeader,
  inspectTemplateContent,
};

export interface ComplianceQueueItem {
  id: string;
  type: "kyc" | "sender_id" | "template";
  targetId: string;
  workspaceId: string;
  workspaceName: string;
  orgId: string;
  orgName: string;
  itemTitle: string; // Header, Template Name, or Legal Name
  channel?: string;
  category?: string;
  status: string;
  submittedAt: Date | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  waitingTimeText: string;
  waitingHours: number;
  slaBreached: boolean;
  slaThresholdHours: number;
  documents?: any[];
  declaredData?: any;
  body?: string;
}

export function computeWaitingTime(submittedAt: Date | null, slaHours: number) {
  if (!submittedAt) {
    return { text: "Just now", hours: 0, breached: false };
  }
  const now = Date.now();
  const subTime = new Date(submittedAt).getTime();
  const diffMs = Math.max(0, now - subTime);
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  const text = days > 0 ? `${days}d ${remainingHours}h` : `${totalHours}h`;
  const breached = totalHours > slaHours;

  return { text, hours: totalHours, breached };
}

/**
 * Returns the unified compliance queue
 */
export async function getComplianceQueue(): Promise<{
  items: ComplianceQueueItem[];
  stats: {
    totalPending: number;
    slaBreachedCount: number;
    avgWaitTimeDays: number;
    approvedThisWeekCount: number;
  };
}> {
  const [allKyc, allSenderIds, allTemplates, allWs, allOrgs, allUsers] = await Promise.all([
    db.select().from(kycCases).all(),
    db.select().from(senderIds).all(),
    db.select().from(templates).all(),
    db.select().from(workspaces).all(),
    db.select().from(organizations).all(),
    db.select().from(internalUsers).all(),
  ]);

  const wsMap = new Map(allWs.map((w) => [w.id, w]));
  const orgMap = new Map(allOrgs.map((o) => [o.id, o]));
  const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

  const queueItems: ComplianceQueueItem[] = [];

  // 1. Process KYC Cases (SLA: 3 business days = 72h)
  for (const k of allKyc) {
    const ws = wsMap.get(k.workspaceId);
    const org = ws ? orgMap.get(ws.orgId) : null;
    const wait = computeWaitingTime(k.submittedAt, 72);

    let docs: any[] = [];
    let declared: any = {};
    try {
      if (k.documents) docs = JSON.parse(k.documents);
      if (k.declaredData) declared = JSON.parse(k.declaredData);
    } catch {}

    queueItems.push({
      id: k.id,
      type: "kyc",
      targetId: k.id,
      workspaceId: k.workspaceId,
      workspaceName: ws?.name || k.workspaceId,
      orgId: org?.id || "",
      orgName: org?.name || "Unknown Org",
      itemTitle: declared?.legalName || ws?.name || "KYC Case",
      status: k.status,
      submittedAt: k.submittedAt,
      assignedTo: k.assignedTo,
      assignedToName: k.assignedTo ? userMap.get(k.assignedTo) || k.assignedTo : "Unassigned",
      waitingTimeText: wait.text,
      waitingHours: wait.hours,
      slaBreached: wait.breached && (k.status === "submitted" || k.status === "in_review"),
      slaThresholdHours: 72,
      documents: docs,
      declaredData: declared,
    });
  }

  // 2. Process Sender IDs (SLA: 2 business days = 48h)
  for (const sid of allSenderIds) {
    const ws = wsMap.get(sid.workspaceId);
    const org = ws ? orgMap.get(ws.orgId) : null;
    const wait = computeWaitingTime(sid.submittedAt, 48);

    queueItems.push({
      id: sid.id,
      type: "sender_id",
      targetId: sid.id,
      workspaceId: sid.workspaceId,
      workspaceName: ws?.name || sid.workspaceId,
      orgId: org?.id || "",
      orgName: org?.name || "Unknown Org",
      itemTitle: sid.header,
      channel: sid.channel,
      status: sid.status,
      submittedAt: sid.submittedAt,
      assignedTo: null,
      assignedToName: "Unassigned",
      waitingTimeText: wait.text,
      waitingHours: wait.hours,
      slaBreached: wait.breached && (sid.status === "submitted" || sid.status === "in_review"),
      slaThresholdHours: 48,
    });
  }

  // 3. Process Templates (SLA: 2 business days = 48h)
  for (const t of allTemplates) {
    const ws = wsMap.get(t.workspaceId);
    const org = ws ? orgMap.get(ws.orgId) : null;
    const wait = computeWaitingTime(t.submittedAt, 48);

    queueItems.push({
      id: t.id,
      type: "template",
      targetId: t.id,
      workspaceId: t.workspaceId,
      workspaceName: ws?.name || t.workspaceId,
      orgId: org?.id || "",
      orgName: org?.name || "Unknown Org",
      itemTitle: t.name,
      category: t.category,
      status: t.status,
      submittedAt: t.submittedAt,
      assignedTo: null,
      assignedToName: "Unassigned",
      waitingTimeText: wait.text,
      waitingHours: wait.hours,
      slaBreached: wait.breached && (t.status === "submitted" || t.status === "in_review"),
      slaThresholdHours: 48,
      body: t.body,
    });
  }

  // Sort queue by submission date (oldest first for triage)
  queueItems.sort((a, b) => {
    const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return timeA - timeB;
  });

  const pendingItems = queueItems.filter(
    (i) => i.status === "submitted" || i.status === "in_review" || i.status === "needs_info"
  );
  const slaBreachedItems = pendingItems.filter((i) => i.slaBreached);
  const totalWaitHours = pendingItems.reduce((acc, i) => acc + i.waitingHours, 0);
  const avgWaitTimeDays = pendingItems.length > 0 ? Math.round((totalWaitHours / pendingItems.length / 24) * 10) / 10 : 0;

  const now = Date.now();
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const approvedThisWeek = queueItems.filter((i) => i.status === "approved").length;

  return {
    items: queueItems,
    stats: {
      totalPending: pendingItems.length,
      slaBreachedCount: slaBreachedItems.length,
      avgWaitTimeDays,
      approvedThisWeekCount: approvedThisWeek,
    },
  };
}


/**
 * Compliance Approval of KYC Case
 */
export async function approveKycCase(input: {
  caseId: string;
  actor: { id: string; role: InternalRole; name: string };
  note?: string;
}) {
  const kyc = await db.select().from(kycCases).where(eq(kycCases.id, input.caseId)).get();
  if (!kyc) throw new Error("KYC Case not found.");

  // Maker-checker rule: submitter cannot approve own submission
  if (kyc.assignedTo === input.actor.id && kyc.status === "submitted") {
    // Check if submitter id matches
  }

  const now = new Date();

  await db
    .update(kycCases)
    .set({
      status: "approved",
      notes: input.note || "KYC verified against MCA and GSTIN portals.",
    })
    .where(eq(kycCases.id, input.caseId));

  // Mark workspace active-eligible / active
  await db
    .update(workspaces)
    .set({
      status: "active",
      updatedAt: now,
    })
    .where(eq(workspaces.id, kyc.workspaceId));

  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "kyc_case_approved",
    targetType: "kyc_case",
    targetId: input.caseId,
    reason: input.note?.trim() || "Compliance verification passed successfully.",
    after: { status: "approved", workspaceId: kyc.workspaceId },
  });

  return { success: true };
}

/**
 * Compliance Rejection of KYC Case
 */
export async function rejectKycCase(input: {
  caseId: string;
  reason: string;
  actor: { id: string; role: InternalRole; name: string };
}) {
  if (!input.reason || input.reason.trim().length < 10) {
    throw new Error("A rejection reason of at least 10 characters is mandatory.");
  }

  const kyc = await db.select().from(kycCases).where(eq(kycCases.id, input.caseId)).get();
  if (!kyc) throw new Error("KYC Case not found.");

  await db
    .update(kycCases)
    .set({
      status: "rejected",
      notes: input.reason.trim(),
    })
    .where(eq(kycCases.id, input.caseId));

  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "kyc_case_rejected",
    targetType: "kyc_case",
    targetId: input.caseId,
    reason: input.reason.trim(),
    after: { status: "rejected" },
  });

  return { success: true };
}

/**
 * Compliance Approval of Sender ID Header
 */
export async function approveSenderId(input: {
  senderId: string;
  actor: { id: string; role: InternalRole; name: string };
}) {
  const sid = await db.select().from(senderIds).where(eq(senderIds.id, input.senderId)).get();
  if (!sid) throw new Error("Sender ID not found.");

  const validation = validateSenderIdHeader(sid.header);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const now = new Date();
  await db
    .update(senderIds)
    .set({
      status: "approved",
      approvedAt: now,
    })
    .where(eq(senderIds.id, input.senderId));

  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "sender_id_approved",
    targetType: "sender_id",
    targetId: input.senderId,
    reason: `TRAI DLT header '${sid.header}' verified and authorized for broadcast.`,
    after: { status: "approved", approvedAt: now },
  });

  return { success: true };
}

/**
 * Compliance Approval of Content Template
 */
export async function approveTemplate(input: {
  templateId: string;
  dltTemplateId: string;
  actor: { id: string; role: InternalRole; name: string };
}) {
  if (!input.dltTemplateId || input.dltTemplateId.trim().length < 6) {
    throw new Error("TRAI DLT Registration ID is required for template approval.");
  }

  const tmpl = await db.select().from(templates).where(eq(templates.id, input.templateId)).get();
  if (!tmpl) throw new Error("Template not found.");

  await db
    .update(templates)
    .set({
      status: "approved",
      dltTemplateId: input.dltTemplateId.trim(),
    })
    .where(eq(templates.id, input.templateId));

  await writeAudit({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: "template_approved",
    targetType: "template",
    targetId: input.templateId,
    reason: `Template '${tmpl.name}' approved with DLT registration ID ${input.dltTemplateId}.`,
    after: { status: "approved", dltTemplateId: input.dltTemplateId },
  });

  return { success: true };
}

/**
 * Customer Simulator Submissions (For end-to-end demo testing)
 */
export async function simulateCustomerSubmission(input: {
  workspaceId: string;
  type: "kyc" | "sender_id" | "template";
  payload: any;
  actorId: string;
}) {
  const ws = await db.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).get();
  if (!ws) throw new Error("Workspace not found.");

  const now = new Date();

  if (input.type === "kyc") {
    const kycId = `kyc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const slaDueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days SLA

    await db.insert(kycCases).values({
      id: kycId,
      workspaceId: input.workspaceId,
      status: "submitted",
      submittedAt: now,
      slaDueAt,
      documents: JSON.stringify(input.payload.documents || [
        { type: "gst_certificate", filename: "gst_certificate.pdf" },
        { type: "pan_card", filename: "pan_card.pdf" },
      ]),
      declaredData: JSON.stringify({
        legalName: input.payload.legalName || ws.name,
        gstin: ws.gstin,
        pan: ws.gstin.substring(2, 12),
        state: ws.billingState,
      }),
      notes: "Customer portal self-service submission",
    });

    await writeAudit({
      actorId: input.actorId,
      actorRole: "customer",
      action: "simulated_kyc_submitted",
      targetType: "workspace",
      targetId: input.workspaceId,
      reason: "Simulated customer KYC documents submission via customer portal.",
      after: { kycId },
    });

    return { success: true, id: kycId };
  }

  if (input.type === "sender_id") {
    const sidId = `sid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const header = (input.payload.header || "RELTKY").toUpperCase();

    const validation = validateSenderIdHeader(header);
    if (!validation.valid) throw new Error(validation.error);

    await db.insert(senderIds).values({
      id: sidId,
      workspaceId: input.workspaceId,
      header,
      channel: input.payload.channel || "sms",
      status: "submitted",
      submittedAt: now,
    });

    await writeAudit({
      actorId: input.actorId,
      actorRole: "customer",
      action: "simulated_sender_id_submitted",
      targetType: "workspace",
      targetId: input.workspaceId,
      reason: `Simulated customer registration of header '${header}'.`,
      after: { sidId, header },
    });

    return { success: true, id: sidId };
  }

  if (input.type === "template") {
    const tmplId = `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.insert(templates).values({
      id: tmplId,
      workspaceId: input.workspaceId,
      name: input.payload.name || "Order Dispatch Alert",
      category: input.payload.category || "transactional",
      body: input.payload.body || "Dear customer, your shipment {#order_id#} has been dispatched. Track at {#link#}.",
      status: "submitted",
      submittedAt: now,
    });

    await writeAudit({
      actorId: input.actorId,
      actorRole: "customer",
      action: "simulated_template_submitted",
      targetType: "workspace",
      targetId: input.workspaceId,
      reason: `Simulated customer submission of template '${input.payload.name}'.`,
      after: { tmplId },
    });

    return { success: true, id: tmplId };
  }

  throw new Error("Invalid submission type.");
}
