import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { limitRequests, alerts, workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

const LimitRequestSchema = z.object({
  requestedTps: z.number().min(50).max(50000),
  reason: z.string().min(5),
  channels: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const body = await req.json();
    const validated = LimitRequestSchema.parse(body);

    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .limit(1);

    const requestId = `lrq_${crypto.randomBytes(8).toString("hex")}`;
    const now = new Date();

    await db.insert(limitRequests).values({
      id: requestId,
      workspaceId: wsId,
      currentTier: ws?.planTier || "growth",
      requestedTps: validated.requestedTps,
      reason: validated.reason,
      channels: JSON.stringify(validated.channels || ["sms", "rcs", "whatsapp"]),
      status: "pending",
      createdAt: now,
    });

    // Record internal notification
    const alertId = `alt_${crypto.randomBytes(8).toString("hex")}`;
    await db.insert(alerts).values({
      id: alertId,
      workspaceId: wsId,
      type: "limit_elevation_requested",
      severity: "info",
      title: "Rate Limit Elevation Requested",
      message: `Requested ${validated.requestedTps} TPS for workspace ${ws?.name || wsId}. Reason: ${validated.reason}`,
      isRead: false,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      requestId,
      message: "Rate limit elevation request submitted. Relay developer operations team typically reviews within 4 business hours.",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid request payload" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
