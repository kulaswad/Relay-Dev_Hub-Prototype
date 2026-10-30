import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys, apiKeyAuditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

const EndGraceSchema = z.object({
  keyId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";
    const body = await req.json();
    const { keyId } = EndGraceSchema.parse(body);

    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);

    if (!key || key.workspaceId !== wsId) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const now = new Date();

    await db
      .update(apiKeys)
      .set({
        status: "revoked",
        gracePeriodEndsAt: now,
      })
      .where(eq(apiKeys.id, key.id));

    const actor = session?.user?.name
      ? `${session.user.name} (${session.user.email})`
      : "Aditya Roy (demo@acmepay.in)";

    await db.insert(apiKeyAuditLogs).values({
      id: `akal_${crypto.randomBytes(8).toString("hex")}`,
      keyId: key.id,
      workspaceId: wsId,
      action: "grace_period_ended",
      actor: actor,
      details: JSON.stringify({
        endedAt: now.toISOString(),
      }),
      createdAt: now,
    });

    const [updated] = await db.select().from(apiKeys).where(eq(apiKeys.id, key.id)).limit(1);

    return NextResponse.json({
      success: true,
      key: updated,
      message: "Grace period ended immediately. Old key is now permanently revoked.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
