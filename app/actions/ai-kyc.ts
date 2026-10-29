"use server";

import { readKycDocumentWithAI } from "@/lib/services/kyc-reader";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { kycCases, workspaces, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/services/audit";
import { revalidatePath } from "next/cache";

export async function readKycDocumentAction(params: {
  kycCaseId: string;
  simulateMismatch?: boolean;
  documentBase64?: string;
  documentMimeType?: string;
}) {
  try {
    const user = await getCurrentUser();
    const result = await readKycDocumentWithAI({
      ...params,
      userId: user.id,
    });
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to process KYC document" };
  }
}

export async function submitKycReviewWithAIAction(params: {
  kycCaseId: string;
  decision: "approve" | "reject";
  notes: string;
  verifiedFields: string[];
  overriddenFields: string[];
  aiAssisted: boolean;
}) {
  try {
    const user = await getCurrentUser();
    if (user.role !== "compliance" && user.role !== "admin") {
      throw new Error("Unauthorized: Only Compliance or Admin roles can review KYC.");
    }

    const kyc = db.select().from(kycCases).where(eq(kycCases.id, params.kycCaseId)).get();
    if (!kyc) throw new Error("KYC Case not found");

    const newStatus = params.decision === "approve" ? "approved" : "rejected";
    const now = new Date();

    // Update KYC case
    db.update(kycCases)
      .set({
        status: newStatus,
        assignedTo: user.id,
        notes: params.notes,
      })
      .where(eq(kycCases.id, params.kycCaseId))
      .run();

    // If approved, update workspace status
    if (params.decision === "approve") {
      db.update(workspaces)
        .set({ status: "active" })
        .where(eq(workspaces.id, kyc.workspaceId))
        .run();
    }

    const ws = db.select().from(workspaces).where(eq(workspaces.id, kyc.workspaceId)).get();

    // Log to immutable audit log with ai_assisted: true
    await writeAudit({
      actorId: user.id,
      actorRole: user.role,
      action: params.decision === "approve" ? "kyc_approved" : "kyc_rejected",
      targetType: "kyc_case",
      targetId: kyc.id,
      orgId: ws?.orgId,
      reason: params.notes,
      aiAssisted: params.aiAssisted,
      before: { status: kyc.status },
      after: {
        status: newStatus,
        verified_fields: params.verifiedFields,
        overridden_fields: params.overriddenFields,
        ai_assisted: params.aiAssisted,
      },
    });

    revalidatePath("/compliance");
    if (ws?.orgId) {
      revalidatePath(`/accounts/${ws.orgId}`);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to submit KYC review" };
  }
}
