"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { internalUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { InternalRole } from "@/lib/permissions/roles";
import { assertPermission } from "@/lib/permissions/guard";
import {
  getPlansCatalog,
  updatePlanCatalogEntry,
  getAddonCatalog,
  getWorkspacePricingAndSeats,
  calculateCustomPricingImpact,
  updateWorkspacePricing,
  attachWorkspaceAddon,
  cancelWorkspaceAddon,
  createSeatCorrectionRequest,
} from "@/lib/services/plans";

async function getActor() {
  const cookieStore = cookies();
  const actorId = cookieStore.get("relay_actor_id")?.value || "usr_adm_kabir";

  const user = await db.select().from(internalUsers).where(eq(internalUsers.id, actorId)).get();
  if (!user) {
    return { id: "usr_adm_kabir", role: "admin" as InternalRole, name: "Kabir Anand" };
  }
  return { id: user.id, role: user.role as InternalRole, name: user.name };
}

export async function getPlansCatalogAction() {
  try {
    const plans = await getPlansCatalog();
    return { success: true, data: plans };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load plans" };
  }
}

export async function updatePlanCatalogAction(input: {
  planId: string;
  baseFeeMonthly?: number;
  includedSeats?: number;
  throughputMps?: number;
  billingModel?: "prepaid" | "postpaid" | "both";
  perMessageRates?: { sms: number; rcs: number; whatsapp: number };
  priceFloors?: { sms: number; rcs: number; whatsapp: number };
  features?: string[];
  reason: string;
}) {
  try {
    const actor = await getActor();
    await assertPermission(actor.id, "account:edit_pricing");
    const result = await updatePlanCatalogEntry({
      ...input,
      actor,
    });
    revalidatePath("/plans");
    revalidatePath("/accounts/[orgId]", "page");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update plan" };
  }
}

export async function getAddonCatalogAction() {
  try {
    const addons = await getAddonCatalog();
    return { success: true, data: addons };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load add-on catalog" };
  }
}

export async function getWorkspacePricingAndSeatsAction(workspaceId: string) {
  try {
    const data = await getWorkspacePricingAndSeats(workspaceId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load workspace pricing" };
  }
}

export async function calculateCustomPricingImpactAction(input: {
  workspaceId: string;
  proposedPlanId?: string;
  customOverrides?: {
    sms?: number;
    rcs?: number;
    whatsapp?: number;
    baseFeeMonthly?: number;
  };
  discountPct?: number;
}) {
  try {
    const impact = await calculateCustomPricingImpact(input);
    return { success: true, data: impact };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to calculate bill impact" };
  }
}

export async function updateWorkspacePricingAction(input: {
  workspaceId: string;
  planId?: string;
  customOverrides?: {
    sms?: number;
    rcs?: number;
    whatsapp?: number;
    baseFeeMonthly?: number;
  };
  discountPct?: number;
  discountReason?: string;
  discountEndDate?: string | null;
  reason: string;
}) {
  try {
    const actor = await getActor();
    await assertPermission(actor.id, input.discountPct ? "account:request_discount" : "account:edit_pricing", {
      discountPct: input.discountPct,
    });
    const result = await updateWorkspacePricing({
      ...input,
      actor,
    });
    revalidatePath("/accounts/[orgId]", "page");
    revalidatePath("/approvals");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update pricing" };
  }
}

export async function attachWorkspaceAddonAction(input: {
  workspaceId: string;
  addonId: string;
  quantity: number;
  startDate?: string;
  endDate?: string | null;
}) {
  try {
    const actor = await getActor();
    await assertPermission(actor.id, "account:edit_pricing");
    const result = await attachWorkspaceAddon({
      workspaceId: input.workspaceId,
      addonId: input.addonId,
      quantity: input.quantity,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : null,
      actor,
    });
    revalidatePath("/accounts/[orgId]", "page");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to attach add-on" };
  }
}

export async function cancelWorkspaceAddonAction(input: {
  workspaceAddonId: string;
  reason: string;
}) {
  try {
    const actor = await getActor();
    await assertPermission(actor.id, "account:edit_pricing");
    const result = await cancelWorkspaceAddon({
      ...input,
      actor,
    });
    revalidatePath("/accounts/[orgId]", "page");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to cancel add-on" };
  }
}

export async function createSeatCorrectionRequestAction(input: {
  workspaceId: string;
  actionType: "true_up_billing" | "deprovision_inactive";
  reason: string;
}) {
  try {
    const actor = await getActor();
    const result = await createSeatCorrectionRequest({
      ...input,
      actor,
    });
    revalidatePath("/accounts/[orgId]", "page");
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create seat correction request" };
  }
}
