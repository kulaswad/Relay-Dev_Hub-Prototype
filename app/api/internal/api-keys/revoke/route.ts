import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys, apiRequests, apiKeyAuditLogs } from "@/lib/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

const RevokeSchema = z.object({
  keyId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";
    const body = await req.json();
    const { keyId } = RevokeSchema.parse(body);

    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);

    if (!key || key.workspaceId !== wsId) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    // Calculate usage in the last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const [usageResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiRequests)
      .where(
        and(
          eq(apiRequests.keyId, key.id),
          gt(apiRequests.createdAt, oneDayAgo)
        )
      );

    const usageCount = usageResult?.count || 0;

    // Immediately revoke key
    await db
      .update(apiKeys)
      .set({
        status: "revoked",
      })
      .where(eq(apiKeys.id, key.id));

    const actor = session?.user?.name
      ? `${session.user.name} (${session.user.email})`
      : "Aditya Roy (demo@acmepay.in)";

    // Write audit log
    await db.insert(apiKeyAuditLogs).values({
      id: `akal_${crypto.randomBytes(8).toString("hex")}`,
      keyId: key.id,
      workspaceId: wsId,
      action: "revoked",
      actor: actor,
      details: JSON.stringify({
        usageCountLast24h: usageCount,
        lastUsedAt: key.lastUsedAt,
      }),
      createdAt: new Date(),
    });

    const [updatedKey] = await db.select().from(apiKeys).where(eq(apiKeys.id, key.id)).limit(1);

    return NextResponse.json({
      success: true,
      key: updatedKey,
      usageCountLast24h: usageCount,
      message: `Key '${key.name}' successfully revoked. All future API requests using this key will be rejected immediately with HTTP 401.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
