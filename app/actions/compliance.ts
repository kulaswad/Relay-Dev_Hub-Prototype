"use server";

import { revalidatePath } from "next/cache";
import { getActiveUser } from "@/lib/auth";
import { assertPermission } from "@/lib/permissions/guard";
import {
  approveKycCase,
  rejectKycCase,
  approveSenderId,
  approveTemplate,
  simulateCustomerSubmission,
} from "@/lib/services/compliance";

export async function approveKycCaseAction(input: { caseId: string; note?: string }) {
  try {
    const user = await getActiveUser();
    await assertPermission(user.id, "kyc:approve_reject");

    const result = await approveKycCase({
      caseId: input.caseId,
      actor: { id: user.id, role: user.role, name: user.name },
      note: input.note,
    });

    revalidatePath("/compliance");
    revalidatePath("/accounts");
    return { success: true };
  } catch (err: any) {
    console.error("Approve KYC error:", err);
    return { success: false, error: err.message || "Failed to approve KYC" };
  }
}

export async function rejectKycCaseAction(input: { caseId: string; reason: string }) {
  try {
    const user = await getActiveUser();
    await assertPermission(user.id, "kyc:approve_reject");

    const result = await rejectKycCase({
      caseId: input.caseId,
      reason: input.reason,
      actor: { id: user.id, role: user.role, name: user.name },
    });

    revalidatePath("/compliance");
    revalidatePath("/accounts");
    return { success: true };
  } catch (err: any) {
    console.error("Reject KYC error:", err);
    return { success: false, error: err.message || "Failed to reject KYC" };
  }
}

export async function approveSenderIdAction(input: { senderId: string }) {
  try {
    const user = await getActiveUser();
    await assertPermission(user.id, "sender_id:approve_reject");

    const result = await approveSenderId({
      senderId: input.senderId,
      actor: { id: user.id, role: user.role, name: user.name },
    });

    revalidatePath("/compliance");
    revalidatePath("/accounts");
    return { success: true };
  } catch (err: any) {
    console.error("Approve Sender ID error:", err);
    return { success: false, error: err.message || "Failed to approve sender ID" };
  }
}

export async function approveTemplateAction(input: { templateId: string; dltTemplateId: string }) {
  try {
    const user = await getActiveUser();
    await assertPermission(user.id, "template:approve_reject");

    const result = await approveTemplate({
      templateId: input.templateId,
      dltTemplateId: input.dltTemplateId,
      actor: { id: user.id, role: user.role, name: user.name },
    });

    revalidatePath("/compliance");
    revalidatePath("/accounts");
    return { success: true };
  } catch (err: any) {
    console.error("Approve template error:", err);
    return { success: false, error: err.message || "Failed to approve template" };
  }
}

export async function simulateCustomerSubmissionAction(input: {
  workspaceId: string;
  type: "kyc" | "sender_id" | "template";
  payload: any;
}) {
  try {
    const user = await getActiveUser();
    const result = await simulateCustomerSubmission({
      ...input,
      actorId: user.id,
    });

    revalidatePath("/compliance");
    revalidatePath("/accounts");
    return { success: true, id: result.id };
  } catch (err: any) {
    console.error("Simulator submission error:", err);
    return { success: false, error: err.message || "Simulation failed" };
  }
}
