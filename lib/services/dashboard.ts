import { db } from "@/lib/db";
import {
  organizations,
  workspaces,
  invoices,
  changeRequests,
  kycCases,
  senderIds,
  templates,
  tickets,
  tasks,
  usageDaily,
  internalUsers,
  plans,
} from "@/lib/db/schema";
import { eq, desc, and, lt } from "drizzle-orm";
import { InternalRole } from "@/lib/permissions/roles";

export async function getRoleDashboardData(currentUser: { id: string; role: InternalRole; name: string }) {
  const now = new Date();
  const nowMs = now.getTime();
  const sixtyDaysFuture = new Date(nowMs + 60 * 86400 * 1000);
  const fortyEightHoursAgo = new Date(nowMs - 48 * 3600 * 1000);
  const fourHoursAgo = new Date(nowMs - 4 * 3600 * 1000);

  const [
    allOrgs,
    allWs,
    allInvoices,
    allCRs,
    allKyc,
    allSenders,
    allTemplates,
    allTickets,
    allTasks,
    allUsers,
  ] = await Promise.all([
    db.select().from(organizations).all(),
    db.select().from(workspaces).all(),
    db.select().from(invoices).all(),
    db.select().from(changeRequests).where(eq(changeRequests.status, "pending")).all(),
    db.select().from(kycCases).all(),
    db.select().from(senderIds).all(),
    db.select().from(templates).all(),
    db.select().from(tickets).all(),
    db.select().from(tasks).all(),
    db.select().from(internalUsers).all(),
  ]);

  const orgMap = new Map(allOrgs.map((o) => [o.id, o]));
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  // AM DATA
  const myOrgs = allOrgs.filter((o) => o.ownerAmId === currentUser.id);
  const myOrgIds = new Set(myOrgs.map((o) => o.id));
  const myAccountsAtRisk = myOrgs.filter((o) => o.status === "at_risk");
  const myUpcomingRenewals = myOrgs.filter((o) => o.contractEnd && o.contractEnd <= sixtyDaysFuture);
  const myPendingTasks = allTasks.filter(
    (t) => t.assignedTo === currentUser.id && t.status !== "completed" && t.status !== "dismissed"
  );

  // FINANCE DATA
  const postpaidWs = allWs.filter((w) => {
    const o = orgMap.get(w.orgId);
    return o?.billingModel === "postpaid" && w.creditLimit > 0;
  });

  const creditWatchlist = postpaidWs
    .map((w) => {
      const org = orgMap.get(w.orgId);
      const utilPct = Math.round((w.creditUsed / w.creditLimit) * 100);
      return {
        workspaceId: w.id,
        workspaceName: w.name,
        orgId: w.orgId,
        orgName: org?.name || w.orgId,
        creditLimit: w.creditLimit,
        creditUsed: w.creditUsed,
        utilizationPct: utilPct,
      };
    })
    .filter((w) => w.utilizationPct >= 70)
    .sort((a, b) => b.utilizationPct - a.utilizationPct);

  const overdueInvoices = allInvoices
    .filter((i) => i.status === "overdue" || (i.status === "issued" && i.dueAt && i.dueAt.getTime() < nowMs))
    .map((i) => {
      const ws = allWs.find((w) => w.id === i.workspaceId);
      const org = ws ? orgMap.get(ws.orgId) : null;
      const daysOverdue = Math.max(1, Math.floor((nowMs - i.dueAt.getTime()) / 86400000));
      return {
        invoiceId: i.id,
        orgId: org?.id || "",
        orgName: org?.name || "Customer",
        amount: i.amount + i.gstAmount,
        daysOverdue,
        period: i.period,
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // COMPLIANCE DATA
  const pendingKyc = allKyc.filter((k) => k.status === "in_review" || k.status === "submitted").map((k) => {
    const ws = allWs.find((w) => w.id === k.workspaceId);
    const org = ws ? orgMap.get(ws.orgId) : null;
    const isBreached = Boolean(k.submittedAt && k.submittedAt.getTime() < fortyEightHoursAgo.getTime());
    return {
      caseId: k.id,
      orgId: org?.id || "",
      orgName: org?.name || "Customer",
      workspaceName: ws?.name || k.workspaceId,
      submittedAt: k.submittedAt,
      isBreached,
    };
  });

  const pendingSenders = allSenders.filter((s) => s.status === "submitted").map((s) => {
    const ws = allWs.find((w) => w.id === s.workspaceId);
    const org = ws ? orgMap.get(ws.orgId) : null;
    const isBreached = Boolean(s.submittedAt && s.submittedAt.getTime() < fortyEightHoursAgo.getTime());
    return {
      id: s.id,
      header: s.header,
      channel: s.channel,
      orgId: org?.id || "",
      orgName: org?.name || "Customer",
      submittedAt: s.submittedAt,
      isBreached,
    };
  });

  // SALES OPS DATA
  const onboardingOrgs = allOrgs.filter((o) => o.status === "onboarding").map((o) => {
    const wsList = allWs.filter((w) => w.orgId === o.id);
    return {
      id: o.id,
      name: o.name,
      legalName: o.legalName,
      industry: o.industry,
      billingModel: o.billingModel,
      createdAt: o.createdAt,
      workspacesCount: wsList.length,
      kycPending: wsList.some((w) => w.status === "kyc_pending"),
    };
  });

  // SUPPORT DATA
  const openTickets = allTickets.filter((t) => t.status !== "resolved").map((t) => {
    const org = orgMap.get(t.orgId);
    const isBreached = t.createdAt.getTime() < fourHoursAgo.getTime();
    return {
      id: t.id,
      subject: t.subject,
      priority: t.priority,
      status: t.status,
      orgId: t.orgId,
      orgName: org?.name || t.orgId,
      createdAt: t.createdAt,
      isBreached,
    };
  }).sort((a, b) => (b.isBreached ? 1 : 0) - (a.isBreached ? 1 : 0));

  // ADMIN DATA: APPROVAL BACKLOG
  const approvalBacklog = allCRs.map((cr) => {
    const requester = userMap.get(cr.requestedBy);
    return {
      id: cr.id,
      type: cr.type,
      targetType: cr.targetType,
      targetId: cr.targetId,
      requestedBy: requester?.name || cr.requestedBy,
      approverRoleNeeded: cr.approverRoleNeeded,
      reason: cr.reason,
      createdAt: cr.createdAt,
    };
  });

  return {
    currentUser,
    metrics: {
      totalOrganizations: allOrgs.length,
      activeWorkspaces: allWs.filter((w) => w.status === "active").length,
      atRiskAccountsCount: allOrgs.filter((o) => o.status === "at_risk").length,
      pendingApprovalsCount: allCRs.length,
      overdueTotalAmount: overdueInvoices.reduce((acc, i) => acc + i.amount, 0),
    },
    am: {
      myOrgsCount: myOrgs.length,
      myAccountsAtRisk,
      myUpcomingRenewals,
      myPendingTasks: myPendingTasks.map((t) => {
        const org = orgMap.get(t.orgId);
        return {
          id: t.id,
          title: t.title,
          orgId: t.orgId,
          orgName: org?.name || t.orgId,
          source: t.source,
          dueAt: t.dueAt,
          status: t.status,
        };
      }),
    },
    finance: {
      creditWatchlist,
      overdueInvoices,
    },
    compliance: {
      pendingKyc,
      pendingSenders,
      slaBreachedCount:
        pendingKyc.filter((k) => k.isBreached).length + pendingSenders.filter((s) => s.isBreached).length,
    },
    salesOps: {
      onboardingOrgs,
    },
    support: {
      openTickets,
      breachedTicketsCount: openTickets.filter((t) => t.isBreached).length,
    },
    admin: {
      approvalBacklog,
    },
  };
}
