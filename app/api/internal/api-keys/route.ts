import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys, workspaces, apiKeyAuditLogs } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const url = new URL(req.url);
    const envFilter = url.searchParams.get("environment");

    let query = db
      .select()
      .from(apiKeys)
      .where(
        envFilter && (envFilter === "test" || envFilter === "live")
          ? and(eq(apiKeys.workspaceId, wsId), eq(apiKeys.environment, envFilter))
          : eq(apiKeys.workspaceId, wsId)
      )
      .orderBy(desc(apiKeys.createdAt));

    const keys = await query;

    // Get workspace KYC status and wallet info
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .limit(1);

    const isLiveLocked = ws?.kycStatus !== "approved";

    const mappedKeys = keys.map((k) => ({
      ...k,
      isLocked: isLiveLocked && k.environment === "live",
    }));

    return NextResponse.json({
      keys: mappedKeys,
      isLiveLocked,
      workspaceKycStatus: ws?.kycStatus || "not_started",
      walletBalance: ws?.walletBalance || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const CreateKeySchema = z.object({
  name: z.string().min(2, "Key name is required"),
  environment: z.enum(["test", "live"]).default("test"),
  scopes: z.array(z.string()).min(1, "At least one scope is required"),
  expiresInDays: z.number().nullable().optional(),
  ipAllowlist: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";
    const body = await req.json();
    const validated = CreateKeySchema.parse(body);

    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .limit(1);

    if (validated.environment === "live" && ws?.kycStatus !== "approved") {
      return NextResponse.json(
        {
          error: "Cannot create LIVE API key: workspace KYC is not approved.",
          code: "ERR_KYC_REQUIRED",
        },
        { status: 403 }
      );
    }

    const prefix = validated.environment === "test" ? "rl_test_" : "rl_live_";
    const secretRandom = crypto.randomBytes(20).toString("hex");
    const fullKey = `${prefix}${secretRandom}`;
    const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");
    const masked = `${prefix}${"•".repeat(16)}${fullKey.slice(-4)}`;

    const newKeyId = `key_${validated.environment}_${crypto.randomBytes(8).toString("hex")}`;
    const now = new Date();
    const expiresAt = validated.expiresInDays
      ? new Date(now.getTime() + validated.expiresInDays * 86400 * 1000)
      : null;

    const actor = session?.user?.name
      ? `${session.user.name} (${session.user.email})`
      : "Aditya Roy (demo@acmepay.in)";

    await db.insert(apiKeys).values({
      id: newKeyId,
      workspaceId: wsId,
      name: validated.name,
      prefix: prefix,
      hashedSecret: keyHash,
      secretMasked: masked,
      fullKeyForDev: fullKey,
      environment: validated.environment,
      scopes: JSON.stringify(validated.scopes),
      status: "active",
      expiresAt: expiresAt,
      ipAllowlist: validated.ipAllowlist?.trim() || null,
      createdAt: now,
      createdBy: actor,
    });

    // Record Audit Log
    await db.insert(apiKeyAuditLogs).values({
      id: `akal_${crypto.randomBytes(8).toString("hex")}`,
      keyId: newKeyId,
      workspaceId: wsId,
      action: "created",
      actor: actor,
      details: JSON.stringify({
        name: validated.name,
        environment: validated.environment,
        scopes: validated.scopes,
        expiresInDays: validated.expiresInDays || "Never",
        ipAllowlist: validated.ipAllowlist || "None",
      }),
      createdAt: now,
    });

    const [created] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, newKeyId))
      .limit(1);

    return NextResponse.json({
      success: true,
      key: {
        ...created,
        isLocked: ws?.kycStatus !== "approved" && created.environment === "live",
      },
      rawKey: fullKey, // Revealed ONLY ONCE on creation
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
