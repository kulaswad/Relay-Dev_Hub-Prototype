"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { internalUsers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { InternalRole } from "@/lib/permissions/roles";
import { assertPermission } from "@/lib/permissions/guard";
import { alerts } from "@/lib/db/schema";
import {
  changeCreditLimit,
  recordTopup,
  recordManualAdjustment,
  issueDraftInvoice,
  markInvoicePaid,
  flagInvoiceDisputed,
  logFollowUpAction,
  simulateDayOfUsage,
  getWorkspaceCreditBilling,
} from "@/lib/services/finance";

async function getActor() {
  const cookieStore = cookies();
  const actorId = cookieStore.get("relay_actor_id")?.value || "usr_adm_kabir";

  const user = await db.select().from(internalUsers).where(eq(internalUsers.id, actorId)).get();
  if (!user) {
    return { id: "usr_adm_kabir", role: "admin" as InternalRole, name: "Kabir Anand" };
  }
  return { id: user.id, role: user.role as InternalRole, name: user.name };
}

export async function getWorkspaceCreditBillingAction(workspaceId: string) {
  try {
    const data = await getWorkspaceCreditBilling(workspaceId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load credit position" };
  }
}

export async function changeCreditLimitAction(input: {
  workspaceId: string;
  newCreditLimit: number;
  reason: string;
  note?: string;
}) {
  try {
    const actor = await getActor();
    await assertPermission(actor.id, "credit:request_limit_change");
    const result = await changeCreditLimit({
      ...input,
      actor,
    });
    revalidatePath("/finance");
    revalidatePath("/accounts/[orgId]", "page");
    revalidatePath("/approvals");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to change credit limit" };
  }
}

export async function recordTopupAction(input: {
  workspaceId: string;
  amount: number;
  paymentReference: string;
  paymentMode: "NEFT" | "RTGS" | "IMPS" | "Net Banking" | "UPI";
}) {
  try {
    const actor = await getActor();
    await assertPermission(actor.id, "credit:record_adjustment");
    const result = await recordTopup({
      ...input,
      actor,
    });
    revalidatePath("/finance");
    revalidatePath("/accounts/[orgId]", "page");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record top-up" };
  }
}

export async function recordManualAdjustmentAction(input: {
  workspaceId: string;
  adjustmentType: "credit" | "debit";
  reasonCode: "goodwill_credit" | "billing_error" | "refund" | "chargeback";
  reason: string;
  amount: number;
}) {
  try {
    const actor = await getActor();
    await assertPermission(actor.id, "credit:record_adjustment");
    const result = await recordManualAdjustment({
      ...input,
      actor,
    });
    revalidatePath("/finance");
    revalidatePath("/accounts/[orgId]", "page");
    revalidatePath("/approvals");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record adjustment" };
  }
}

export async function issueDraftInvoiceAction(invoiceId: string) {
  try {
    const actor = await getActor();
    await assertPermission(actor.id, "invoice:issue_or_mark_paid");
    const result = await issueDraftInvoice(invoiceId, actor);
    revalidatePath("/finance");
    revalidatePath("/accounts/[orgId]", "page");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to issue invoice" };
  }
}

export async function markInvoicePaidAction(input: {
  invoiceId: string;
  paymentReference: string;
  paymentMode: string;
}) {
  try {
    const actor = await getActor();
    await assertPermission(actor.id, "invoice:issue_or_mark_paid");
    const result = await markInvoicePaid({
      ...input,
      actor,
    });
    revalidatePath("/finance");
    revalidatePath("/accounts/[orgId]", "page");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark invoice paid" };
  }
}

export async function flagInvoiceDisputedAction(input: {
  invoiceId: string;
  reason: string;
}) {
  try {
    const actor = await getActor();
    await assertPermission(actor.id, "invoice:issue_or_mark_paid");
    const result = await flagInvoiceDisputed({
      ...input,
      actor,
    });
    revalidatePath("/finance");
    revalidatePath("/accounts/[orgId]", "page");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to dispute invoice" };
  }
}

export async function logFollowUpActionServer(input: {
  invoiceId: string;
  note: string;
}) {
  try {
    const actor = await getActor();
    const result = await logFollowUpAction({
      ...input,
      actor,
    });
    revalidatePath("/finance");
    revalidatePath("/accounts/[orgId]", "page");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to log collections follow-up" };
  }
}

export async function simulateDayOfUsageAction() {
  try {
    const actor = await getActor();
    const result = await simulateDayOfUsage(actor);
    revalidatePath("/finance");
    revalidatePath("/accounts/[orgId]", "page");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to simulate usage" };
  }
}

export async function getRecentAlertsAction() {
  try {
    const items = await db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(8).all();
    return { success: true, alerts: items };
  } catch (err: any) {
    return { success: false, alerts: [] };
  }
}
