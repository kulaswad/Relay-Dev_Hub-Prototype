import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys, apiKeyAuditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

const RotateSchema = z.object({
  keyId: z.string(),
  gracePeriodHours: z.union([z.literal(1), z.literal(24), z.literal(168)]).default(24),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";
    const body = await req.json();
    const { keyId, gracePeriodHours } = RotateSchema.parse(body);

    const [oldKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);

    if (!oldKey || oldKey.workspaceId !== wsId) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    if (oldKey.status === "revoked") {
      return NextResponse.json(
        { error: "Cannot rotate a key that has already been revoked." },
        { status: 400 }
      );
    }

    const now = new Date();
    const gracePeriodEndsAt = new Date(now.getTime() + gracePeriodHours * 3600 * 1000);

    // 1. Put old key in 'rotating' state
    await db
      .update(apiKeys)
      .set({
        status: "rotating",
        gracePeriodEndsAt: gracePeriodEndsAt,
      })
      .where(eq(apiKeys.id, oldKey.id));

    // 2. Generate brand new replacement key
    const prefix = oldKey.prefix || (oldKey.environment === "test" ? "rl_test_" : "rl_live_");
    const secretRandom = crypto.randomBytes(20).toString("hex");
    const fullKey = `${prefix}${secretRandom}`;
    const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");
    const masked = `${prefix}${"•".repeat(16)}${fullKey.slice(-4)}`;
    const newKeyId = `key_${oldKey.environment}_${crypto.randomBytes(8).toString("hex")}`;

    const actor = session?.user?.name
      ? `${session.user.name} (${session.user.email})`
      : "Aditya Roy (demo@acmepay.in)";

    await db.insert(apiKeys).values({
      id: newKeyId,
      workspaceId: wsId,
      name: `${oldKey.name} (Rotated)`,
      prefix: prefix,
      hashedSecret: keyHash,
      secretMasked: masked,
      fullKeyForDev: fullKey,
      environment: oldKey.environment,
      scopes: oldKey.scopes,
      status: "active",
      expiresAt: oldKey.expiresAt,
      rotatedFromId: oldKey.id,
      ipAllowlist: oldKey.ipAllowlist,
      createdAt: now,
      createdBy: actor,
    });

    // 3. Record Audit Log for Rotation
    await db.insert(apiKeyAuditLogs).values({
      id: `akal_${crypto.randomBytes(8).toString("hex")}`,
      keyId: oldKey.id,
      workspaceId: wsId,
      action: "rotated",
      actor: actor,
      details: JSON.stringify({
        rotatedToKeyId: newKeyId,
        gracePeriodHours,
        gracePeriodEndsAt: gracePeriodEndsAt.toISOString(),
      }),
      createdAt: now,
    });

    const [updatedOld] = await db.select().from(apiKeys).where(eq(apiKeys.id, oldKey.id)).limit(1);
    const [createdNew] = await db.select().from(apiKeys).where(eq(apiKeys.id, newKeyId)).limit(1);

    return NextResponse.json({
      success: true,
      oldKey: updatedOld,
      newKey: createdNew,
      rawKey: fullKey, // Revealed ONLY ONCE on rotation
      gracePeriodEndsAt: gracePeriodEndsAt.toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
