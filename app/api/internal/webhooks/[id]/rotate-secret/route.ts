import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { webhookEndpoints } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const [ep] = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, params.id),
          eq(webhookEndpoints.workspaceId, wsId)
        )
      )
      .limit(1);

    if (!ep) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }

    const newSecret = `whsec_${ep.environment}_${crypto.randomBytes(24).toString("hex")}`;
    const now = new Date();
    const graceEndsAt = new Date(now.getTime() + 24 * 3600 * 1000); // 24h grace period

    await db
      .update(webhookEndpoints)
      .set({
        signingSecret: newSecret,
        previousSigningSecret: ep.signingSecret,
        secretRotationEndsAt: graceEndsAt,
      })
      .where(eq(webhookEndpoints.id, ep.id));

    return NextResponse.json({
      success: true,
      newSecret,
      previousSecret: ep.signingSecret,
      gracePeriodEndsAt: graceEndsAt.toISOString(),
      message:
        "Secret rotated successfully. For the next 24 hours, Relay will send dual signatures (v1=...,v1=...) so your services can verify both keys without downtime.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
