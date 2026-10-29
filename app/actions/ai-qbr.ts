"use server";

import { generateQBRBrief } from "@/lib/services/qbr-summary";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/services/audit";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function generateQBRAction(
  orgId: string,
  tone: "concise" | "detailed" = "concise"
) {
  try {
    const user = await getCurrentUser();
    const result = await generateQBRBrief(orgId, tone, user.id);
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to generate QBR brief" };
  }
}

export async function saveQBRNoteAction(orgId: string, noteText: string) {
  try {
    const user = await getCurrentUser();
    const org = db.select().from(organizations).where(eq(organizations.id, orgId)).get();
    if (!org) throw new Error("Organization not found");

    // Log to immutable tamper-evident audit log with ai_assisted: true
    await writeAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "add_note",
      targetType: "organization",
      targetId: orgId,
      orgId,
      reason: "Account Manager saved QBR executive brief to account history",
      aiAssisted: true,
      after: {
        note_snippet: noteText.substring(0, 300),
        full_note_length: noteText.length,
      },
    });

    revalidatePath(`/accounts/${orgId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to save QBR note" };
  }
}
