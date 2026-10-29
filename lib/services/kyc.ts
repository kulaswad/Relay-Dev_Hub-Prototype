import { db } from "@/lib/db";
import { kycCases, senderIds } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "./audit";

export async function getPendingKycRecords() {
  return await db
    .select()
    .from(kycCases)
    .where(eq(kycCases.status, "submitted"))
    .orderBy(desc(kycCases.submittedAt));
}

export async function getPendingSenderIds() {
  return await db
    .select()
    .from(senderIds)
    .where(eq(senderIds.status, "submitted"))
    .orderBy(desc(senderIds.submittedAt));
}
