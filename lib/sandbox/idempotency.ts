import { db } from "@/lib/db";
import { apiRequests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface IdempotencyCheckResult {
  isMatch: boolean;
  isConflict: boolean;
  savedStatus?: number;
  savedResponseBody?: any;
}

function normalizeJsonString(str?: string | null): string {
  if (!str) return "";
  try {
    return JSON.stringify(JSON.parse(str));
  } catch {
    return str.trim();
  }
}

export async function checkIdempotency(
  workspaceId: string,
  idempotencyKey: string,
  currentBodyString: string
): Promise<IdempotencyCheckResult> {
  const [existing] = await db
    .select()
    .from(apiRequests)
    .where(
      and(
        eq(apiRequests.workspaceId, workspaceId),
        eq(apiRequests.idempotencyKey, idempotencyKey)
      )
    )
    .limit(1);

  if (!existing) {
    return { isMatch: false, isConflict: false };
  }

  const existingNormalized = normalizeJsonString(existing.requestBody);
  const currentNormalized = normalizeJsonString(currentBodyString);

  if (existingNormalized === currentNormalized) {
    let parsedResponse = null;
    try {
      parsedResponse = existing.responseBody ? JSON.parse(existing.responseBody) : null;
    } catch {
      parsedResponse = existing.responseBody;
    }

    return {
      isMatch: true,
      isConflict: false,
      savedStatus: existing.status,
      savedResponseBody: parsedResponse,
    };
  }

  // Conflict: same idempotency key, different body
  return {
    isMatch: false,
    isConflict: true,
  };
}
